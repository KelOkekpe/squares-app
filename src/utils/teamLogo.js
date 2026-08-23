/**
 * Team logos, from ESPN's CDN.
 *
 * Slates are frozen when a contest is created, so the ones already in the
 * database have no logo on them and never will. The URL is derivable from the
 * abbreviation, though, so those keep working without a backfill — the stored
 * value is preferred when it's there, and the derived one covers the rest.
 */
const CDN = "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard";

export function teamLogoUrl(team) {
  if (!team) return null;
  if (team.logo) return team.logo;
  const abbr = String(team.abbr || "").trim();
  // Anything else is a made-up team name from a hand-built slate; there's no
  // logo to guess at, and a broken image is worse than none.
  if (!/^[A-Za-z]{2,4}$/.test(abbr)) return null;
  return `${CDN}/${abbr.toLowerCase()}.png`;
}
