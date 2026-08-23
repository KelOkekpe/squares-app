/**
 * The 32 NFL teams, by ESPN's ids.
 *
 * Boards store whatever they happened to have at the time: a pick'em slate
 * keeps an abbreviation, a squares board linked to a game keeps only ESPN's
 * numeric team id, and an unlinked board keeps whatever the admin typed. This
 * table is what lets all three resolve to the same team without a migration.
 *
 * Generated from ESPN's teams endpoint; ids and abbreviations are stable.
 */
export const NFL_TEAMS = [
  { id: "1", abbr: "ATL", name: "Atlanta Falcons", location: "Atlanta", nick: "Falcons" },
  { id: "2", abbr: "BUF", name: "Buffalo Bills", location: "Buffalo", nick: "Bills" },
  { id: "3", abbr: "CHI", name: "Chicago Bears", location: "Chicago", nick: "Bears" },
  { id: "4", abbr: "CIN", name: "Cincinnati Bengals", location: "Cincinnati", nick: "Bengals" },
  { id: "5", abbr: "CLE", name: "Cleveland Browns", location: "Cleveland", nick: "Browns" },
  { id: "6", abbr: "DAL", name: "Dallas Cowboys", location: "Dallas", nick: "Cowboys" },
  { id: "7", abbr: "DEN", name: "Denver Broncos", location: "Denver", nick: "Broncos" },
  { id: "8", abbr: "DET", name: "Detroit Lions", location: "Detroit", nick: "Lions" },
  { id: "9", abbr: "GB", name: "Green Bay Packers", location: "Green Bay", nick: "Packers" },
  { id: "10", abbr: "TEN", name: "Tennessee Titans", location: "Tennessee", nick: "Titans" },
  { id: "11", abbr: "IND", name: "Indianapolis Colts", location: "Indianapolis", nick: "Colts" },
  { id: "12", abbr: "KC", name: "Kansas City Chiefs", location: "Kansas City", nick: "Chiefs" },
  { id: "13", abbr: "LV", name: "Las Vegas Raiders", location: "Las Vegas", nick: "Raiders" },
  { id: "14", abbr: "LAR", name: "Los Angeles Rams", location: "Los Angeles", nick: "Rams" },
  { id: "15", abbr: "MIA", name: "Miami Dolphins", location: "Miami", nick: "Dolphins" },
  { id: "16", abbr: "MIN", name: "Minnesota Vikings", location: "Minnesota", nick: "Vikings" },
  { id: "17", abbr: "NE", name: "New England Patriots", location: "New England", nick: "Patriots" },
  { id: "18", abbr: "NO", name: "New Orleans Saints", location: "New Orleans", nick: "Saints" },
  { id: "19", abbr: "NYG", name: "New York Giants", location: "New York", nick: "Giants" },
  { id: "20", abbr: "NYJ", name: "New York Jets", location: "New York", nick: "Jets" },
  { id: "21", abbr: "PHI", name: "Philadelphia Eagles", location: "Philadelphia", nick: "Eagles" },
  { id: "22", abbr: "ARI", name: "Arizona Cardinals", location: "Arizona", nick: "Cardinals" },
  { id: "23", abbr: "PIT", name: "Pittsburgh Steelers", location: "Pittsburgh", nick: "Steelers" },
  {
    id: "24",
    abbr: "LAC",
    name: "Los Angeles Chargers",
    location: "Los Angeles",
    nick: "Chargers",
  },
  { id: "25", abbr: "SF", name: "San Francisco 49ers", location: "San Francisco", nick: "49ers" },
  { id: "26", abbr: "SEA", name: "Seattle Seahawks", location: "Seattle", nick: "Seahawks" },
  { id: "27", abbr: "TB", name: "Tampa Bay Buccaneers", location: "Tampa Bay", nick: "Buccaneers" },
  {
    id: "28",
    abbr: "WSH",
    name: "Washington Commanders",
    location: "Washington",
    nick: "Commanders",
  },
  { id: "29", abbr: "CAR", name: "Carolina Panthers", location: "Carolina", nick: "Panthers" },
  {
    id: "30",
    abbr: "JAX",
    name: "Jacksonville Jaguars",
    location: "Jacksonville",
    nick: "Jaguars",
  },
  { id: "33", abbr: "BAL", name: "Baltimore Ravens", location: "Baltimore", nick: "Ravens" },
  { id: "34", abbr: "HOU", name: "Houston Texans", location: "Houston", nick: "Texans" },
];

const byId = new Map(NFL_TEAMS.map((t) => [t.id, t]));
const byAbbr = new Map(NFL_TEAMS.map((t) => [t.abbr.toLowerCase(), t]));
// Full name, city and nickname all match, because an admin typing a board's
// teams by hand writes "Seahawks" as readily as "Seattle Seahawks".
const byName = new Map();
for (const t of NFL_TEAMS) {
  for (const key of [t.name, t.location, t.nick]) byName.set(key.toLowerCase(), t);
}

/** Look a team up by ESPN id, abbreviation, or any reasonable spelling of its name. */
export function findTeam(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return byId.get(raw) || byAbbr.get(raw.toLowerCase()) || byName.get(raw.toLowerCase()) || null;
}
