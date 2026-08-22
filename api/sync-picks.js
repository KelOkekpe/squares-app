import { adminClient } from "./_lib/supabaseAdmin.js";
import { getQuarterTotals } from "./_lib/espn.js";

const MIN_SECONDS_BETWEEN_SYNCS = 45;

/**
 * Grades a pick'em slate from finished games.
 *
 * Same shape as sync-scores and for the same reason: polling runs from whoever
 * has the contest open, so standings update without an admin present and
 * without a paid cron tier. Unauthenticated on purpose — it can only ever
 * write results into a slate that already exists, and the results come from
 * ESPN rather than from the caller.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { spaceCode, poolId } = req.body || {};
  if (!spaceCode || !poolId) {
    return res.status(400).json({ error: "spaceCode and poolId are required" });
  }

  try {
    const supabase = adminClient();
    const { data: rows, error } = await supabase
      .from("spaces")
      .select("type, value, updated_at")
      .eq("space_code", spaceCode)
      .eq("pool_id", poolId)
      .eq("type", "slate");
    if (error) throw error;

    const row = rows?.[0];
    const slate = row?.value;
    if (!slate?.games?.length) {
      return res.status(200).json({ synced: false, reason: "no_slate" });
    }

    if (row?.updated_at) {
      const age = (Date.now() - new Date(row.updated_at).getTime()) / 1000;
      if (age < MIN_SECONDS_BETWEEN_SYNCS) {
        return res.status(200).json({ synced: false, reason: "throttled" });
      }
    }

    // Only games that haven't been graded yet, and only ones that could have
    // finished — no point asking about a kickoff that hasn't happened.
    const pending = slate.games.filter(
      (g) => !g.winner && (!g.startsAt || new Date(g.startsAt).getTime() < Date.now())
    );

    const results = await Promise.all(
      pending.map(async (g) => {
        try {
          const totals = await getQuarterTotals(g.id);
          if (!totals?.isFinal) return null;

          const away = totals.finals.away;
          const home = totals.finals.home;
          // A tie is a real outcome; leaving winner null keeps it ungraded for
          // everyone rather than silently handing it to one side.
          const winner = away > home ? "away" : home > away ? "home" : "tie";
          return { id: g.id, winner, awayScore: away, homeScore: home, total: away + home };
        } catch {
          return null;
        }
      })
    );

    const graded = new Map(results.filter(Boolean).map((r) => [r.id, r]));
    if (!graded.size) {
      return res.status(200).json({ synced: false, reason: "nothing_final" });
    }

    const next = {
      ...slate,
      games: slate.games.map((g) => (graded.has(g.id) ? { ...g, ...graded.get(g.id) } : g)),
    };

    await supabase.from("spaces").upsert(
      {
        key: `fb-${spaceCode}-${poolId}-slate`,
        space_code: spaceCode,
        pool_id: poolId,
        type: "slate",
        value: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "space_code,pool_id,type" }
    );

    return res.status(200).json({
      synced: true,
      gradedNow: graded.size,
      gradedTotal: next.games.filter((g) => g.winner).length,
      of: next.games.length,
    });
  } catch (err) {
    console.error("sync-picks error:", err);
    return res.status(502).json({ error: "Could not grade the slate" });
  }
}
