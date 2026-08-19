import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseEnabled } from "../lib/supabase";
import { withTimeout } from "../utils/async";
import { useAuth } from "./useAuth";

/**
 * Returns spaces the current user belongs to (from space_admins).
 * Supabase required. Each item: { code, role?, isAdmin?, isPrivate? }
 */
export function useUserSpaces() {
  const { user, isLoggedIn } = useAuth();
  const [dbSpaces, setDbSpaces] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadSpaces = useCallback(async () => {
    if (!isLoggedIn || !user) {
      setDbSpaces([]);
      setLoading(false);
      return;
    }
    if (!isSupabaseEnabled() || !supabase) {
      setDbSpaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("space_admins")
          .select("space_code, role, accepted")
          .eq("user_id", user.id)
          .eq("accepted", true),
        8000,
        "user spaces"
      );

      if (error) throw error;
      const rows = data || [];
      if (rows.length === 0) {
        setDbSpaces([]);
        setLoading(false);
        return;
      }
      const codes = rows.map((r) => r.space_code);
      const { data: registry } = await withTimeout(
        supabase.from("spaces_registry").select("code, is_private").in("code", codes),
        8000,
        "user space privacy"
      );
      const privMap = Object.fromEntries((registry || []).map((r) => [r.code, !!r.is_private]));
      const list = rows.map((row) => ({
        code: row.space_code,
        role: row.role,
        isAdmin: row.role === "owner" || row.role === "admin",
        isPrivate: privMap[row.space_code] ?? false,
      }));
      setDbSpaces(list);
    } catch (err) {
      console.error("Error loading user spaces:", err);
      setDbSpaces([]);
    } finally {
      setLoading(false);
    }
  }, [user, isLoggedIn]);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  return { spaces: dbSpaces, loading, refetch: loadSpaces };
}
