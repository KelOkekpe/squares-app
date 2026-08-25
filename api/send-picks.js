import { adminClient } from "./_lib/supabaseAdmin.js";
import { renderPicksEmail } from "./_lib/pickEmail.js";

const RECENT_MS = 60 * 60 * 1000;

/**
 * Emails a player the sheet they just submitted.
 *
 * Needed because a sheet is invisible until the first kickoff — picks stay
 * hidden so nobody can copy them — so without this the player has no record of
 * what they chose.
 *
 * Three things keep an unauthenticated endpoint from being a way to send mail
 * on demand:
 *
 *   - The recipient is never supplied by the caller. It is read from
 *     pickem_contacts against the entry id, so this can only ever mail a sheet
 *     to the address that submitted it.
 *   - Only entries submitted in the last hour are eligible, which is what makes
 *     it a submission receipt rather than a resend button for the whole season.
 *   - Entry ids are UUIDs, so there is nothing to enumerate.
 *
 * Failure is deliberately quiet. The picks are already saved by the time this
 * runs; a mail provider being down must not read as the submission failing.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PICKS_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("send-picks: RESEND_API_KEY or PICKS_FROM_EMAIL not set — skipping");
    return res.status(200).json({ sent: false, reason: "not_configured" });
  }

  const { spaceCode, poolId, entryId } = req.body || {};
  if (!spaceCode || !poolId || !entryId) {
    return res.status(400).json({ error: "spaceCode, poolId and entryId are required" });
  }

  try {
    const supabase = adminClient();

    const [{ data: contact }, { data: rows }, { data: pool }] = await Promise.all([
      supabase
        .from("pickem_contacts")
        .select("email, created_at")
        .eq("space_code", spaceCode)
        .eq("pool_id", poolId)
        .eq("entry_id", entryId)
        .maybeSingle(),
      supabase
        .from("spaces")
        .select("type, value")
        .eq("space_code", spaceCode)
        .eq("pool_id", poolId)
        .in("type", ["picks", "slate"]),
      supabase.from("pools").select("name").eq("id", poolId).maybeSingle(),
    ]);

    if (!contact?.email) return res.status(404).json({ error: "No such entry" });

    // A receipt for something just submitted, not a resend for the season.
    if (Date.now() - new Date(contact.created_at).getTime() > RECENT_MS) {
      return res.status(410).json({ error: "That entry is no longer recent" });
    }

    const byType = Object.fromEntries((rows || []).map((r) => [r.type, r.value]));
    const entry = (byType.picks || []).find((e) => e.id === entryId);
    if (!entry) return res.status(404).json({ error: "No such entry" });

    const slate = byType.slate || {};
    const html = renderPicksEmail({
      contestName: slate.label || pool?.name || "Your contest",
      playerName: entry.name,
      games: slate.games || [],
      picks: entry.picks,
      tiebreak: entry.tiebreak,
      spaceCode,
    });

    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: contact.email,
        subject: `Your picks — ${slate.label || pool?.name || "SquarePool"}`,
        html,
      }),
    });

    if (!send.ok) {
      // Logged with the from-address because that is nearly always the cause:
      // a sender that isn't on the verified domain, or a key scoped to a
      // different one. The key itself is never logged.
      const detail = await send.text();
      console.error(
        `send-picks: provider rejected ${send.status} sending as "${from}" to a ${contact.email.split("@")[1]} address — ${detail}`
      );
      return res.status(200).json({ sent: false, reason: "provider_error", status: send.status });
    }

    const accepted = await send.json().catch(() => ({}));
    console.log(`send-picks: accepted by provider as ${accepted.id || "?"} (from "${from}")`);
    return res.status(200).json({ sent: true });
  } catch (err) {
    // Every outcome here is a 200 on purpose — the picks are already saved, and
    // a mail failure must not read to the player as a failed submission. That
    // makes the log the only place the reason appears, so it says everything.
    console.error("send-picks error:", err?.message || err, err?.stack || "");
    return res.status(200).json({ sent: false, reason: "error" });
  }
}
