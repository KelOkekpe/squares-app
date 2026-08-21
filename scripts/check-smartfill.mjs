// Smart fill hands out squares and cuts payouts, so it decides who gets paid
// and how much. Rounding that silently drops squares would leave the board
// incomplete, and scaling in the wrong order would erase the reduction.
import {
  applySmartFill,
  allocateFill,
  scaledPayouts,
  holdingsByName,
} from "../src/utils/smartFill.js";
import { getInitialBoard, getEmptySquares } from "../src/utils/boardLogic.js";

let failed = 0;
const check = (l, c) => {
  console.log((c ? "PASS  " : "FAIL  ") + l);
  if (!c) failed++;
};

function boardWith(holdings) {
  const b = getInitialBoard();
  let r = 0,
    c = 0;
  for (const [name, n] of Object.entries(holdings)) {
    for (let i = 0; i < n; i++) {
      b[r][c] = name;
      if (++c === 10) {
        c = 0;
        r++;
      }
    }
  }
  return b;
}

// The stated example
const a = boardWith({ A: 10, B: 4, C: 36 });
const alloc = allocateFill(a);
check(
  "50% sold: shares double",
  alloc.allocations.get("A") === 10 && alloc.allocations.get("B") === 4
);
const filled = applySmartFill(a);
check("board ends completely owned", getEmptySquares(filled.board).length === 0);
check("every empty square was placed", filled.placed === 50);

// Rounding: 3 players with awkward holdings must still fill exactly
for (const holdings of [
  { A: 7, B: 5, C: 1 },
  { A: 33, B: 1 },
  { A: 1 },
  { A: 2, B: 3, C: 5, D: 7, E: 11 },
]) {
  const b = boardWith(holdings);
  const out = applySmartFill(b);
  const left = getEmptySquares(out.board).length;
  check(`${JSON.stringify(holdings)} fills the board exactly (0 left)`, left === 0);
  const after = holdingsByName(out.board);
  check(
    `${JSON.stringify(holdings)} nobody loses squares`,
    Object.entries(holdings).every(([n, v]) => after.get(n) >= v)
  );
}

// Proportionality is preserved as closely as integers allow
const p = applySmartFill(boardWith({ Big: 40, Small: 10 }));
const after = holdingsByName(p.board);
check(
  "a 4:1 holding stays roughly 4:1",
  Math.abs(after.get("Big") / after.get("Small") - 4) < 0.35
);

// Payouts scale to money in, and preserve an admin's margin
const half = boardWith({ A: 25, B: 25 });
check(
  "full payout halves at 50% sold",
  scaledPayouts({ totalPot: 1000, quarterlyPayout: 250 }, half).totalPot === 500
);
check(
  "quarterly halves too",
  scaledPayouts({ totalPot: 1000, quarterlyPayout: 250 }, half).quarterlyPayout === 125
);
check(
  "an admin's 10% cut survives scaling",
  scaledPayouts({ totalPot: 900, quarterlyPayout: 225 }, half).totalPot === 450
);

// The ordering trap: scale before filling, never after
const pre = scaledPayouts({ totalPot: 1000 }, half);
const post = scaledPayouts({ totalPot: 1000 }, applySmartFill(half).board);
check("scaling after filling would wrongly restore the full pot", post.totalPot === 1000);
check("scaling before filling gives the reduced pot", pre.totalPot === 500);

// Degenerate cases must not throw or invent owners
const full = boardWith({ A: 100 });
check("a full board is a no-op", applySmartFill(full).placed === 0);
const emptyBoard = getInitialBoard();
check("an empty board is a no-op", applySmartFill(emptyBoard).placed === 0);
check(
  "an empty board invents no owners",
  holdingsByName(applySmartFill(emptyBoard).board).size === 0
);

console.log(failed === 0 ? "\nAll smart-fill cases pass." : `\n${failed} failed.`);
process.exit(failed ? 1 : 0);
