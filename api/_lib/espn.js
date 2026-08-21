/**
 * ESPN's public scoreboard. No key, no account, no cost.
 *
 * It's undocumented, so treat every field as optional and fail soft — a scores
 * sync that throws is worse than one that reports nothing this cycle. If it
 * ever goes away, only this file changes.
 */
const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary";

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`ESPN responded ${res.status}`);
  return res.json();
}

/** Games for a date (YYYYMMDD) or the current week if omitted. */
export async function listGames(dates) {
  const data = await getJson(dates ? `${SCOREBOARD}?dates=${dates}` : SCOREBOARD);
  return (data.events || []).map((event) => {
    const comp = event.competitions?.[0] || {};
    const teams = comp.competitors || [];
    const away = teams.find((t) => t.homeAway === "away") || teams[1] || {};
    const home = teams.find((t) => t.homeAway === "home") || teams[0] || {};
    return {
      id: event.id,
      name: event.name,
      shortName: event.shortName,
      startsAt: event.date,
      status: comp.status?.type?.name || "STATUS_SCHEDULED",
      away: { id: away.id, name: away.team?.displayName, abbr: away.team?.abbreviation },
      home: { id: home.id, name: home.team?.displayName, abbr: home.team?.abbreviation },
    };
  });
}

/**
 * Running totals at the end of each completed quarter.
 *
 * Squares pay on the cumulative score, but ESPN reports points scored *within*
 * each quarter, so they're accumulated here. A quarter is only reported once it
 * has actually ended — reporting a quarter still in progress would hand the
 * win to whoever happened to be ahead mid-play.
 *
 * The fourth quarter uses the final score rather than the sum, so overtime
 * lands on Q4 the way pools actually settle it.
 */
export async function getQuarterTotals(gameId) {
  const data = await getJson(`${SUMMARY}?event=${gameId}`);
  const comp = data.header?.competitions?.[0];
  if (!comp) return null;

  const status = comp.status?.type || {};
  const period = Number(comp.status?.period || 0);
  const isFinal = !!status.completed;

  const teams = comp.competitors || [];
  const away = teams.find((t) => t.homeAway === "away") || teams[1];
  const home = teams.find((t) => t.homeAway === "home") || teams[0];
  if (!away || !home) return null;

  const perQuarter = (team) =>
    (team.linescores || []).map((l) => Number(l.value ?? l.displayValue ?? 0) || 0);

  const build = (team) => {
    const quarters = perQuarter(team);
    const totals = [];
    let running = 0;
    for (let i = 0; i < Math.min(quarters.length, 4); i++) {
      running += quarters[i];
      totals.push(running);
    }
    return { totals, final: Number(team.score) || running };
  };

  const a = build(away);
  const h = build(home);

  // Only quarters that have finished. Mid-game, the current period's linescore
  // exists but is still climbing.
  const completed = isFinal ? 4 : Math.max(0, Math.min(period - 1, 4));

  return {
    gameId,
    status: status.name || "STATUS_SCHEDULED",
    isFinal,
    period,
    awayTeamId: away.id,
    homeTeamId: home.id,
    quarters: { away: a.totals, home: h.totals },
    finals: { away: a.final, home: h.final },
    completedQuarters: completed,
  };
}
