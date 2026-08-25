// Board lifecycle: the JS view of "active" must match the SQL trigger's, or the
// UI will offer a board slot the database then refuses.
import { readFileSync } from "node:fs";
import { POOL_STATE_TYPES } from "../src/utils/storageKeys.js";
import {
  isPoolActive,
  isPoolCompleted,
  splitPools,
  poolStatus,
  todayISO,
  addDaysISO,
  MAX_ACTIVE_POOLS,
  deadlineAt,
  isPastDeadline,
  DEADLINE_LEAD_MS,
} from "../src/utils/poolStatus.js";

let failed = 0;
const check = (l, c) => {
  console.log((c ? "PASS  " : "FAIL  ") + l);
  if (!c) failed++;
};

const future = addDaysISO(10),
  past = addDaysISO(-3),
  today = todayISO();

check(
  "active while unarchived and future-dated",
  isPoolActive({ archived: false, expiresAt: future })
);
check(
  "expiry day itself still counts as active",
  isPoolActive({ archived: false, expiresAt: today })
);
check("past expiry is completed", isPoolCompleted({ archived: false, expiresAt: past }));
check(
  "archived is completed even if future-dated",
  isPoolCompleted({ archived: true, expiresAt: future })
);
check(
  "pre-migration board (no expiry) stays active",
  isPoolActive({ archived: false, expiresAt: null })
);
check("null pool is neither", !isPoolActive(null) && !isPoolCompleted(null));

const pools = [
  { id: "a", archived: false, expiresAt: future },
  { id: "b", archived: false, expiresAt: past },
  { id: "c", archived: true, expiresAt: future },
  { id: "d", archived: false, expiresAt: null },
];
const { active, completed } = splitPools(pools);
check("split partitions completely", active.length + completed.length === pools.length);
check("split puts the right ones in active", active.map((p) => p.id).join() === "a,d");

check(
  "expiring today reads urgent",
  poolStatus({ archived: false, expiresAt: today }).tone === "accentRed"
);
check(
  "expiring in a week reads as a warning",
  poolStatus({ archived: false, expiresAt: addDaysISO(5) }).tone === "accentOrange"
);
check(
  "far-off expiry is neutral",
  poolStatus({ archived: false, expiresAt: addDaysISO(60) }).tone === "textDim"
);

// The cap must be the same number on both sides
const sql = readFileSync(
  new URL("../supabase/migration_pool_lifecycle.sql", import.meta.url),
  "utf8"
);
const m = sql.match(/v_limit CONSTANT INT :=\s*(\d+)/);
check(`cap agrees with SQL (${MAX_ACTIVE_POOLS})`, m && Number(m[1]) === MAX_ACTIVE_POOLS);
check("SQL requires an expiry on insert", /TG_OP = 'INSERT' AND NEW\.expires_at IS NULL/.test(sql));

// addDaysISO must not drift across month boundaries
check("addDaysISO(30) is a valid ISO date", /^\d{4}-\d{2}-\d{2}$/.test(addDaysISO(30)));
check("addDaysISO(30) is later than today", addDaysISO(30) > today);
check("addDaysISO(-1) is earlier than today", addDaysISO(-1) < today);

// Reset must clear every per-pool state type except the config. The original
// bug was that it cleared board/scores/participants but left the pending queue
// and never reshuffled the numbers, so a "reset" board could regain entries and
// kept its old coordinates.
const gameBoard = readFileSync(new URL("../src/GameBoard.jsx", import.meta.url), "utf8");
const resetBody = gameBoard.slice(
  gameBoard.indexOf("const resetPool = useCallback"),
  gameBoard.indexOf("const toggleSubmissions")
);
check("reset() exists", resetBody.length > 0);
for (const [type, setter] of [
  ["board", "setBoard(freshBoard)"],
  ["headers", "setHeaders(freshHeaders)"],
  ["participants", "setParticipants([])"],
  ["pending", "setPending([])"],
  ["scores", "setScores({})"],
]) {
  check(`reset clears ${type}`, resetBody.includes(setter));
}
check(
  "reset preserves the admin config (price, teams, payment details)",
  !resetBody.includes("setConfig(")
);
// A pick'em contest resets differently: sheets go, the slate's grading is
// undone, but the games themselves stay — they are the contest.
// Sheets are cleared through the RPC now — the client no longer holds the
// full blob, so it has nothing safe to write back.
check("reset clears pick'em sheets", resetBody.includes("clearPickEntries()"));
check("reset un-grades the slate", /winner, total, awayScore, homeScore/.test(resetBody));
check("reset keeps the slate's games", resetBody.includes("games: (s.games || []).map"));
// Anything new in POOL_STATE_TYPES should be considered here too
// slate/picks are cleared on the pick'em branch of the same function
const covered = [
  "board",
  "headers",
  "participants",
  "pending",
  "scores",
  "admin",
  "slate",
  "picks",
];
const uncovered = POOL_STATE_TYPES.filter((t) => !covered.includes(t));
check(
  `no per-pool state type is unaccounted for by reset${uncovered.length ? ` (${uncovered})` : ""}`,
  uncovered.length === 0
);

// The admin console selects a board to edit it. Handing it the navigating
// switchPool sent the view home, closing the panel the selection was made in —
// which looked like the board and pick'em settings had vanished.
const gb = readFileSync(new URL("../src/GameBoard.jsx", import.meta.url), "utf8");
check(
  "the admin console gets a non-navigating board picker",
  /<AdminPanel[\s\S]{0,1200}onSwitchPool=\{selectPoolForAdmin\}/.test(gb)
);
check(
  "...and that picker does not change the view",
  /const selectPoolForAdmin = \(id\) => setViewingPoolId\(id\);/.test(gb)
);

// ── board names are only reserved by live boards ──
// The original table constraint covered every row, so a board that had been
// archived and then soft-deleted still owned its name and blocked a new one
// the admin could neither see nor reach.
const nameSql = readFileSync(
  new URL("../supabase/migration_pool_name_scope.sql", import.meta.url),
  "utf8"
);
check(
  "the table-wide name constraint is dropped",
  /DROP CONSTRAINT IF EXISTS unique_pool_name_per_space/.test(nameSql)
);
check(
  "the replacement index is scoped to live boards",
  /CREATE UNIQUE INDEX unique_pool_name_per_space[\s\S]{0,200}WHERE deleted_at IS NULL AND NOT coalesce\(archived, false\)/.test(
    nameSql
  )
);
check("it is still scoped per space", /ON pools \(space_code, name\)/.test(nameSql));

// Unarchiving can now be refused, so it must not be reported as success.
const poolsHook = readFileSync(new URL("../src/hooks/usePools.js", import.meta.url), "utf8");
check(
  "updatePool reports failure instead of swallowing it",
  /return \{ error: message \}/.test(poolsHook)
);
check("a rejected update rolls back the optimistic state", /setPools\(previous\)/.test(poolsHook));
check(
  "the raw duplicate-key error is translated",
  /unique_pool_name_per_space\|duplicate key/.test(poolsHook)
);
const boardMgmt = readFileSync(
  new URL("../src/components/admin/BoardManagementSection.jsx", import.meta.url),
  "utf8"
);
check(
  "a refused unarchive is shown to the admin",
  /setArchiveError\(result\.error\)/.test(boardMgmt)
);

// ── the alpha organiser cap ──
// Capping create_space() would have been the obvious place and would have
// caught almost nothing: that function only handles *private* spaces. A public
// one is a direct client insert against spaces_registry, guarded by RLS. The
// cap therefore has to sit on the table, where both paths and any future one
// must pass through it.
const capSql = readFileSync(
  new URL("../supabase/migration_alpha_cap.sql", import.meta.url),
  "utf8"
);
const capCode = capSql.replace(/--.*$/gm, "");

check(
  "the cap is a trigger on spaces_registry, not a check inside create_space",
  /CREATE TRIGGER trg_enforce_owner_cap[\s\S]{0,120}BEFORE INSERT ON spaces_registry/.test(capCode)
);
check("create_space is not where the cap lives", !/FUNCTION public\.create_space/.test(capCode));

// The cap counts people, not spaces: an organiser opening a second space must
// not consume a second slot.
check(
  "an existing owner keeps their slot",
  /EXISTS \(SELECT 1 FROM spaces_registry WHERE owner_id = p_user\)[\s\S]{0,60}RETURN TRUE/.test(
    capCode
  )
);
check("the count is of distinct owners", /count\(DISTINCT owner_id\)/.test(capCode));

// Ways out, so the gate can't strand anyone.
check("superadmins bypass the cap", /role = 'superadmin'[\s\S]{0,60}RETURN TRUE/.test(capCode));
check("an allowlist can override it", /FROM owner_allowlist/.test(capCode));
check(
  "the allowlist matches regardless of case",
  /lower\(email\) = lower\(v_email\)/.test(capCode)
);
// Your own tooling has no auth.uid(); blocking it would lock you out of your
// own database.
check(
  "the service role and SQL editor are exempt",
  /auth\.uid\(\) IS NULL[\s\S]{0,40}RETURN NEW/.test(capCode)
);

// The message reaches the admin verbatim — AdminDashboard surfaces err.message.
const capMessage = capSql.match(/RAISE EXCEPTION\s*\n?\s*'([^']+)'/);
check("the refusal explains itself in plain language", !!capMessage && capMessage[1].length > 60);
check(
  "the refusal tells them what they can still do",
  !!capMessage && /admin|invite|ask/i.test(capMessage[1])
);

// ── deadlines come from the game, not a second date field ──
// Both kickoff times are already stored: config.game.startsAt for a squares
// board, the frozen slate for pick'em. A stored deadline would be a second
// copy to keep in step when a game is rescheduled.
const soon = new Date(Date.now() + 3600e3).toISOString();
const later = new Date(Date.now() + 5 * 3600e3).toISOString();
const gone = new Date(Date.now() - 3600e3).toISOString();

check(
  "a squares deadline is ten minutes before its game",
  deadlineAt({ config: { game: { startsAt: soon } } }) ===
    new Date(soon).getTime() - DEADLINE_LEAD_MS
);
// The whole week closes together, before any of it has been played.
check(
  "a pick'em deadline is the FIRST kickoff of the week",
  deadlineAt({ slate: { games: [{ startsAt: later }, { startsAt: soon }] } }) ===
    new Date(soon).getTime() - DEADLINE_LEAD_MS
);
check(
  "entries close once the deadline passes",
  isPastDeadline({ config: { game: { startsAt: gone } } })
);
check("entries are open before it", !isPastDeadline({ config: { game: { startsAt: soon } } }));
// A squares board with no game linked has no kickoff to work from.
check(
  "with no game, the expiry date is the fallback",
  deadlineAt({ pool: { expiresAt: "2030-01-01" } }) === new Date("2030-01-01T23:59:59").getTime()
);
check("with nothing at all there is no deadline", deadlineAt({}) === null);
check("a board with no deadline never closes itself", !isPastDeadline({}));

const board = readFileSync(new URL("../src/GameBoard.jsx", import.meta.url), "utf8");
check(
  "the board honours the deadline",
  /isPastDeadline\(\{ config, slate, pool: currentPool \}\)/.test(board)
);

// A space used to arrive with an unasked-for Seahawks/Patriots board in it.
const createSpace = readFileSync(
  new URL("../src/hooks/useCreateSpace.js", import.meta.url),
  "utf8"
);
check("a new space creates no board", !/from\("pools"\)[\s\S]{0,80}\.insert/.test(createSpace));
check("an empty space asks what to run", /<EmptySpace/.test(board));

// The label was "Ends in 3 days", which reads as when the board disappears
// rather than when entries stop.
check(
  "the status says deadline, not ends",
  /Deadline in \$\{days\} days/.test(
    readFileSync(new URL("../src/utils/poolStatus.js", import.meta.url), "utf8")
  )
);

console.log(failed === 0 ? "\nAll pool-lifecycle cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
