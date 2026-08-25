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
import { NFL_TEAMS, findTeam } from "../src/utils/nflTeams.js";
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

// Squares boards never stored an abbreviation. A linked board kept ESPN's
// numeric team id and an unlinked one keeps whatever the admin typed, so both
// have to resolve through the team table or the grid headers stay blank.
check("an ESPN team id resolves", teamLogoUrl({ id: "20" }).endsWith("/nyj.png"));
check("a typed full name resolves", teamLogoUrl("Seattle Seahawks").endsWith("/sea.png"));
check("a typed nickname resolves", teamLogoUrl("Packers").endsWith("/gb.png"));
check("a typed city resolves", teamLogoUrl("Cincinnati").endsWith("/cin.png"));
check("free text resolves to nothing", teamLogoUrl("The Office Champs") === null);
check("all 32 teams are present", NFL_TEAMS.length === 32);
check(
  "every team resolves by id, abbr and name",
  NFL_TEAMS.every(
    (t) =>
      findTeam(t.id)?.abbr === t.abbr &&
      findTeam(t.abbr)?.abbr === t.abbr &&
      findTeam(t.name)?.abbr === t.abbr
  )
);

// The Y-axis banner used to rotate its whole container. A logo inside would
// have been turned on its side with the text.
const grid = readFileSync(
  new URL("../src/components/grid/SquaresGrid.jsx", import.meta.url),
  "utf8"
);
const yBanner = grid.slice(grid.indexOf("Y-axis team banner"), grid.indexOf("Y-axis numbers"));
check(
  "the Y banner rotates its text, not the whole banner",
  !/transform: "rotate\(180deg\)"[\s\S]{0,400}<TeamLogo/.test(yBanner) &&
    /<TeamLogo[\s\S]{0,400}transform: "rotate\(180deg\)"/.test(yBanner)
);
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
    readFileSync(new URL("../src/components/common/TeamLogo.jsx", import.meta.url), "utf8")
  )
);

// ── the pick'em entry flow ──
const readFile = (rel) =>
  readFileSync(new URL(rel, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
const sheet = readFile("../src/components/pickem/PickSheet.jsx");
const payoutSql = readFile("../supabase/migration_pickem_payout.sql");
const picker = readFile("../src/components/join/PayoutPicker.jsx");

// One method at a time. Showing all three handle fields asked people to fill in
// accounts they would never be paid through.
// The handle field is rendered only once a method is chosen. Matching on
// "PAYOUT_METHODS.map ... <input" caught the <option> list instead.
check(
  "the payout picker offers one method at a time",
  /<select/.test(picker) && /\{selected && \(\s*<input/.test(picker)
);
check("clearing the method clears the handle", /if \(!next\) setHandles\(\{\}\)/.test(picker));

// A pick'em winner is owed money exactly as a squares winner is.
check("the pick sheet asks how to pay a winner", /<PayoutPicker/.test(sheet));
check("payout details are sent with the sheet", /payoutMethod,\s*payoutHandles,/.test(sheet));
// The blob every player can read is built by jsonb_build_object; payout must
// not appear there. Testing the whole file for 'payoutMethod' matched the
// coalesce() that *reads* it from the request, which is the correct usage.
const entryBlob = payoutSql.slice(
  payoutSql.indexOf("v_entry := jsonb_build_object("),
  payoutSql.indexOf("-- One sheet per email")
);
check(
  "payout is stored admin-side, not in the readable blob",
  /INSERT INTO public\.pickem_contacts[\s\S]{0,200}payout_method/.test(payoutSql) &&
    !/payout/i.test(entryBlob)
);

// A free contest must not show a payment step at all.
const payStep = readFile("../src/components/pickem/PickemPaymentStep.jsx");
check("a free contest shows no payment step", /if \(fee <= 0\) return null/.test(payStep));
check("the fee is read from config, not the request", /config\?\.entryFee/.test(payStep));

// The confirmation, matching the squares one.
const submitted = readFile("../src/components/pickem/PicksSubmitted.jsx");
check("submitting picks shows a confirmation", /<PicksSubmitted/.test(sheet));
check(
  "it offers standings rather than a board",
  /View Standings/.test(submitted) && !/View Board/.test(submitted)
);

// The message players used to hit with nothing they could do about it.
const modal = readFile("../src/components/admin/NewBoardModal.jsx");
check(
  "creating a board requires somewhere to send payment",
  /Add where players should send payment/.test(modal)
);
check("the handle is prefilled from the space's last one", /lastPayment/.test(modal));

// Pick'em admins had no way to set payment details at all.
const pickemAdmin = readFile("../src/components/admin/PickemSettingsSection.jsx");
check("pick'em admins can set payment details", /<PaymentDetailsSection/.test(pickemAdmin));
check("pick'em admins can set an entry fee", /entryFee/.test(pickemAdmin));

// ── getting to the picks ──
// A single "Picks & standings" button asked people to work out that the thing
// they came to do was inside it.
const home = readFile("../src/components/layout/HomeView.jsx");
check("making picks is its own primary action", /Make Your Picks/.test(home));
check("standings is a separate button", /onOpenPickem\("standings"\)/.test(home));
check("the old combined button is gone", !/Picks &amp; standings|Picks & standings/.test(home));
// Once locked there is nothing to make, so standings takes the primary slot
// rather than leaving a dead button above them.
check("a locked week promotes standings to primary", /picksClosed \?/.test(home));

// Arriving via "Make Your Picks" should land on the sheet already open,
// otherwise it is the same one-bar screen as before with an extra tap.
const view = readFile("../src/components/pickem/PickemView.jsx");
check("the intent reaches the sheet", /defaultOpen=\{intent === "picks"\}/.test(view));
check("the sheet honours it", /useState\(defaultOpen\)/.test(sheet));

// btnSecondary alone reads as disabled beside a filled primary.
// Counting occurrences was too loose — the file has others, so removing one
// still cleared the threshold. Tied to the two buttons that were dim.
for (const label of ["View Board", "Standings"]) {
  check(
    `"${label}" is not dimmed to look disabled`,
    new RegExp(`color: colors\\.accentViolet,?[\\s\\S]{0,120}${label}`).test(home)
  );
}

console.log(failed === 0 ? "\nAll pick'em cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
