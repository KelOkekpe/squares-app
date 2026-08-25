import { requireSpaceAdmin } from "./_lib/supabaseAdmin.js";
import { renderConfirmationEmail, renderConfirmationText } from "./_lib/confirmEmail.js";

/**
 * Tells a player their payment was confirmed.
 *
 * Unlike send-picks, this is admin-initiated, so it takes the real guard:
 * requireSpaceAdmin verifies the caller's session and their membership of the
 * space. Nothing here is reachable by a player.
 *
 * The recipient is still looked up rather than supplied — an admin of one space
 * should not be able to mail an arbitrary address through it.
 *
 * The squares coordinates are the one thing that does come from the caller, and
 * they have to: the grid stores names only, so which squares a player owns is
 * knowable at exactly one moment — the approval that triggers this — and nowhere
 * afterwards.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PICKS_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("send-confirmation: RESEND_API_KEY or PICKS_FROM_EMAIL not set — skipping");
    return res.status(200).json({ sent: false, reason: "not_configured" });
  }

  const { spaceCode, poolId, entryId, kind, coords, amount } = req.body || {};
  if (!spaceCode || !poolId || !entryId || !["squares", "pickem"].includes(kind)) {
    return res.status(400).json({ error: "spaceCode, poolId, entryId and kind are required" });
  }

  const auth = await requireSpaceAdmin(req, spaceCode);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { supabase } = auth;

  try {
    const table = kind === "pickem" ? "pickem_contacts" : "entry_contacts";
    const [{ data: contact }, { data: pool }] = await Promise.all([
      supabase
        .from(table)
        .select("email, name")
        .eq("space_code", spaceCode)
        .eq("pool_id", poolId)
        .eq("entry_id", entryId)
        .maybeSingle(),
      supabase.from("pools").select("name").eq("id", poolId).maybeSingle(),
    ]);

    // No stored address is an ordinary outcome, not a failure: contact details
    // are optional on a squares entry and the player may simply not have left one.
    if (!contact?.email) return res.status(200).json({ sent: false, reason: "no_email" });

    const parts = {
      kind,
      playerName: contact.name || "there",
      poolName: pool?.name || "your contest",
      spaceCode,
      coords: Array.isArray(coords) ? coords.slice(0, 100).map(String) : [],
      amount,
    };

    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: contact.email,
        subject:
          kind === "pickem"
            ? `You're in — ${parts.poolName}`
            : `Your squares are confirmed — ${parts.poolName}`,
        html: renderConfirmationEmail(parts),
        text: renderConfirmationText(parts),
      }),
    });

    if (!send.ok) {
      const detail = await send.text();
      console.error(
        `send-confirmation: provider rejected ${send.status} sending as "${from}" — ${detail}`
      );
      return res.status(200).json({ sent: false, reason: "provider_error", status: send.status });
    }

    const accepted = await send.json().catch(() => ({}));
    console.log(`send-confirmation: accepted as ${accepted.id || "?"} (${kind})`);
    return res.status(200).json({ sent: true });
  } catch (err) {
    // The money is already confirmed and the squares already assigned. A mail
    // failure must not make the admin think the approval did not take.
    console.error("send-confirmation error:", err?.message || err);
    return res.status(200).json({ sent: false, reason: "error" });
  }
}
