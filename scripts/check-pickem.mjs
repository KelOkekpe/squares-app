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
  /Add at least one place for players to send payment/.test(modal)
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

// ── paying for a pick'em entry ──
const payStepSrc = readFile("../src/components/pickem/PickemPaymentStep.jsx");
const refSql = readFile("../supabase/migration_pickem_ref.sql");
const newBoard = readFile("../src/components/admin/NewBoardModal.jsx");

// The whole point: the link opens with the money already in it.
check(
  "the fee is passed to the payment link",
  /buildPaymentLink\(provider\.key, handle, fee, note\)/.test(payStepSrc)
);
check("the note carries the reference", /buildPaymentNote\(/.test(payStepSrc));
check(
  "the fee is shown before they pay",
  /Entry fee/.test(payStepSrc) && /\$\{amount\}/.test(payStepSrc)
);

// Generated once per sheet. Regenerating on submit would print one code and
// send another, leaving the player quoting a reference nobody can match.
check(
  "the reference is generated once per sheet",
  /useState\(\(\) => generatePaymentRef\(\)\)/.test(sheet)
);

// One player must not be able to read another's reference, so it goes to the
// admin-only table rather than the blob list_picks returns.
const refEntryBlob = refSql.slice(
  refSql.indexOf("v_entry := jsonb_build_object("),
  refSql.indexOf("-- One sheet per email")
);
check(
  "the reference is stored admin-side, not in the readable blob",
  /payment_ref/.test(refSql) && !/paymentRef/.test(refEntryBlob)
);
check(
  "a pasted reference is sanitised before storage",
  /regexp_replace\(coalesce\(p_contact ->> 'paymentRef'/.test(refSql)
);

// A free contest is a real choice, but it has to be a deliberate one.
check(
  "creating a pick'em requires a fee to be set",
  /Set an entry fee \(enter 0 for a free contest\)/.test(newBoard)
);
check("the fee reaches the new board's config", /entryFee: gameType === "pickem"/.test(newBoard));

// Every provider is offered at creation, but only one has to be filled — an
// organiser who takes money three ways shouldn't have to return to the admin
// panel to say so.
check(
  "all payment methods are offered at creation",
  /PAYMENT_PROVIDERS\.map\(\(pv\) => \(/.test(newBoard)
);
check("the form says only one is required", /Only one is required/.test(newBoard));
check(
  "but at least one is still enforced",
  /if \(!filledMethods\.length\)[\s\S]{0,140}Add at least one place/.test(newBoard)
);
// A blank field must not become an empty handle: configuredProviders() would
// then offer players a method with nothing behind it.
check(
  "blank methods are dropped rather than stored empty",
  /filledMethods\.map\(\(pv\) => \[pv\.key, String\(payHandles\[pv\.key\]\)\.trim\(\)\]\)/.test(
    newBoard
  )
);

// ── a paid entry has to be confirmed before it counts ──
// Squares entries already work this way. Pick'em sheets went straight into the
// standings, so anyone could submit and appear to be leading without paying.
const standingsSrc = readFile("../src/components/pickem/Standings.jsx");
const approvalSql = readFile("../supabase/migration_pickem_approval.sql");

check(
  "a charging contest counts only confirmed sheets",
  /requiresPayment \? all\.filter\(\(e\) => e\.paid\) : all/.test(standingsSrc)
);
// Only ever about the reader's own sheet. A running count of who else has not
// paid is the admin's business, and putting it in front of the whole pool told
// everyone about everyone.
check(
  "the standings only mention the reader's own unconfirmed sheet",
  /yoursAwaiting/.test(standingsSrc) && /myEntryId\(poolId\)/.test(standingsSrc)
);
check(
  "no tally of other people's payment status",
  !/sheets? not counted|sheets? waiting on payment/.test(standingsSrc)
);
// Needs the entry id to know which sheet is theirs.
check("the submitted entry id is kept locally", /entryId: result\.entry\?\.id/.test(sheet));

// The picks themselves must still be recorded on arrival — they have to be
// locked in before kickoff, and a queue would lose them.
check(
  "the sheet is still recorded immediately",
  /INSERT INTO spaces[\s\S]{0,200}'picks'/.test(approvalSql)
);

// A free contest has nothing to confirm; leaving those pending would strand
// every player behind an approval that never comes.
check("a free contest confirms itself", /'paid', \(v_fee <= 0\)/.test(approvalSql));
// Reading the fee from the request would let a client declare itself free.
check(
  "the fee is read from the board, not the caller",
  /SELECT coalesce\(\(value ->> 'entryFee'\)::numeric, 0\) INTO v_fee FROM spaces/.test(approvalSql)
);
// Sheets submitted before the gate existed were never going to be confirmed.
check(
  "existing sheets are grandfathered rather than dropped",
  /WHEN e \? 'paid' THEN e[\s\S]{0,80}jsonb_build_object\('paid', true\)/.test(approvalSql)
);

// Scoring itself stays payment-blind: the filter belongs to the view, not the
// rules of the game.
check("rankEntries is not aware of payment", !/paid/.test(readFile("../src/utils/pickem.js")));

// ── emailing a sheet the player cannot see ──
// Picks stay hidden until the first kickoff so nobody can copy them, which
// leaves the player with no record of what they chose.
const sendPicks = readFile("../api/send-picks.js");
const emailTpl = readFile("../api/_lib/pickEmail.js");
const modalSrc = readFile("../src/components/pickem/PicksSubmitted.jsx");
const indexHtml = readFile("../index.html");

// The recipient must never come from the request, or this is a way to mail
// anyone anything.
check(
  "the recipient is looked up, never supplied by the caller",
  /from\("pickem_contacts"\)[\s\S]{0,200}\.eq\("entry_id", entryId\)/.test(sendPicks) &&
    !/to: (req\.body|email)\b/.test(sendPicks)
);
check("only a recently submitted entry can be mailed", /RECENT_MS/.test(sendPicks));
// The picks are already saved by the time this runs.
check(
  "a provider outage does not read as a failed submission",
  /sent: false, reason: "provider_error"/.test(sendPicks)
);
check(
  "the client does not await the send",
  /fetch\("\/api\/send-picks"[\s\S]{0,240}\.catch\(/.test(readFile("../src/hooks/usePickem.js"))
);

// Email clients agree on tables and inline styles and nothing else.
check(
  "the sheet renders as a table, not flex",
  /<table/.test(emailTpl) && !/display:\s*flex/.test(emailTpl)
);
check("the picked side is filled", /background:\$\{chosen \? PURPLE/.test(emailTpl));
check("player-supplied values are escaped", /escape\(playerName\)/.test(emailTpl));
// An HTML-only message scores worse with spam filters, and a new sending
// subdomain has no reputation to spend.
check(
  "a plain-text alternative is sent too",
  /text,/.test(sendPicks) && /renderPicksText/.test(emailTpl)
);

// The confirmation is a dialog now: as a panel it sat above the standings it
// was pointing at, permanently.
check(
  "the confirmation is a dismissible overlay",
  /position: "fixed"[\s\S]{0,200}zIndex: 1000/.test(modalSrc)
);
check(
  "dismissing lands on the standings",
  /onDone=\{\(\) => \{[\s\S]{0,80}onViewStandings\?\.\(\)/.test(sheet)
);
check(
  "the check mark is drawn, not faded in",
  /sp-check-mark/.test(modalSrc) && /@keyframes sp-check-mark/.test(indexHtml)
);
check(
  "reduced motion still shows a finished check",
  /prefers-reduced-motion[\s\S]{0,260}stroke-dashoffset: 0/.test(indexHtml)
);
// Otherwise "why can't I see my own picks?" is the first support message.
check("the modal explains why the picks are hidden", /hidden[\s\S]{0,60}kickoff/.test(modalSrc));

// ── what the browser remembers ──
// Players have no account, so without this a pick'em player retypes their name,
// email and payout details every week of the season.
const store = readFile("../src/utils/playerStore.js");
const access = readFile("../src/hooks/useSpaceAccess.js");
const board = readFile("../src/GameBoard.jsx");

// localStorage throws outright in Safari private mode.
check("every read and write is guarded", /try \{[\s\S]{0,200}localStorage/.test(store));
// The squares form knows first/last, the pick'em sheet knows one display name.
// Pruning empties from the merged result deleted keys loadProfile() had
// defaulted to "", so submitting one form wiped what the other had learned.
check(
  "a partial save cannot wipe what the other form stored",
  /Object\.entries\(patch \|\| \{\}\)\.filter\(meaningful\)/.test(store)
);
// Remembering a rejected attempt would prefill something the server refused.
check(
  "details are only remembered after the server accepts",
  /saveProfile\([\s\S]{0,300}setRequestSubmitted\(true\)/.test(board)
);

// The picks themselves, not just an id: everyone's stay hidden until kickoff,
// so the server will not return them.
check(
  "a submitted sheet is kept locally",
  /saveSheet\(poolId, \{ picks: sheet, tiebreak, entryId/.test(sheet)
);
check("and is used to prefill", /loadSheet\(poolId\)/.test(sheet));

// Was sessionStorage, so the password came back every time the tab closed.
check(
  "a private-space unlock survives closing the tab",
  /rememberUnlocked\(spaceCode\)/.test(access)
);
check("it is no longer session-only", !/sessionStorage/.test(access));

// None of this may be load-bearing: it is a convenience, and the database
// remains the only thing that decides anything.
check(
  "nothing local is sent to the server as truth",
  !/loadProfile\(\)[\s\S]{0,80}rpc\(/.test(board)
);

// The confirm control read as a status label, so nobody realised it was the
// thing that marks someone paid.
check(
  "the admin control names the action, not the state",
  /Mark as Paid/.test(readFile("../src/components/admin/PickemSettingsSection.jsx"))
);

// ── confirming a payment tells the player ──
const entriesHook = readFile("../src/hooks/usePickemEntries.js");

check(
  "confirming a pick'em entry emails them",
  /sendConfirmationEmail\(\{ spaceCode, poolId, entryId, kind: "pickem" \}\)/.test(entriesHook)
);
// Un-marking is a correction; "your entry no longer counts" is a conversation
// for the admin to have, not an automated email.
check("un-marking someone sends nothing", /!result\?\.error && paid/.test(entriesHook));
// The grid stores names, so which squares someone owns is knowable only at
// approval — the email has to carry them or they are lost.
check(
  "a squares approval emails the coordinates",
  /kind: "squares"[\s\S]{0,140}coords: formatCoordinates/.test(board)
);

// send-confirmation looks the recipient up by entry id rather than trusting the
// caller, so sending before the contact row is written races the lookup — the
// server finds nothing and gives up silently. The write has to land first.
const approveBody = board.slice(
  board.indexOf("const approveEntry"),
  board.indexOf("const smartFill")
);
check(
  "the contact row is written before the email is sent",
  approveBody.includes("await saveContact(") &&
    approveBody.indexOf("await saveContact(") < approveBody.indexOf("sendConfirmationEmail(")
);
check(
  "and no email is attempted if that write failed",
  /saved\?\.error\s*\?[\s\S]{0,120}:\s*await sendConfirmationEmail/.test(approveBody)
);
// Same ordering on the pick'em side: the RPC is awaited before the send.
check(
  "confirming a pick'em entry awaits the write too",
  /const result = await mutate\([\s\S]{0,400}sendConfirmationEmail/.test(entriesHook)
);

// ── the admin needs to see work waiting on a board they are not looking at ──
const poolAdmin = readFile("../src/hooks/usePoolAdmin.js");
const panel = readFile("../src/components/admin/AdminPanel.jsx");

// One number per board covering both mechanisms — an admin cares that
// something is waiting, not which queue it sits in.
check("pending counts include pick'em sheets", /row\.type === "picks"/.test(poolAdmin));
check("and still include squares entry requests", /row\.type === "pending"/.test(poolAdmin));
// A free contest confirms itself, so an unpaid flag there would be permanent.
check(
  "a free contest contributes nothing",
  /row\.type === "picks" && Number\(nextConfigs\[row\.pool_id\]\?\.entryFee\) > 0/.test(poolAdmin)
);
// A <select> shows one row at a time, so the label has to carry it.
check("the picker names pending submissions", /PENDING SUBMISSION/.test(panel));
check("the tab carries a count", /t\.key === "board" && totalPending > 0/.test(panel));

// ── the manual email is a fallback, not a duplicate ──
// Approval emails the player their coordinates. Leaving the mailto button there
// unconditionally asked the admin to do by hand what had already happened, and
// if they did it the player got the same message twice.
const noticeSrc = readFile("../src/components/admin/ApprovalNotice.jsx");
check(
  "the manual send only appears when the automatic one failed",
  /\{!notice\.emailed && \(/.test(noticeSrc)
);
check("a successful send says so", /emailed to \{entry\.email\}/.test(noticeSrc));
// Guessing either way leaves the admin lied to or nagged, so the real outcome
// has to come back from the endpoint.
check(
  "the send reports its outcome",
  /const result = \(await res\.json\(\)/.test(readFile("../src/utils/notify.js"))
);
check("and the approval records it", /\{ \.\.\.n, emailed: !!emailed\?\.sent/.test(board));

console.log(failed === 0 ? "\nAll pick'em cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
