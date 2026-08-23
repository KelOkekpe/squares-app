import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseEnabled } from "../lib/supabase";
import { withTimeout } from "../utils/async";
import { DEFAULT_CONFIG } from "../utils";

/**
 * Hook to manage pools for a space
 * Loads pools from the pools table and provides functions to create/update/archive pools
 *
 * @param {string} spaceCode - The space code
 * @returns {[pools, setPools, loading, error]} - Pools array, setPools function, loading state, error state
 */
export function usePools(spaceCode) {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load pools from database
  const loadPools = useCallback(async () => {
    if (!spaceCode) {
      setPools([]);
      setLoading(false);
      return;
    }

    if (!isSupabaseEnabled()) {
      setPools([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await withTimeout(
        supabase
          .from("pools")
          .select("*")
          .eq("space_code", spaceCode)
          .order("created_at", { ascending: true }),
        8000,
        "pools"
      );

      if (fetchError) throw fetchError;

      // Transform database rows to pool objects
      const transformedPools = (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        archived: row.archived || false,
        expiresAt: row.expires_at || null,
        paid: row.paid !== false,
        gameType: row.game_type || "squares",
        createdAt: new Date(row.created_at).getTime(),
      }));

      setPools(transformedPools);
      setError(null);
    } catch (err) {
      console.error("Error loading pools from Supabase:", err);
      setError(err);
      setPools([]);
    } finally {
      setLoading(false);
    }
  }, [spaceCode]);

  // Load pools on mount and when spaceCode changes
  useEffect(() => {
    loadPools();

    // Set up real-time subscription if Supabase is enabled
    let subscription = null;
    if (isSupabaseEnabled() && spaceCode) {
      const channel = supabase
        .channel(`pools:${spaceCode}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "pools",
            filter: `space_code=eq.${spaceCode}`,
          },
          () => {
            // Reload pools when changes occur
            loadPools();
          }
        )
        .subscribe();

      subscription = channel;
    }

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [spaceCode, loadPools]);

  // Save pools function
  const savePools = useCallback(
    async (newPools) => {
      if (!spaceCode) return;

      setPools(newPools);

      if (!isSupabaseEnabled()) return;

      // For now, we'll sync individual pool operations
      // This function is mainly for bulk updates if needed
      // Individual create/update/archive operations should use the specific functions below
    },
    [spaceCode]
  );

  // Create a new pool
  // The 16-board cap and the required expiry are enforced by a trigger, so the
  // database's message is surfaced verbatim rather than guessed at here.
  const createPool = useCallback(
    async (name, expiresAt, initialConfig, { gameType = "squares", slate } = {}) => {
      if (!spaceCode || !name) return { pool: null, error: "Name is required" };
      if (!expiresAt) return { pool: null, error: "An end date is required" };
      if (!isSupabaseEnabled()) return { pool: null, error: "Supabase is required" };

      try {
        const { data, error: insertError } = await withTimeout(
          supabase
            .from("pools")
            .insert({
              space_code: spaceCode,
              name: name.trim(),
              archived: false,
              expires_at: expiresAt,
              game_type: gameType,
            })
            .select()
            .single(),
          8000,
          "create pool"
        );

        if (insertError) {
          const friendly = nameClash(insertError, name.trim(), "create");
          if (friendly) return { pool: null, error: friendly };
          throw insertError;
        }

        const transformedPool = {
          id: data.id,
          name: data.name,
          archived: data.archived || false,
          expiresAt: data.expires_at || null,
          paid: data.paid !== false,
          gameType: data.game_type || "squares",
          createdAt: new Date(data.created_at).getTime(),
        };

        // The slate is written with the pool so a pick'em contest is playable
        // the moment it exists, rather than needing a second trip.
        if (slate) {
          const { error: slateError } = await supabase.from("spaces").upsert(
            {
              key: `fb-${spaceCode}-${data.id}-slate`,
              space_code: spaceCode,
              pool_id: data.id,
              type: "slate",
              value: slate,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "space_code,pool_id,type" }
          );
          if (slateError) console.warn("Could not seed slate:", slateError.message);
        }

        // Seed the board's config in the same breath, so a board created with
        // a game attached is immediately wired for live scores.
        if (initialConfig && Object.keys(initialConfig).length) {
          const { error: configError } = await supabase.from("spaces").upsert(
            {
              key: `fb-${spaceCode}-${data.id}-admin`,
              space_code: spaceCode,
              pool_id: data.id,
              type: "admin",
              value: { ...DEFAULT_CONFIG, ...initialConfig },
              updated_at: new Date().toISOString(),
            },
            { onConflict: "space_code,pool_id,type" }
          );
          if (configError) console.warn("Could not seed board config:", configError.message);
        }

        setPools((prev) => [...prev, transformedPool]);
        return { pool: transformedPool, error: null };
      } catch (err) {
        console.error("Error creating pool in Supabase:", err);
        return { pool: null, error: err?.message || "Could not create the board" };
      }
    },
    [spaceCode]
  );

  // Postgres reports this as `duplicate key value violates unique constraint
  // "unique_pool_name_per_space"`, which tells an admin nothing about what to
  // do. Only live boards hold a name, so say that.
  const nameClash = (err, name, action) => {
    if (!/unique_pool_name_per_space|duplicate key/i.test(err?.message || "")) return null;
    const quoted = name ? `"${name}"` : "That name";
    return action === "unarchive"
      ? `${quoted} can't be unarchived — a live board already uses that name. Rename one of them first.`
      : `${quoted} is already in use by a live board in this space. Archived and deleted boards don't hold a name.`;
  };

  // Update a pool (archive/unarchive, rename)
  const updatePool = useCallback(
    async (poolId, updates) => {
      if (!spaceCode || !poolId) return { error: null };

      const previous = pools;
      const updatedPools = pools.map((p) => (p.id === poolId ? { ...p, ...updates } : p));
      setPools(updatedPools);

      if (!isSupabaseEnabled()) return { error: null };

      try {
        const { error: updateError } = await supabase
          .from("pools")
          .update(updates)
          .eq("id", poolId)
          .eq("space_code", spaceCode);

        if (updateError) throw updateError;
        return { error: null };
      } catch (err) {
        // Now that a name is only held by live boards, unarchiving can be
        // rejected. Keeping the optimistic state would show the board as
        // unarchived when the database still has it archived.
        setPools(previous);
        const pool = previous.find((p) => p.id === poolId);
        const message =
          nameClash(err, pool?.name, updates?.archived === false ? "unarchive" : "update") ||
          err?.message ||
          "Could not update that board";
        console.error("Error updating pool in Supabase:", err);
        return { error: message };
      }
    },
    [spaceCode, pools]
  );

  // Archive/unarchive a pool
  const toggleArchivePool = useCallback(
    async (poolId) => {
      const pool = pools.find((p) => p.id === poolId);
      if (!pool) return { error: null };

      return updatePool(poolId, { archived: !pool.archived });
    },
    [pools, updatePool]
  );

  return {
    pools,
    setPools: savePools,
    createPool,
    updatePool,
    toggleArchivePool,
    loading,
    error,
    refetch: loadPools,
  };
}
