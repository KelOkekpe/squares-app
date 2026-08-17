import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseEnabled } from "../lib/supabase";
import { useAuth } from "./useAuth";

/**
 * Hook to manage admin invitations for a space.
 * Only owners can invite/remove admins.
 */
export function useSpaceAdmins(spaceCode) {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load admins for this space
  const loadAdmins = useCallback(async () => {
    if (!spaceCode) {
      setLoading(false);
      return;
    }
    if (!isSupabaseEnabled()) {
      setAdmins([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from("space_admins")
        .select(`
          id,
          space_code,
          user_id,
          email,
          role,
          invited_by,
          accepted,
          created_at
        `)
        .eq("space_code", spaceCode)
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;
      setAdmins(data || []);
      setError(null);
    } catch (err) {
      console.error("Error loading space admins:", err);
      setError(err);
      setAdmins([]);
    } finally {
      setLoading(false);
    }
  }, [spaceCode]);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  // Assign or invite a user by email. If they exist in user_profiles, assign with accepted: true.
  const inviteAdmin = useCallback(async (email) => {
    if (!spaceCode || !user) return { error: { message: "Not authorized" } };

    const trimmed = email.trim().toLowerCase();

    if (!isSupabaseEnabled()) {
      return { data: null, error: { message: "Supabase is required" } };
    }

    try {
      // Look up existing user by email (case-insensitive - auth may store different casing)
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id")
        .ilike("email", trimmed)
        .maybeSingle();

      const { data, error: insertError } = await supabase
        .from("space_admins")
        .upsert(
          {
            space_code: spaceCode,
            email: trimmed,
            user_id: profile?.id ?? null,
            role: "admin",
            invited_by: user.id,
            accepted: !!profile?.id,
          },
          { onConflict: "space_code,email" }
        )
        .select()
        .single();

      if (insertError) throw insertError;
      setAdmins((prev) => {
        const filtered = prev.filter((a) => a.email !== trimmed);
        return [...filtered, data];
      });
      return { data, error: null };
    } catch (err) {
      console.error("Error assigning admin:", err);
      return { data: null, error: err };
    }
  }, [spaceCode, user, admins]);

  // Remove an admin
  const removeAdmin = useCallback(async (adminId) => {
    if (!spaceCode || !user) return { error: { message: "Not authorized" } };
    if (!isSupabaseEnabled()) return { error: { message: "Supabase is required" } };

    try {
      const { error: deleteError } = await supabase
        .from("space_admins")
        .delete()
        .eq("id", adminId)
        .eq("space_code", spaceCode);

      if (deleteError) throw deleteError;
      setAdmins((prev) => prev.filter((a) => a.id !== adminId));
      return { error: null };
    } catch (err) {
      console.error("Error removing admin:", err);
      return { data: null, error: err };
    }
  }, [spaceCode, user, admins]);

  return {
    admins,
    loading,
    error,
    inviteAdmin,
    removeAdmin,
    refetch: loadAdmins,
  };
}
