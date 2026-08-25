/**
 * Turning an approval into something a player can act on.
 *
 * The board stores only names, so the moment of approval is the only time the
 * assigned cells are known — placeParticipant returns them, and these helpers
 * translate row/col into the numbers a player actually reads off the grid.
 */
import { spaceUrl } from "./routes.js";

/** [[row, col]] → [{ x, y }] using the board's randomised headers. */
export function cellsToCoordinates(cells = [], headers) {
  if (!headers?.x || !headers?.y) return [];
  return cells
    .filter(([r, c]) => headers.y[r] !== undefined && headers.x[c] !== undefined)
    .map(([r, c]) => ({ x: headers.x[c], y: headers.y[r] }));
}

/**
 * Fires the confirmation email an admin's approval triggers.
 *
 * Deliberately not awaited by its callers: the squares are already assigned and
 * the money already confirmed by the time this runs, so a mail failure must not
 * make the approval look like it did not take.
 */
export async function sendConfirmationEmail(payload) {
  try {
    const { data } = await import("../lib/supabase.js").then((m) => m.supabase.auth.getSession());
    const token = data?.session?.access_token;
    if (!token) {
      console.warn("Confirmation email skipped: no admin session to authenticate with");
      return { sent: false, reason: "no_session" };
    }

    const res = await fetch("/api/send-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    // Reported back rather than swallowed: the admin panel offers a manual
    // fallback, and it should appear only when the automatic send actually
    // failed. Guessing either way leaves someone either lied to or nagged.
    const result = (await res.json().catch(() => ({ sent: false, reason: "unreadable" }))) || {};
    if (!result.sent) {
      console.warn(`Confirmation email not sent (${res.status}): ${result.reason || result.error}`);
    }
    return result;
  } catch (err) {
    console.warn("Could not send the confirmation email:", err?.message || err);
    return { sent: false, reason: "error" };
  }
}

export function formatCoordinates(coords = [], config = {}) {
  const teamX = config.teamX || "Team X";
  const teamY = config.teamY || "Team Y";
  return coords.map((c) => `${teamX} ${c.x} / ${teamY} ${c.y}`);
}

/** Subject + body for an approval notice. Used by both the mail link and,
 *  once a sender is configured, the automated send. */
export function buildApprovalMessage({ entry, coords, config, poolName, spaceCode }) {
  const lines = formatCoordinates(coords, config);
  const link = spaceUrl(spaceCode);
  const squares = lines.length;

  const subject = `Your ${poolName || "squares"} entry is confirmed — ${squares} square${
    squares === 1 ? "" : "s"
  }`;

  const body = [
    `Hi ${entry.firstName || entry.name},`,
    "",
    `Your payment is confirmed and you're on the board${poolName ? ` for ${poolName}` : ""}.`,
    "",
    squares
      ? `Your square${squares === 1 ? "" : "s"}:`
      : "Your squares will appear on the board shortly.",
    ...lines.map((l) => `  • ${l}`),
    "",
    `See the full board: ${link}`,
    "",
    "Good luck!",
  ].join("\n");

  return { subject, body, link };
}

/** mailto: link — works with no backend, opens the admin's mail client. */
export function buildMailtoLink(message, to) {
  const params = new URLSearchParams({
    subject: message.subject,
    body: message.body,
  });
  // URLSearchParams uses + for spaces; mailto needs %20
  return `mailto:${encodeURIComponent(to || "")}?${params.toString().replace(/\+/g, "%20")}`;
}
