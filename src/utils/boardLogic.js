import { GRID_SIZE } from "./constants.js";

/**
 * Fisher-Yates shuffle — returns a new shuffled copy of the array.
 */
export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generate randomised 0-9 headers for both axes.
 */
export function generateHeaders() {
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  return { x: shuffleArray(digits), y: shuffleArray(digits) };
}

/**
 * Create a fresh 10×10 board filled with nulls.
 */
export function getInitialBoard() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

/**
 * Return an array of [row, col] pairs for every empty cell.
 */
export function getEmptySquares(board) {
  const empty = [];
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++) if (!board[r][c]) empty.push([r, c]);
  return empty;
}

/**
 * Place a participant's name into `count` random empty squares.
 * Returns { board, placed } where `placed` is the actual number added.
 */
export function placeParticipant(board, name, count) {
  const newBoard = board.map((r) => [...r]);
  const empty = shuffleArray(getEmptySquares(newBoard));
  const toPlace = Math.min(count, empty.length);
  const cells = [];
  for (let i = 0; i < toPlace; i++) {
    const [r, c] = empty[i];
    newBoard[r][c] = name;
    cells.push([r, c]);
  }
  // `cells` lets the caller report which squares a player actually got —
  // the grid stores only names, so this is the one moment it's knowable.
  return { board: newBoard, placed: toPlace, cells };
}

/**
 * Given headers, scores map, and a quarter key ("Q1"-"Q4"),
 * return the { row, col } of the winning cell, or null.
 */
export function getWinnerCell(headers, scores, quarter) {
  if (!scores[quarter]) return null;
  const xScore = scores[quarter].x % 10;
  const yScore = scores[quarter].y % 10;
  const col = headers.x.indexOf(xScore);
  const row = headers.y.indexOf(yScore);
  return { row, col };
}

/**
 * Calculate how many squares a given dollar amount buys.
 */
export function calculateSquares(amount, pricePerSquare) {
  if (!amount || amount < pricePerSquare) return 0;
  return Math.floor(amount / pricePerSquare);
}

/**
 * Calculate the remainder after purchasing squares.
 */
export function calculateRemainder(amount, pricePerSquare) {
  if (!amount) return 0;
  return amount % pricePerSquare;
}

const defaultId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `ov${Date.now()}${Math.round(Math.random() * 1e6)}`;

/**
 * Make the entry list agree with the board.
 *
 * The board stores names in cells; the entry list stores a count per entry.
 * They are separate stores, so writing a cell directly leaves them disagreeing
 * — a cleared square keeps its entry in Recent Entries, and an assigned one
 * has no entry behind it at all.
 *
 * The board is the truth here. It is what players see and what the quarters
 * pay out against, so the counts are trued up to it rather than the other way
 * round. That also means this repairs drift it did not cause.
 *
 * Squares are taken from the *newest* entry for a name first: an older entry
 * is more likely to be the one somebody actually paid for, so it is the last
 * thing touched. Names that appear on the board with no entry behind them get
 * one marked `source: "override"` and `amount: 0`, because an admin putting a
 * name in a square is not a payment and the accounting should not pretend it
 * was.
 */
export function reconcileEntries(participants = [], board = [], opts = {}) {
  const { now = Date.now(), makeId = defaultId } = opts;

  const counts = new Map();
  for (const row of board || []) {
    for (const cell of row || []) {
      if (cell) counts.set(cell, (counts.get(cell) || 0) + 1);
    }
  }

  const next = participants.map((p) => ({ ...p }));
  const byName = new Map();
  next.forEach((p, i) => {
    if (!byName.has(p.name)) byName.set(p.name, []);
    byName.get(p.name).push(i);
  });

  for (const [name, idxs] of byName) {
    const want = counts.get(name) || 0;
    let have = idxs.reduce((sum, i) => sum + (Number(next[i].squares) || 0), 0);
    const newestFirst = [...idxs].sort((a, b) => (next[b].time || 0) - (next[a].time || 0));

    for (const i of newestFirst) {
      if (have <= want) break;
      const take = Math.min(Number(next[i].squares) || 0, have - want);
      next[i].squares = (Number(next[i].squares) || 0) - take;
      have -= take;
    }
    if (have < want) {
      const i = newestFirst[0];
      next[i].squares = (Number(next[i].squares) || 0) + (want - have);
    }
    counts.delete(name);
  }

  for (const [name, want] of counts) {
    next.push({ id: makeId(), name, amount: 0, squares: want, time: now, source: "override" });
  }

  const removedIds = [];
  const kept = next.filter((p) => {
    if ((Number(p.squares) || 0) > 0) return true;
    if (p.id) removedIds.push(p.id);
    return false;
  });

  return { participants: kept, removedIds };
}
