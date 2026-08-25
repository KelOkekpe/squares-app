import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { withTimeout } from "../utils/async";
import { usePersistedState } from "./usePersistedState";
import { STORAGE_KEYS } from "../utils";

const POLL_MS = 5 * 60 * 1000;

/**
 * A pick'em contest: the frozen weekly slate, submitting, and grading.
 *
 * The sheets themselves are not here — they're admin-only at the table level
 * and come back sanitised from `usePickemEntries`, which is owned one level up
 * so the admin panel and the player view read the same list.
 */
export function usePickem(spaceCode, poolId) {
  const keys = STORAGE_KEYS(spaceCode, poolId);
  const [slate, setSlate] = usePersistedState(keys.slate, null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const submit = useCallback(
    async ({ name, email, picks: sheet, tiebreak, payoutMethod, payoutHandles }) => {
      setSubmitting(true);
      try {
        const { data, error } = await withTimeout(
          supabase.rpc("submit_picks", {
            p_space_code: spaceCode,
            p_pool_id: poolId,
            p_name: name,
            p_picks: sheet,
            p_tiebreak: Number(tiebreak),
            p_contact: { email, payoutMethod, payoutHandles },
          }),
          15000,
          "submit picks"
        );
        if (error) throw error;
        return { entry: data, error: null };
      } catch (err) {
        return { entry: null, error: err?.message || "Could not submit your picks" };
      } finally {
        setSubmitting(false);
      }
    },
    [spaceCode, poolId]
  );

  // Grading runs from whoever has the contest open, same as live scores
  const grade = useCallback(async () => {
    if (!spaceCode || !poolId || inFlight.current) return;
    inFlight.current = true;
    try {
      await withTimeout(
        fetch("/api/sync-picks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spaceCode, poolId }),
        }),
        15000,
        "grade picks"
      );
    } catch (err) {
      console.warn("Grading failed:", err?.message || err);
    } finally {
      inFlight.current = false;
    }
  }, [spaceCode, poolId]);

  useEffect(() => {
    if (!slate?.games?.length) return undefined;
    const ungraded = slate.games.some(
      (g) => !g.winner && g.startsAt && new Date(g.startsAt).getTime() < Date.now()
    );
    if (!ungraded) return undefined;

    grade();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") grade();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [slate, grade]);

  return { slate, setSlate, submit, submitting, grade };
}
