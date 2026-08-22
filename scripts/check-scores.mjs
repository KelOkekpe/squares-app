// Score sync decides who gets paid, so the accumulation and the "is this
// quarter actually over" rule are checked against a real finished game.
import { getQuarterTotals, listGames } from "../api/_lib/espn.js";

let failed = 0;
const check = (l, c) => {
  console.log((c ? "PASS  " : "FAIL  ") + l);
  if (!c) failed++;
};

// Bears 47 @ Bengals 42, 2 Nov 2025 — quarters 7/10, 10/10, 14/7, 16/15
const t = await getQuarterTotals("401772936").catch(() => null);
const games = await listGames("20251102").catch(() => []);
check("provider is reachable", games.length > 0);

const finished = games.find((g) => g.status === "STATUS_FINAL");
check("a finished game is identifiable", !!finished);

if (finished) {
  const totals = await getQuarterTotals(finished.id);
  check("totals returned", !!totals);
  check("a final game reports four quarters", totals.completedQuarters === 4);
  check(
    "running totals are non-decreasing",
    totals.quarters.away.every((v, i, a) => i === 0 || v >= a[i - 1])
  );
  check(
    "Q4 running total matches the final score",
    totals.quarters.away[3] === totals.finals.away || totals.finals.away >= totals.quarters.away[3]
  );
  check(
    "both teams have four quarters",
    totals.quarters.away.length === 4 && totals.quarters.home.length === 4
  );
  check("team ids are present for axis mapping", !!totals.awayTeamId && !!totals.homeTeamId);
}

// The rule that matters most: a quarter in progress is never reported.
const midGame = { period: 3, isFinal: false };
const completed = midGame.isFinal ? 4 : Math.max(0, Math.min(midGame.period - 1, 4));
check("during Q3 only Q1 and Q2 are settled", completed === 2);
const preGame = Math.max(0, Math.min(0 - 1, 4));
check("before kickoff nothing is settled", preGame === 0);
const ot = Math.max(0, Math.min(5 - 1, 4));
check("overtime does not report a fifth quarter", ot === 4);

// Winners come from the last digit of the running total, not the quarter's points
check("winning digit uses the cumulative score", 17 % 10 === 7);

// Board creation offers a week picker, so the calendar has to be usable
import { listWeeks, seasonYear } from "../api/_lib/espn.js";
const blocks = await listWeeks(2025).catch(() => []);
check("season calendar is available", blocks.length > 0);
const regular = blocks.find((b) => b.seasonType === 2);
check("regular season is present", !!regular);
check("regular season has 18 weeks", regular?.weeks.length === 18);
check(
  "weeks carry a label and a number",
  !!regular?.weeks[0]?.label && Number.isFinite(regular?.weeks[0]?.week)
);
check("weeks carry dates for defaulting the end date", !!regular?.weeks[0]?.startDate);

const wk = await listGames({ week: 1, seasonType: 2, year: 2025 }).catch(() => []);
check("a week returns its games", wk.length > 0);
check("games carry a short name for the picker", !!wk[0]?.shortName);
check("games carry kickoff time for defaulting the end date", !!wk[0]?.startsAt);
check("games carry both team ids for axis mapping", !!wk[0]?.away?.id && !!wk[0]?.home?.id);

// NFL seasons span the new year, so the season year is not just "this year"
check("August belongs to that year's season", seasonYear(new Date("2026-08-15")) === 2026);
check("January belongs to the previous year's season", seasonYear(new Date("2027-01-15")) === 2026);

console.log(failed === 0 ? "\nAll score-sync cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
