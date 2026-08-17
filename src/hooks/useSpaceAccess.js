import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseEnabled } from "../lib/supabase";
import { useAuth } from "./useAuth";

const SESSION_ACCESS_KEY = "fb-space-access-guest";

function loadSessionAccess() {
  try {
    const raw = sessionStorage.getItem(SESSION_ACCESS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSessionAccess(set) {
  try {
    sessionStorage.setItem(SESSION_ACCESS_KEY, JSON.stringify([...set]));
  } catch {}
}

/**
 * Manages access to private spaces. Registered users who have entered the
 * correct password get a user_space_access record and skip the prompt next time.
 * Guests must enter the password every time (session-only, shared via sessionStorage).
 */
export function useSpaceAccess() {
  const { user, isLoggedIn } = useAuth();
  const [accessCache, setAccessCache] = useState(new Set());
  const [sessionAccess, setSessionAccess] = useState(loadSessionAccess); // guests only, shared across PlayerLanding/GameBoard

  const loadAccess = useCallback(async () => {
    if (!isLoggedIn || !user || !isSupabaseEnabled()) return;

    try {
      const { data, error } = await supabase
        .from("user_space_access")
        .select("space_code")
        .eq("user_id", user.id);

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
          setSessionAccess((prev) => {
            const next = new Set([...prev, spaceCode]);
            saveSessionAccess(next);
            return next;
          });
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
