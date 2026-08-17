import { GRID_SIZE } from "./constants";

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
    for (let c = 0; c < GRID_SIZE; c++)
      if (!board[r][c]) empty.push([r, c]);
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
  for (let i = 0; i < toPlace; i++) {
    const [r, c] = empty[i];
    newBoard[r][c] = name;
  }
  return { board: newBoard, placed: toPlace };
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
