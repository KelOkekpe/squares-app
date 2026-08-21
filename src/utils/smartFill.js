import { GRID_SIZE } from "./constants.js";
import { getEmptySquares, shuffleArray } from "./boardLogic.js";

/**
 * Filling an undersold board without anyone losing value.
 *
 * Empty squares are handed to existing participants in proportion to what they
 * already bought, so the board ends up fully owned — a winning number landing
 * on an unowned square would pay nobody. Nobody is charged for the extra
 * squares; instead the payout drops to the money actually collected, which
 * keeps every dollar paid in worth the same share of the pot.
 */

/** Squares each participant currently holds, by name. */
export function holdingsByName(board) {
  const counts = new Map();
  for (const row of board) {
    for (const cell of row) {
      if (cell) counts.set(cell, (counts.get(cell) || 0) + 1);
    }
  }
  return counts;
}

/**
 * How many extra squares each participant receives.
 *
 * Proportional shares rarely divide evenly, so the fractional parts are ranked
 * and the leftovers go to the largest ones — the standard largest-remainder
 * method. Without it, rounding silently drops squares and the board stays
 * incomplete.
 */
export function allocateFill(board) {
  const counts = holdingsByName(board);
  const empty = getEmptySquares(board).length;
  const sold = [...counts.values()].reduce((a, b) => a + b, 0);

  if (empty === 0 || sold === 0) return { allocations: new Map(), empty, sold };

  const exact = [...counts.entries()].map(([name, held]) => ({
    name,
    held,
    share: (held / sold) * empty,
  }));

  const allocations = new Map(exact.map((e) => [e.name, Math.floor(e.share)]));
  let assigned = [...allocations.values()].reduce((a, b) => a + b, 0);

  const byRemainder = [...exact].sort((a, b) => (b.share % 1) - (a.share % 1) || b.held - a.held);
  let i = 0;
  while (assigned < empty && byRemainder.length) {
    const target = byRemainder[i % byRemainder.length];
    allocations.set(target.name, allocations.get(target.name) + 1);
    assigned += 1;
    i += 1;
  }

  return { allocations, empty, sold };
}

/** Apply an allocation to the board, placing each participant's squares at random. */
export function applySmartFill(board) {
  const { allocations, empty, sold } = allocateFill(board);
  if (empty === 0 || sold === 0) return { board, placed: 0, allocations, empty, sold };

  const next = board.map((row) => [...row]);
  const openCells = shuffleArray(getEmptySquares(next));

  let cursor = 0;
  let placed = 0;
  for (const [name, count] of allocations) {
    for (let n = 0; n < count && cursor < openCells.length; n++) {
      const [r, c] = openCells[cursor++];
      next[r][c] = name;
      placed += 1;
    }
  }

  return { board: next, placed, allocations, empty, sold };
}

/**
 * Payouts scaled to the money actually collected.
 *
 * Scaling the admin's configured figures rather than recomputing from price ×
 * squares preserves whatever margin they built in — a $900 pot on a $1000
 * board stays a 90% payout at half capacity.
 */
export function scaledPayouts(config, board) {
  const sold = [...holdingsByName(board).values()].reduce((a, b) => a + b, 0);
  const total = GRID_SIZE * GRID_SIZE;
  const utilization = total > 0 ? sold / total : 0;

  const round = (n) => Math.round((Number(n) || 0) * utilization);
  return {
    utilization,
    sold,
    totalPot: round(config.totalPot),
    quarterlyPayout: round(config.quarterlyPayout),
  };
}
