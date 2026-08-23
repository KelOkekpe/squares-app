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
import { teamLogoUrl } from "../src/utils/teamLogo.js";
import { readFileSync } from "node:fs";

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

// ── standings only reveal sheets once picks are locked ──
// The whole point of hiding them is that a visible sheet before kickoff is a
// sheet to copy. Standings must gate on the same lock that closes submission,
// never on "some game is graded" (which would expose the rest of the week's
// picks the moment one early game went final).
const standings = readFileSync(
  new URL("../src/components/pickem/Standings.jsx", import.meta.url),
  "utf8"
);
check(
  "standings gate the reveal on isSlateLocked",
  /revealed\s*=\s*isSlateLocked\(/.test(standings)
);
check(
  "the breakdown is not rendered while picks are open",
  /revealed && open && <PicksBreakdown/.test(standings)
);
check(
  "a locked slate reveals, an open one does not",
  isSlateLocked(past) === true && isSlateLocked(future) === false
);

// ── sheets must not be read straight off the row ──
// `picks` is admin-only in the database so the lock can be enforced server
// side. Reading it with usePersistedState would get an empty list for players
// and, worse, writing that back would erase everyone's sheets.
const hookSrc = readFileSync(new URL("../src/hooks/usePickem.js", import.meta.url), "utf8");
const boardSrc = readFileSync(new URL("../src/GameBoard.jsx", import.meta.url), "utf8");
check(
  "no component reads keys.picks as persisted state",
  !/usePersistedState\(\s*keys\.picks/.test(hookSrc + boardSrc)
);
check(
  "entries come from the list_picks RPC",
  /rpc\("list_picks"/.test(
    readFileSync(new URL("../src/hooks/usePickemEntries.js", import.meta.url), "utf8")
  )
);
// The migration is the only thing standing between an anonymous caller and
// every entrant's sheet, so the policy has to actually name 'picks'.
const privacySql = readFileSync(
  new URL("../supabase/migration_pickem_privacy.sql", import.meta.url),
  "utf8"
);
check(
  "spaces_select excludes picks as well as pending",
  /type NOT IN \('pending', 'picks'\)/.test(privacySql)
);
check(
  "contact details are never written into the blob",
  !/'email', v_email/.test(privacySql) && /'emailHash', v_hash/.test(privacySql)
);

// ── team logos ──
// Slates are frozen at creation, so every contest that already exists has no
// logo stored. The URL is derivable from the abbreviation, which is what keeps
// those working without a backfill.
check(
  "a stored logo is preferred",
  teamLogoUrl({ abbr: "PHI", logo: "https://example.com/x.png" }) === "https://example.com/x.png"
);
check(
  "a missing logo is derived from the abbreviation",
  teamLogoUrl({ abbr: "PHI" }) === "https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/phi.png"
);
check("derivation lower-cases the abbreviation", teamLogoUrl({ abbr: "WSH" }).endsWith("/wsh.png"));
// A hand-built slate can carry any label at all; guessing a URL for one just
// renders a broken image next to somebody's pick.
check("a non-abbreviation team yields no logo", teamLogoUrl({ name: "The Ducks" }) === null);
check("an empty team yields no logo", teamLogoUrl(null) === null && teamLogoUrl({}) === null);
check(
  "the slate stores logos going forward",
  /logo: away\.team\?\.logo/.test(
    readFileSync(new URL("../api/_lib/espn.js", import.meta.url), "utf8")
  )
);
// Without the error fallback a dead CDN leaves a broken-image glyph on every row.
check(
  "a failed logo removes itself",
  /onError=\{\(\) => setFailed\(true\)\}/.test(
    readFileSync(new URL("../src/components/pickem/TeamLogo.jsx", import.meta.url), "utf8")
  )
);

console.log(failed === 0 ? "\nAll pick'em cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
