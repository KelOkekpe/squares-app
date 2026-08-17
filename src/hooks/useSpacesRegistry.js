import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseEnabled } from "../lib/supabase";

/**
 * Manages the global spaces registry (Supabase spaces_registry table).
 * Supabase is required.
 */
export function useSpacesRegistry() {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadSpaces = useCallback(async () => {
    if (!isSupabaseEnabled()) {
      setSpaces([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("spaces_registry")
        .select("code, admin_name, created_at, is_private")
        .order("created_at", { ascending: false });

      if (error) throw error;
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSpaces();
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

  return { spaces, addSpace, loading, refetch: loadSpaces };
}
