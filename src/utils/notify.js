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
