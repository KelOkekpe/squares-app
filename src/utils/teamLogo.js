import { findTeam } from "./nflTeams.js";

/**
 * Team logos, from ESPN's CDN.
 *
 * Nothing stores a logo consistently, and none of it can be migrated: a
 * pick'em slate is frozen at creation, a squares board linked to a game kept
 * only ESPN's numeric team ids, and an unlinked board holds whatever the admin
 * typed into the team fields. So this resolves from whatever is actually there
 * — an explicit logo first, then an abbreviation, id or name looked up in the
 * team table — and boards created before any of this get logos anyway.
 */
const CDN = "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard";

export function teamLogoUrl(team) {
  if (!team) return null;

  // A bare string: a typed team name, an abbreviation, or an ESPN id.
  if (typeof team === "string") {
    const found = findTeam(team);
    return found ? `${CDN}/${found.abbr.toLowerCase()}.png` : null;
  }

  if (team.logo) return team.logo;

  const found = findTeam(team.abbr) || findTeam(team.id) || findTeam(team.name);
  return found ? `${CDN}/${found.abbr.toLowerCase()}.png` : null;
}
