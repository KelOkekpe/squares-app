import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseEnabled } from "../lib/supabase";
import { parseStorageKey } from "../utils/storageKeys";
import { withTimeout } from "../utils/async";

/**
 * Like useState but persists to Supabase (with localStorage fallback).
 * Automatically syncs across devices and browsers for the same space/pool.
 *
 * @param {string} key - Storage key (e.g., "fb-fam-p123-board")
 * @param {any} initialValue - Default value if nothing is stored
 * @param {object} options - { table: 'spaces', spaceCode, poolId }
 * Note: Database columns use 'space_code' and 'pool_id'
 */
export function useSupabaseState(key, initialValue, options = {}) {
  const { table = "spaces", spaceCode, poolId } = options;
  // Handle function initializers (like useState does)
  const getInitialValue = () => {
    return typeof initialValue === "function" ? initialValue() : initialValue;
  };
  const [state, setState] = useState(getInitialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Determine the storage key structure
  const storageKey = key;

  // Load initial data
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      if (!isSupabaseEnabled()) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const match = parseStorageKey(storageKey);

        // Try key lookup first (works for all keys once we save with key)
        const { data: dataByKey, error: keyErr } = await withTimeout(
          supabase.from(table).select("value").eq("key", storageKey).maybeSingle(),
          8000,
          `load ${storageKey}`
        );

        if (!keyErr && dataByKey != null) {
          if (mounted) {
            setState(dataByKey.value);
            setLoading(false);
          }
        } else if (match) {
          const { space, pool, type } = match;

          // Use structured query
          let query = supabase.from(table).select("value").eq("space_code", space);

          if (pool) {
            query = query.eq("pool_id", pool).eq("type", type);
          } else {
            query = query.eq("type", type).eq("pool_id", "");
          }

          // Use .maybeSingle() instead of .single() to handle missing rows gracefully
          // .maybeSingle() returns null instead of throwing 406 when no row exists
          const { data, error } = await withTimeout(
            query.maybeSingle(),
            8000,
            `load ${storageKey}`
          );

          if (error) {
            // Only throw if it's not a "not found" error
            // 406 can also mean "not found" in some Supabase versions
            if (error.code !== "PGRST116" && error.code !== "406") {
              throw error;
            }
          }

          if (mounted) {
            setState(data !== null ? data.value : getInitialValue());
            setLoading(false);
          }
        } else if (mounted) {
          // No key match and no structured match - use initial value
          setState(getInitialValue());
          setLoading(false);
        }
      } catch (err) {
        const isNotFoundError = err?.code === "406" || err?.code === "PGRST116";
        if (!isNotFoundError) console.error("Error loading from Supabase:", err);
        if (mounted) {
          setError(isNotFoundError ? null : err);
          setState(getInitialValue());
          setLoading(false);
        }
      }
    }

    loadData();

    // Set up real-time subscription if Supabase is enabled
    let subscription = null;
    if (isSupabaseEnabled()) {
      const match = parseStorageKey(storageKey);
      if (match) {
        const { space, pool, type } = match;

        const channel = supabase
          .channel(`state:${storageKey}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: table,
              filter: pool
                ? `space_code=eq.${space},pool_id=eq.${pool},type=eq.${type}`
                : `space_code=eq.${space},type=eq.${type},pool_id=eq.`,
            },
            (payload) => {
              if (mounted && payload.new) {
                // Only update if this is a real change (not our own update)
                // Check if the value is actually different to avoid unnecessary updates
                setState((currentState) => {
                  const newValue = payload.new.value;
                  // Only update if different (deep comparison for objects)
                  if (JSON.stringify(currentState) !== JSON.stringify(newValue)) {
                    return newValue;
                  }
                  return currentState;
                });
              }
            }
          )
          .subscribe();

        subscription = channel;
      }
    }

    return () => {
      mounted = false;
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [storageKey, table]); // Removed initialValue from dependencies to prevent regeneration

  // Save function
  const saveState = useCallback(
    async (newState) => {
      if (!isSupabaseEnabled()) return;

      try {
        const match = parseStorageKey(storageKey);

        if (!match) {
          // spaces.space_code and spaces.type are NOT NULL, so a key that
          // doesn't parse cannot be written. Fail loudly rather than letting
          // the row be silently rejected.
          throw new Error(
            `Storage key "${storageKey}" does not parse — add its type to POOL_STATE_TYPES in utils/storageKeys.js`
          );
        } else {
          const { space, pool, type } = match;
          const poolVal = pool || "";
          const row = {
            key: storageKey,
            space_code: space,
            pool_id: poolVal,
            type: type,
            value: newState,
            updated_at: new Date().toISOString(),
          };

          // Use select-then-update-or-insert to avoid requiring unique constraint
          // (some DBs may not have unique_space_pool_type)
          const { data: existing } = await supabase
            .from(table)
            .select("id")
            .eq("space_code", space)
            .eq("pool_id", poolVal)
            .eq("type", type)
            .maybeSingle();

          if (existing?.id) {
            const { error } = await supabase.from(table).update(row).eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from(table).insert(row);
            if (error) throw error;
          }
        }

        setState(newState);
        setError(null);
      } catch (err) {
        console.error("Error saving to Supabase:", err);
        setError(err);
      }
    },
    [storageKey, table]
  );

  // Update function that works like setState
  // Use a ref to always get the latest state value (avoids stale closure issues)
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const updateState = useCallback(
    (updater) => {
      const newState = typeof updater === "function" ? updater(stateRef.current) : updater;
      saveState(newState);
    },
    [saveState]
  );

  return [state, updateState, { loading, error }];
}
