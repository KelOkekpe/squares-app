import { useSupabaseState } from "./useSupabaseState";

/**
 * Like useState but persists to storage (Supabase if enabled, otherwise localStorage).
 * Falls back to `initialValue` when nothing is stored or parsing fails.
 * Re-reads from storage when `key` changes (e.g. switching boards).
 *
 * This is a wrapper around useSupabaseState which automatically handles
 * both Supabase (when configured) and localStorage (as fallback).
 *
 * @param {string} key - Storage key (e.g., "fb-fam-b123-board")
 * @param {any} initialValue - Default value if nothing is stored
 * @param {object} options - Optional: { table: 'spaces', spaceCode, poolId }
 */
export function usePersistedState(key, initialValue, options = {}) {
  // useSupabaseState already handles both Supabase and localStorage fallback
  const [state, setState] = useSupabaseState(key, initialValue, options);
  return [state, setState];
}
