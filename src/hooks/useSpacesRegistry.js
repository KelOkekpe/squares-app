import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, isSupabaseEnabled, recoverFromStaleSession } from "../lib/supabase";
import { withTimeout, isStaleSessionError } from "../utils/async";

/**
 * Manages the global spaces registry (Supabase spaces_registry table).
 * Supabase is required.
 */
export function useSpacesRegistry() {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // One recovery attempt per mount, so a genuinely broken backend can't loop
  const recoveredRef = useRef(false);

  const loadSpaces = useCallback(async () => {
    if (!isSupabaseEnabled()) {
      setSpaces([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const query = () =>
        withTimeout(
          supabase
            .from("spaces_registry")
            .select("code, admin_name, created_at, is_private")
            .order("created_at", { ascending: false }),
          8000,
          "spaces registry"
        );

      let result;
      try {
        result = await query();
      } catch (err) {
        // A stale stored session stalls even anonymous reads. Drop it and retry
        // once — this is what clearing site data by hand was accomplishing.
        if (!isStaleSessionError(err) || recoveredRef.current) throw err;
        recoveredRef.current = true;
        console.warn("Registry load failed; clearing stale session and retrying:", err?.message || err);
        recoverFromStaleSession();
        result = await query();
      }

      const { data, error: queryError } = result;
      if (queryError) throw queryError;
      const list = (data || []).map((row) => ({
        code: row.code,
        admin: row.admin_name ?? null,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
        isPrivate: !!row.is_private,
      }));
      setSpaces(list);
    } catch (err) {
      console.error("Error loading spaces registry:", err);
      setSpaces([]);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  // Tabs left open get suspended, and the token can expire while they sleep.
  // Reload when the tab comes back so returning to it doesn't show stale or
  // empty data — this is the "after periods of inactivity" case.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") loadSpaces();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [loadSpaces]);

  const addSpace = useCallback(
    async (code, adminName, isPrivate = false, password = "", ownerId = null) => {
      if (!isSupabaseEnabled()) {
        throw new Error("Supabase is required to create spaces");
      }

      const entry = {
        code,
        admin: adminName,
        createdAt: Date.now(),
        isPrivate: !!isPrivate,
      };

      try {
        const { data: existing } = await supabase
          .from("spaces_registry")
          .select("code")
          .eq("code", code)
          .maybeSingle();

        if (existing) {
          throw new Error(`Space "${code}" already exists`);
        }

        if (isPrivate && password?.trim()) {
          const { error } = await supabase.rpc("create_space", {
            p_code: code,
            p_admin_name: adminName,
            p_is_private: true,
            p_password: password.trim(),
            p_owner_id: ownerId,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.from("spaces_registry").insert({
            code,
            admin_name: adminName,
            is_private: false,
            owner_id: ownerId,
          });
          if (error) throw error;
        }

        setSpaces((prev) => [...prev, entry]);
      } catch (err) {
        throw err;
      }
    },
    []
  );

  return { spaces, addSpace, loading, error, refetch: loadSpaces };
}
