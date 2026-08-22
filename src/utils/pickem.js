/**
 * Pick'em: pick a winner in every game on the week's slate, most correct wins.
 *
 * Ties break on a designated game's combined total — closest without going
 * over. That rule leaves two gaps a real pool hits, so both are resolved
 * explicitly below rather than left to chance.
 */

export const PICK_AWAY = "away";
export const PICK_HOME = "home";

/** Games are frozen into the pool when it's created, so a rescheduled slate can't move under live picks. */
export function slateLocksAt(slate) {
  const times = (slate?.games || [])
    .map((g) => (g.startsAt ? new Date(g.startsAt).getTime() : null))
    .filter(Boolean);
  return times.length ? Math.min(...times) : null;
}

export function isSlateLocked(slate, now = Date.now()) {
  const lock = slateLocksAt(slate);
  return lock !== null && now >= lock;
}

/** The tiebreaker game, defaulting to the latest kickoff — usually the primetime finale. */
export function tiebreakGame(slate) {
  const games = slate?.games || [];
  if (slate?.tiebreakGameId) {
    const named = games.find((g) => g.id === slate.tiebreakGameId);
    if (named) return named;
  }
  return [...games].sort((a, b) => new Date(b.startsAt || 0) - new Date(a.startsAt || 0))[0];
}

export function gradedCount(slate) {
  return (slate?.games || []).filter((g) => g.winner).length;
}

/**
 * Score one entry against the slate. Only graded games count, so standings are
 * meaningful while the week is still in progress.
 */
export function scoreEntry(entry, slate) {
  const games = slate?.games || [];
  let correct = 0;
  let graded = 0;

  for (const game of games) {
    if (!game.winner) continue;
    graded += 1;
    if (entry.picks?.[game.id] === game.winner) correct += 1;
  }

  const tb = tiebreakGame(slate);
  const actual = tb && typeof tb.total === "number" ? tb.total : null;
  const guess = typeof entry.tiebreak === "number" ? entry.tiebreak : null;

  // "Closest without going over": a guess above the real total is out of the
  // running, but only once that game has actually finished.
  const busted = actual !== null && guess !== null && guess > actual;
  const distance = actual !== null && guess !== null ? Math.abs(actual - guess) : null;

  return { entry, correct, graded, guess, actual, busted, distance };
}

/**
 * Standings, best first.
 *
 * Two gaps in the plain rule are closed here: if everyone tied went over, the
 * closest of them still wins rather than nobody winning; and identical guesses
 * fall back to who submitted first, so a winner always exists.
 */
export function rankEntries(entries = [], slate) {
  return entries
    .map((e) => scoreEntry(e, slate))
    .sort((a, b) => {
      if (b.correct !== a.correct) return b.correct - a.correct;

      // Someone under the total always beats someone over it
      if (a.busted !== b.busted) return a.busted ? 1 : -1;

      // Then closest, whether that's from under or (if all busted) from over
      if (a.distance !== b.distance) {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      }

      // Identical guesses: first submission wins, so a tie always resolves
      return (a.entry.submittedAt || 0) - (b.entry.submittedAt || 0);
    })
    .reduce((ranked, row, i) => {
      // Ranks are assigned walking forward, because a tied row copies the rank
      // of the one before it — which has to already carry a rank. Reading it
      // back out of the array being mapped gives undefined.
      const prev = ranked[i - 1];
      ranked.push({ ...row, rank: prev && sameStanding(row, prev) ? prev.rank : i + 1 });
      return ranked;
    }, []);
}

function sameStanding(a, b) {
  return a.correct === b.correct && a.busted === b.busted && a.distance === b.distance;
}

/** True once every game on the slate has a result. */
export function isSlateComplete(slate) {
  const games = slate?.games || [];
  return games.length > 0 && games.every((g) => g.winner);
}

/** How many picks an entry still owes, so the sheet can say so before submit. */
export function missingPicks(picks = {}, slate) {
  return (slate?.games || []).filter((g) => !picks[g.id]).length;
}
