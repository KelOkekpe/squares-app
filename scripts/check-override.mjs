// Override Cell writes a square directly, which makes it the one place that can
// put a name where nobody bought it. Two failures have come from here.
//
// The first: the board is addressed by position, but the axis digits are
// shuffled, so position is never what an admin reads off the grid. The section
// took "Row (0-9)" and wrote it straight into board[row][col], which is wrong
// by an arbitrary amount on every board — an admin aiming at row 2 landed
// wherever headers.y[2] happened to sit.
//
// The second: the board and the entry list are separate stores, so a cell
// written directly left them disagreeing. A cleared square kept its entry in
// Recent Entries; an assigned one had no entry behind it at all.
import { readFileSync } from "node:fs";
import { getInitialBoard, reconcileEntries } from "../src/utils/boardLogic.js";
import { cellsToCoordinates } from "../src/utils/notify.js";

let failed = 0;
const check = (l, c) => {
  console.log((c ? "PASS  " : "FAIL  ") + l);
  if (!c) failed++;
};

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const section = src("src/components/admin/OverrideCellSection.jsx");
const panel = src("src/components/admin/AdminPanel.jsx");
const gameboard = src("src/GameBoard.jsx");

// ── the digits an admin picks must be resolved through the axes ──
check("the section resolves a digit to an index", /indexOf\(/.test(section));
check(
  "it never writes a typed number straight into the board",
  !/board\s*\[\s*(overrideRow|rowDigit)\s*\]/.test(section) && !/nb\s*\[\s*override/.test(section)
);
check(
  "the digits come from the board's own axes",
  /headers\?\.y/.test(section) && /headers\?\.x/.test(section)
);
check("the axes are handed to the section", /headers=\{headers\}/.test(panel));
check("so is the write path", /overrideCell=\{overrideCell\}/.test(panel));
check("and the panel accepts it as a prop", /^\s*overrideCell,$/m.test(panel));
check("GameBoard supplies it", /overrideCell=\{overrideCell\}/.test(gameboard));
check(
  "the write reconciles the entry list",
  /reconcileEntries\(participants, next\)/.test(gameboard)
);
check(
  "and drops contacts for entries left holding nothing",
  /for \(const id of removedIds\) removeContact\(id\)/.test(gameboard)
);

// A picker cannot offer a digit that is not on the axis, which is what makes
// the old mistake unreachable rather than merely documented.
const headers = { y: [7, 0, 1, 2, 9, 4, 3, 5, 8, 6], x: [5, 8, 1, 2, 0, 9, 7, 4, 6, 3] };
const resolve = (rowDigit, colDigit) => [headers.y.indexOf(rowDigit), headers.x.indexOf(colDigit)];
let allRoundTrip = true;
for (const rd of headers.y) {
  for (const cd of headers.x) {
    const [r, c] = resolve(rd, cd);
    const [shown] = cellsToCoordinates([[r, c]], headers);
    if (shown.y !== rd || shown.x !== cd) allRoundTrip = false;
  }
}
check("every digit pair resolves to the square that displays it", allRoundTrip);
check("the old behaviour really was wrong", cellsToCoordinates([[2, 2]], headers)[0].y !== 2);

// ── the entry list is trued up to the board ──
const parts = () => [
  { id: "a", name: "Kel", amount: 20, squares: 2, time: 1 },
  { id: "b", name: "Sam", amount: 10, squares: 1, time: 2 },
];
const boardWith = (cells) => {
  const b = getInitialBoard();
  for (const [r, c, n] of cells) b[r][c] = n;
  return b;
};

const balanced = reconcileEntries(
  parts(),
  boardWith([
    [0, 0, "Kel"],
    [0, 1, "Kel"],
    [5, 5, "Sam"],
  ])
);
check(
  "a board already in agreement is left alone",
  JSON.stringify(balanced.participants) === JSON.stringify(parts())
);
check("and nothing is removed", balanced.removedIds.length === 0);

const cleared = reconcileEntries(
  parts(),
  boardWith([
    [0, 0, "Kel"],
    [5, 5, "Sam"],
  ])
);
check(
  "clearing a square decrements that entry",
  cleared.participants.find((p) => p.name === "Kel").squares === 1
);
check(
  "without touching anybody else",
  cleared.participants.find((p) => p.name === "Sam").squares === 1
);

const gone = reconcileEntries(parts(), boardWith([[5, 5, "Sam"]]));
check(
  "clearing someone's last square drops the entry",
  !gone.participants.some((p) => p.name === "Kel")
);
check("and reports the id so its contact goes too", gone.removedIds.includes("a"));

const added = reconcileEntries(
  parts(),
  boardWith([
    [0, 0, "Kel"],
    [0, 1, "Kel"],
    [5, 5, "Sam"],
    [9, 9, "Ana"],
  ]),
  {
    now: 99,
    makeId: () => "ov1",
  }
);
const ana = added.participants.find((p) => p.name === "Ana");
check("a name an admin typed gets an entry", !!ana && ana.squares === 1);
check("recorded as an override, not a purchase", ana.source === "override" && ana.amount === 0);

// Squares come off the newest entry first: an older one is likelier to be the
// one somebody actually paid for.
const twoEntries = [
  { id: "old", name: "Kel", amount: 20, squares: 2, time: 1 },
  { id: "new", name: "Kel", amount: 10, squares: 1, time: 9 },
];
const trimmed = reconcileEntries(
  twoEntries,
  boardWith([
    [0, 0, "Kel"],
    [0, 1, "Kel"],
  ])
);
check("the newest entry gives up the square", !trimmed.participants.some((p) => p.id === "new"));
check(
  "the older paid entry is untouched",
  trimmed.participants.find((p) => p.id === "old").squares === 2
);

// It repairs drift it did not cause, which is the point of trueing up to the
// board rather than adjusting by one.
const drifted = reconcileEntries(
  [{ id: "a", name: "Kel", amount: 20, squares: 7, time: 1 }],
  boardWith([
    [0, 0, "Kel"],
    [1, 1, "Kel"],
  ])
);
check("a count that had already drifted is corrected", drifted.participants[0].squares === 2);

const emptied = reconcileEntries(parts(), getInitialBoard());
check("an empty board leaves no entries", emptied.participants.length === 0);
check("and every id is reported", emptied.removedIds.sort().join(",") === "a,b");

console.log(
  failed === 0
    ? "\ncheck:override — a square lands where the admin aimed it"
    : `\n${failed} failed.`
);
process.exit(failed ? 1 : 0);
