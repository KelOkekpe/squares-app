import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";
import { withTimeout } from "../utils/async";
import { sendConfirmationEmail } from "../utils/notify";

const POLL_MS = 60 * 1000;

/**
 * Submitted pick'em sheets.
 *
 * Read through the `list_picks` RPC rather than the `spaces` row, because the
 * row is admin-only now: sheets are hidden until the slate locks, and that
 * decision has to be made server-side or it isn't made at all. What comes back
 * before kickoff is names and nothing else.
 *
 * That also means the client never holds a complete blob, so the admin edits go
 * through RPCs that change one entry in place. Writing this array back would
 * erase everyone's picks.
 */
export function usePickemEntries(spaceCode, poolId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  // Responses can land out of order; only the newest request may set state.
  const seqRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!spaceCode || !poolId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    const seq = ++seqRef.current;
    try {
      const { data, error } = await withTimeout(
        supabase.rpc("list_picks", { p_space_code: spaceCode, p_pool_id: poolId }),
        15000,
        "load picks"
      );
      if (error) throw error;
      if (seq === seqRef.current) setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Could not load pick'em entries:", err?.message || err);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [spaceCode, poolId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Realtime can't help here — an anonymous viewer has no read on the row, so
  // there is no change event to receive. A slow poll covers late submissions.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const mutate = useCallback(
    async (fn, label) => {
      try {
        const { data, error } = await withTimeout(fn(), 15000, label);
        if (error) throw error;
        // Every mutation RPC returns the fresh list, so the panel updates
        // without a second round trip.
        seqRef.current += 1;
        setEntries(Array.isArray(data) ? data : []);
        return { error: null };
      } catch (err) {
        return { error: err?.message || `Could not ${label}` };
      }
    },
    [setEntries]
  );

  const setPaid = useCallback(
    async (entryId, paid) => {
      const result = await mutate(
        () =>
          supabase.rpc("set_pickem_paid", {
            p_space_code: spaceCode,
            p_pool_id: poolId,
            p_entry_id: entryId,
            p_paid: paid,
          }),
        "update that entry"
      );

      // Only on confirmation, and only once it stuck. Un-marking someone is a
      // correction, and telling them their entry no longer counts is a
      // conversation for their admin to have, not an automated email.
      if (!result?.error && paid) {
        const { data: session } = await supabase.auth.getSession();
        sendConfirmationEmail(
          { spaceCode, poolId, entryId, kind: "pickem" },
          session?.session?.access_token
        );
      }
      return result;
    },
    [mutate, spaceCode, poolId]
  );

  const removeEntry = useCallback(
    (entryId) =>
      mutate(
        () =>
          supabase.rpc("remove_pickem_entry", {
            p_space_code: spaceCode,
            p_pool_id: poolId,
            p_entry_id: entryId,
          }),
        "remove that entry"
      ),
    [mutate, spaceCode, poolId]
  );

  const clearEntries = useCallback(
    () =>
      mutate(
        () =>
          supabase.rpc("clear_pickem_entries", {
            p_space_code: spaceCode,
            p_pool_id: poolId,
          }),
        "reset the contest"
      ),
    [mutate, spaceCode, poolId]
  );

  return { entries, loading, refresh, setPaid, removeEntry, clearEntries };
}
