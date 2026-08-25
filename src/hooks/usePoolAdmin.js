import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseEnabled } from "../lib/supabase";
import { withTimeout } from "../utils/async";

/**
 * Admin actions that target a pool by id, including one you aren't viewing.
 *
 * GameBoard only loads the active pool's state, so the per-pool controls in
 * Pool Management need a way to read and write another pool's rows directly.
 * Keys follow the same scheme as usePersistedState — see utils/storageKeys.js.
 */
export function usePoolAdmin(spaceCode) {
  // poolId → that pool's admin config blob, so each row can show its own
  // submissions state without loading five separate hooks
  const [configs, setConfigs] = useState({});
  // poolId → pending count, so the board picker can show where entries are
  // waiting. Without it an admin looking at the wrong board sees an empty
  // queue and concludes entries are being lost.
  const [pendingCounts, setPendingCounts] = useState({});
  const [busyPoolId, setBusyPoolId] = useState(null);
  const [error, setError] = useState("");

  const loadConfigs = useCallback(async () => {
    if (!spaceCode || !isSupabaseEnabled()) return;
    try {
      const { data, error: err } = await withTimeout(
        supabase
          .from("spaces")
          .select("pool_id, type, value")
          .eq("space_code", spaceCode)
          .in("type", ["admin", "pending", "picks"]),
        8000,
        "pool configs"
      );
      if (err) throw err;

      const rows = data || [];
      const nextConfigs = Object.fromEntries(
        rows.filter((r) => r.type === "admin").map((r) => [r.pool_id, r.value || {}])
      );
      setConfigs(nextConfigs);

      // Both kinds of "needs you" in one number per pool, because the picker
      // shows one row per board and an admin only cares that something is
      // waiting — not which mechanism it is waiting in.
      //
      // Squares: entry requests queued for approval.
      // Pick'em: submitted sheets whose fee has not been confirmed. Only for a
      // contest that charges — a free one confirms itself, so an unpaid flag
      // there would be permanent and meaningless.
      const counts = {};
      for (const row of rows) {
        if (row.type === "pending") {
          counts[row.pool_id] =
            (counts[row.pool_id] || 0) + (Array.isArray(row.value) ? row.value.length : 0);
        }
        if (row.type === "picks" && Number(nextConfigs[row.pool_id]?.entryFee) > 0) {
          const unconfirmed = Array.isArray(row.value)
            ? row.value.filter((e) => !e?.paid).length
            : 0;
          counts[row.pool_id] = (counts[row.pool_id] || 0) + unconfirmed;
        }
      }
      setPendingCounts(counts);
    } catch (err) {
      console.warn("Could not load pool configs:", err?.message || err);
    }
  }, [spaceCode]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const writeState = useCallback(
    async (poolId, type, value) => {
      const { error: err } = await withTimeout(
        supabase.from("spaces").upsert(
          {
            key: `fb-${spaceCode}-${poolId}-${type}`,
            space_code: spaceCode,
            pool_id: poolId,
            type,
            value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "space_code,pool_id,type" }
        ),
        8000,
        `write ${type}`
      );
      if (err) throw err;
    },
    [spaceCode]
  );

  /** Flip a pool's submissions flag, preserving the rest of its config. */
  const setSubmissionsDisabled = useCallback(
    async (poolId, disabled) => {
      setError("");
      setBusyPoolId(poolId);
      try {
        const next = { ...(configs[poolId] || {}), submissionsDisabled: !!disabled };
        await writeState(poolId, "admin", next);
        setConfigs((prev) => ({ ...prev, [poolId]: next }));
        return { ok: true };
      } catch (err) {
        const message = err?.message || "Could not update submissions";
        setError(message);
        return { ok: false, error: message };
      } finally {
        setBusyPoolId(null);
      }
    },
    [configs, writeState]
  );

  /**
   * Clear a pool that isn't currently loaded. Config is deliberately kept —
   * a reset clears the game, not the price, teams or payment instructions.
   */
  const resetRemotePool = useCallback(
    async (poolId, { board, headers }) => {
      setError("");
      setBusyPoolId(poolId);
      try {
        await writeState(poolId, "board", board);
        await writeState(poolId, "headers", headers);
        await writeState(poolId, "participants", []);
        await writeState(poolId, "pending", []);
        await writeState(poolId, "scores", {});
        return { ok: true };
      } catch (err) {
        const message = err?.message || "Could not reset that board";
        setError(message);
        return { ok: false, error: message };
      } finally {
        setBusyPoolId(null);
      }
    },
    [writeState]
  );

  return {
    configs,
    pendingCounts,
    busyPoolId,
    error,
    setError,
    setSubmissionsDisabled,
    resetRemotePool,
    refetchConfigs: loadConfigs,
  };
}
