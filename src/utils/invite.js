/**
 * Inviting people to a specific board.
 *
 * The link carries the board, not just the space. Which board you're looking at
 * is normally per-viewer state that never reaches the URL, so a plain space
 * link drops the recipient on whatever the admin set as the default — not the
 * board the message is about. `?b=<poolId>` rides in the query string, which
 * the router ignores entirely, so it can't collide with the fragment that
 * carries the space code.
 */
export function inviteUrl(spaceCode, poolId, origin) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (!spaceCode) return base;
  // /i/<poolId> rather than the app URL directly. A messaging app fetches the
  // link to build its preview, and it never sends the fragment — so a link
  // whose space lives in the fragment cannot be previewed. /i/ is a path the
  // server can read, and it bounces browsers on to /?b=…#space.
  return poolId ? `${base}/i/${encodeURIComponent(poolId)}` : `${base}/#${spaceCode}`;
}

/** The board id from an invite link, if it carried one. */
export function invitedPoolId(search) {
  const raw = String(search || "").replace(/^\?/, "");
  if (!raw) return null;
  return new URLSearchParams(raw).get("b") || null;
}

const money = (n) => `$${Number(n).toLocaleString()}`;

/**
 * What the invite actually says.
 *
 * Named after the game rather than the board, because "Pool 1" means nothing to
 * someone who hasn't joined yet — "Seahawks vs Patriots" does. The prize is the
 * hook, so it leads when there is one.
 */
export function inviteMessage({ pool, config = {}, slate, squaresLeft } = {}) {
  const isPickem = pool?.gameType === "pickem";

  if (isPickem) {
    const week = slate?.label || pool?.name || "this week";
    const games = slate?.games?.length;
    return [
      `Get your picks in for ${week}`,
      games ? ` — all ${games} games, most correct wins.` : " — most correct wins.",
      " Picks lock at the first kickoff.",
    ].join("");
  }

  const teams =
    config.teamX && config.teamY ? `${config.teamX} vs ${config.teamY}` : pool?.name || "our pool";
  const price = Number(config.pricePerSquare) > 0 ? money(config.pricePerSquare) : null;

  // "Up to" is the honest framing: a quarterly payout is what one square can
  // win at a time, and the pot is only reachable by winning every quarter.
  const prize =
    Number(config.quarterlyPayout) > 0
      ? `${money(config.quarterlyPayout)} a quarter`
      : Number(config.totalPot) > 0
        ? `${money(config.totalPot)}`
        : null;

  return [
    `Join my squares pool for ${teams}`,
    price ? ` — ${price} a square` : "",
    prize ? `, with ${prize} up for grabs` : "",
    ".",
    Number.isFinite(squaresLeft) && squaresLeft > 0 ? ` ${squaresLeft} squares left.` : "",
  ].join("");
}

/**
 * A prefilled SMS link.
 *
 * iOS and Android disagree on the separator before the body — iOS wants `&`
 * after the empty recipient, Android wants `?`. Getting it wrong opens the
 * composer with an empty message, which looks like the feature is broken.
 */
export function smsHref(body, userAgent) {
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const isApple = /iPad|iPhone|iPod|Macintosh/i.test(ua);
  return `sms:${isApple ? "&" : "?"}body=${encodeURIComponent(body)}`;
}

/** A prefilled email, for the desktop case where texting isn't available. */
export function mailtoHref(subject, body) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
