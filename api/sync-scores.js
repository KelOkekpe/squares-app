import { adminClient } from "./_lib/supabaseAdmin.js";
import { getQuarterTotals } from "./_lib/espn.js";

// Any viewer's browser can trigger a sync, which is what makes this work
// without a paid cron tier. This bounds how often it actually costs anything.
const MIN_SECONDS_BETWEEN_SYNCS = 45;

/**
 * Pulls live quarter scores for a board's linked game and writes them.
 *
 * Deliberately unauthenticated: the whole point is that scores keep updating
 * whether or not an admin has the tab open. It can't be abused into writing
 * anything of the caller's choosing — the game is whatever the board's own
 * config says, the values come from ESPN, and it only ever touches the scores
 * row of a board that has explicitly been linked to a game.
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
      .in("type", ["admin", "scores"]);
    if (error) throw error;

    const config = rows?.find((r) => r.type === "admin")?.value || {};
    const scoresRow = rows?.find((r) => r.type === "scores");
    const game = config.game;

    if (!game?.id) {
      return res.status(200).json({ synced: false, reason: "no_game_linked" });
    }

    // Cheap guard against every open tab hammering ESPN
    if (scoresRow?.updated_at) {
      const age = (Date.now() - new Date(scoresRow.updated_at).getTime()) / 1000;
      if (age < MIN_SECONDS_BETWEEN_SYNCS) {
        return res.status(200).json({ synced: false, reason: "throttled", retryInSeconds: Math.ceil(MIN_SECONDS_BETWEEN_SYNCS - age) });
      }
    }

    const totals = await getQuarterTotals(game.id);
    if (!totals) return res.status(200).json({ synced: false, reason: "no_game_data" });

    // Which side of the grid each team sits on, chosen when the board was linked
    const xIsAway = String(game.xTeamId) === String(totals.awayTeamId);
    const pick = (side, index) =>
      side === "x"
        ? (xIsAway ? totals.quarters.away : totals.quarters.home)[index]
        : (xIsAway ? totals.quarters.home : totals.quarters.away)[index];

    const scores = { ...(scoresRow?.value || {}) };
    for (let q = 0; q < totals.completedQuarters; q++) {
      const isLast = q === 3 && totals.isFinal;
      const x = isLast ? (xIsAway ? totals.finals.away : totals.finals.home) : pick("x", q);
      const y = isLast ? (xIsAway ? totals.finals.home : totals.finals.away) : pick("y", q);
      if (typeof x === "number" && typeof y === "number") {
        scores[`Q${q + 1}`] = { x, y };
      }
    }

    await supabase.from("spaces").upsert(
      {
        key: `fb-${spaceCode}-${poolId}-scores`,
        space_code: spaceCode,
        pool_id: poolId,
        type: "scores",
        value: scores,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "space_code,pool_id,type" }
    );

    return res.status(200).json({
      synced: true,
      status: totals.status,
      completedQuarters: totals.completedQuarters,
      scores,
    });
  } catch (err) {
    console.error("sync-scores error:", err);
    return res.status(502).json({ error: "Could not sync scores" });
  }
}
