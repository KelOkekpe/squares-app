import { useState, useEffect, useCallback, useRef } from "react";
import { withTimeout } from "../utils/async";

const POLL_MS = 5 * 60 * 1000;

/**
 * Keeps a board's quarter scores current without anyone typing them.
 *
 * Polling runs from whoever has the board open rather than a cron job, because
 * scheduled functions need a paid Vercel tier. The server throttles, so extra
 * viewers cost nothing — and a board nobody is watching doesn't need updating.
 *
 * Only runs while a game is plausibly live, so an off-season board sits idle.
 */
export function useLiveScores({ spaceCode, poolId, game, enabled = true }) {
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const inFlight = useRef(false);

  const sync = useCallback(async () => {
    if (!spaceCode || !poolId || !game?.id || inFlight.current) return null;
    inFlight.current = true;
    setSyncing(true);
    try {
      const response = await withTimeout(
        fetch("/api/sync-scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spaceCode, poolId }),
        }),
        15000,
        "sync scores"
      );
      const payload = await response.json().catch(() => ({}));
      if (payload.synced) {
        setStatus(payload.status || null);
        setLastSyncedAt(Date.now());
      }
      return payload;
    } catch (err) {
      console.warn("Score sync failed:", err?.message || err);
      return null;
    } finally {
      inFlight.current = false;
      setSyncing(false);
    }
  }, [spaceCode, poolId, game?.id]);

  useEffect(() => {
    if (!enabled || !game?.id) return undefined;

    // Don't poll a game that hasn't kicked off or finished hours ago
    const kickoff = game.startsAt ? new Date(game.startsAt).getTime() : null;
    const withinWindow = () => {
      if (!kickoff) return true;
      const now = Date.now();
      return now > kickoff - 15 * 60 * 1000 && now < kickoff + 6 * 60 * 60 * 1000;
    };

    if (!withinWindow()) return undefined;

    sync();
    const timer = setInterval(() => {
      if (withinWindow() && document.visibilityState === "visible") sync();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [enabled, game?.id, game?.startsAt, sync]);

  return { sync, syncing, status, lastSyncedAt };
}
