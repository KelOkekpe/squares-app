import { useState, useEffect, useCallback, useRef } from "react";

const POLL_MS = 60 * 1000;

/**
 * This week's NFL games, for the ticker.
 *
 * Goes through /api/nfl-games rather than calling ESPN from the browser:
 * ESPN's CORS headers are not a contract, the response is cached at the edge
 * for everyone at once, and it keeps the provider behind one file the way
 * every other score path does.
 */
export function useScoreboard() {
  const [games, setGames] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/nfl-games");
      const data = await res.json();
      setGames(Array.isArray(data.games) ? data.games : []);
    } catch (err) {
      // A ticker is decoration. Failing to load one must never surface as an
      // error over the board someone is actually here to look at.
      console.warn("Scoreboard unavailable:", err?.message || err);
    } finally {
      inFlight.current = false;
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { games, loaded };
}
