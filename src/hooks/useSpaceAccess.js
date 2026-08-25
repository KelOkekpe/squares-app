import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseEnabled } from "../lib/supabase";
import { withTimeout } from "../utils/async";
import { useAuth } from "./useAuth";
import { loadUnlocked, rememberUnlocked } from "../utils/playerStore";

/**
 * Access to private spaces.
 *
 * A signed-in admin gets a user_space_access row and skips the prompt on any
 * device. A player has no account, so their unlock is remembered in this
 * browser instead — it used to be sessionStorage, which meant retyping the
 * password every time the tab was closed. It is a pool password on someone's
 * own device; asking again on every visit bought nothing.
 */
export function useSpaceAccess() {
  const { user, isLoggedIn } = useAuth();
  const [accessCache, setAccessCache] = useState(new Set());
  // Players only. Shared across PlayerLanding and GameBoard.
  const [sessionAccess, setSessionAccess] = useState(() => new Set(loadUnlocked()));

  const loadAccess = useCallback(async () => {
    if (!isLoggedIn || !user || !isSupabaseEnabled()) return;

    try {
      const { data, error } = await withTimeout(
        supabase.from("user_space_access").select("space_code").eq("user_id", user.id),
        8000,
        "space access"
      );

      if (error) throw error;
      setAccessCache(new Set((data || []).map((r) => r.space_code)));
    } catch (err) {
      console.error("Error loading space access:", err);
    }
  }, [user, isLoggedIn]);

  useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  const hasAccess = useCallback(
    (spaceCode) => {
      return accessCache.has(spaceCode) || sessionAccess.has(spaceCode);
    },
    [accessCache, sessionAccess]
  );

  const verifyAndGrantAccess = useCallback(
    async (spaceCode, password) => {
      if (!isSupabaseEnabled()) {
        return { ok: false, error: "Supabase is required for private spaces" };
      }
      try {
        // Verifies the password and records the grant in one call — the two
        // used to be separate RPCs, which let the grant be called on its own.
        const { data: ok, error } = await supabase.rpc("unlock_space", {
          p_code: spaceCode,
          p_password: password,
        });

        if (error) throw error;
        if (!ok) return { ok: false, error: "Incorrect password" };

        if (user) {
          setAccessCache((prev) => new Set([...prev, spaceCode]));
        } else {
          rememberUnlocked(spaceCode);
          setSessionAccess((prev) => new Set([...prev, spaceCode]));
        }
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err?.message || "Verification failed" };
      }
    },
    [user]
  );

  return { hasAccess, verifyAndGrantAccess, refetch: loadAccess };
}
