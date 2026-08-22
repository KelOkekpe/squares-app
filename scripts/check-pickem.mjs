// Pick'em standings decide a payout, and the tiebreaker has edge cases the
// plain rule doesn't cover. These pin down every one of them.
import {
  rankEntries,
  scoreEntry,
  isSlateLocked,
  slateLocksAt,
  tiebreakGame,
  missingPicks,
  isSlateComplete,
  gradedCount,
} from "../src/utils/pickem.js";

let failed = 0;
const check = (l, c) => {
  console.log((c ? "PASS  " : "FAIL  ") + l);
  if (!c) failed++;
};

const g = (id, winner, total, startsAt) => ({ id, winner, total, startsAt, shortName: id });
const allHome = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`g${i}`, "home"]));
const entry = (name, picks, tiebreak, submittedAt = 1) => ({
  id: name,
  name,
  picks,
  tiebreak,
  submittedAt,
});

// ── the stated example ──
const slate = {
  tiebreakGameId: "tb",
  games: [
    ...Array.from({ length: 9 }, (_, i) => g(`g${i}`, "home", null, "2026-09-13T17:00Z")),
    g("tb", "home", 43, "2026-09-14T00:20Z"),
  ],
};
const nine = { ...allHome(9), tb: "away" };
let r = rankEntries([entry("P1", nine, 40), entry("P2", nine, 44, 2)], slate);
check("closest without going over wins", r[0].entry.name === "P1");
check("the over-guess is marked busted", r[1].busted === true);
check("both are on the same correct count", r[0].correct === r[1].correct);

// ── gaps the plain rule leaves ──
r = rankEntries([entry("Over1", nine, 50), entry("Over2", nine, 44, 2)], slate);
check("if everyone busts, the closest of them still wins", r[0].entry.name === "Over2");

r = rankEntries([entry("Early", nine, 40, 1), entry("Late", nine, 40, 9)], slate);
check("identical guesses fall back to who submitted first", r[0].entry.name === "Early");

r = rankEntries([entry("Under", nine, 41), entry("Exact", nine, 43, 2)], slate);
check("an exact guess beats a near miss", r[0].entry.name === "Exact");
check("an exact guess is not treated as over", r[0].busted === false);

// ── correct count always outranks the tiebreaker ──
const ten = { ...allHome(9), tb: "home" };
r = rankEntries([entry("Nine", nine, 43), entry("Ten", ten, 1, 2)], slate);
check("more correct beats a better tiebreaker", r[0].entry.name === "Ten" && r[0].correct === 10);

// ── mid-week: only finished games count ──
const partial = {
  tiebreakGameId: "tb",
  games: [g("g0", "home"), g("g1", null), g("tb", null, null, "2026-09-14T00:20Z")],
};
const s = scoreEntry(entry("X", { g0: "home", g1: "away", tb: "home" }, 40), partial);
check("ungraded games are not counted", s.graded === 1 && s.correct === 1);
check("an unsettled tiebreaker busts nobody", s.busted === false);
check("gradedCount reports finished games only", gradedCount(partial) === 1);
check("an incomplete slate is not complete", !isSlateComplete(partial));
check("a fully graded slate is complete", isSlateComplete(slate));

// ── ties share a rank ──
r = rankEntries([entry("A", nine, 40), entry("B", nine, 40, 1), entry("C", ten, 40, 3)], slate);
check("equal standings share a rank", r[1].rank === r[2].rank);

// ── locking ──
const future = {
  games: [
    g("a", null, null, new Date(Date.now() + 3600e3).toISOString()),
    g("b", null, null, new Date(Date.now() + 7200e3).toISOString()),
  ],
};
const past = {
  games: [
    g("a", null, null, new Date(Date.now() - 3600e3).toISOString()),
    g("b", null, null, new Date(Date.now() + 7200e3).toISOString()),
  ],
};
check("a slate locks at the FIRST kickoff, not the last", isSlateLocked(past));
check("an upcoming slate is open", !isSlateLocked(future));
check(
  "lock time is the earliest kickoff",
  slateLocksAt(past) === new Date(past.games[0].startsAt).getTime()
);

// ── tiebreaker game selection ──
check("an explicit tiebreaker game is honoured", tiebreakGame(slate).id === "tb");
check("otherwise the latest kickoff is used", tiebreakGame(future).id === "b");

// ── sheet completeness ──
check("missing picks are counted", missingPicks({ a: "home" }, future) === 1);
check("a full sheet reports none missing", missingPicks({ a: "home", b: "away" }, future) === 0);

// ── degenerate input must not throw ──
check("no entries yields no rows", rankEntries([], slate).length === 0);
check("a null slate is handled", scoreEntry(entry("X", {}, 10), null).correct === 0);
check(
  "a tie result grades as neither side",
  scoreEntry(entry("X", { t: "home" }, 10), { games: [g("t", "tie")] }).correct === 0
);

console.log(failed === 0 ? "\nAll pick'em cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
