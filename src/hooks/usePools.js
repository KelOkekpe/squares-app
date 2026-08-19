import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseEnabled } from "../lib/supabase";
import { withTimeout } from "../utils/async";

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
  const createPool = useCallback(
    async (name) => {
      if (!spaceCode || !name) return null;

      const newPool = {
        id: `p${Date.now()}`,
        name: name.trim(),
        archived: false,
        createdAt: Date.now(),
      };

      if (!isSupabaseEnabled()) {
        return null;
      }

      try {
        const { data, error: insertError } = await supabase
          .from("pools")
          .insert({
            space_code: spaceCode,
            name: name.trim(),
            archived: false,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        const transformedPool = {
          id: data.id,
          name: data.name,
          archived: data.archived || false,
          createdAt: new Date(data.created_at).getTime(),
        };

        setPools((prev) => [...prev, transformedPool]);
        return transformedPool;
      } catch (err) {
        console.error("Error creating pool in Supabase:", err);
        return null;
      }
    },
    [spaceCode, pools]
  );

  // Update a pool (archive/unarchive, rename)
  const updatePool = useCallback(
    async (poolId, updates) => {
      if (!spaceCode || !poolId) return;

      const updatedPools = pools.map((p) => (p.id === poolId ? { ...p, ...updates } : p));
      setPools(updatedPools);

      if (!isSupabaseEnabled()) return;

      try {
        const { error: updateError } = await supabase
          .from("pools")
          .update(updates)
          .eq("id", poolId)
          .eq("space_code", spaceCode);

        if (updateError) throw updateError;
      } catch (err) {
        console.error("Error updating pool in Supabase:", err);
        // State already updated, so we're good
      }
    },
    [spaceCode, pools]
  );

  // Archive/unarchive a pool
  const toggleArchivePool = useCallback(
    async (poolId) => {
      const pool = pools.find((p) => p.id === poolId);
      if (!pool) return;

      await updatePool(poolId, { archived: !pool.archived });
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
