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
  const [busyPoolId, setBusyPoolId] = useState(null);
  const [error, setError] = useState("");

  const loadConfigs = useCallback(async () => {
    if (!spaceCode || !isSupabaseEnabled()) return;
    try {
      const { data, error: err } = await withTimeout(
        supabase
          .from("spaces")
          .select("pool_id, value")
          .eq("space_code", spaceCode)
          .eq("type", "admin"),
        8000,
        "pool configs"
      );
      if (err) throw err;
      setConfigs(Object.fromEntries((data || []).map((r) => [r.pool_id, r.value || {}])));
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
    busyPoolId,
    error,
    setError,
    setSubmissionsDisabled,
    resetRemotePool,
    refetchConfigs: loadConfigs,
  };
}
