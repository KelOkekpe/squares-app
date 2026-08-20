import { useCallback } from "react";
import { supabase } from "../lib/supabase";
import { DEFAULT_CONFIG, addDaysISO } from "../utils";
import { useAuth } from "./useAuth";
import { useSpacesRegistry } from "./useSpacesRegistry";

/**
 * Creates a space, its first pool, and its initial config, then links the
 * signed-in user to it as owner so it shows up in "My Spaces".
 */
export function useCreateSpace() {
  const { user, profile } = useAuth();
  const { addSpace, refetch: refetchRegistry } = useSpacesRegistry();

  return useCallback(
    async (code, isPrivate = false, spacePassword = "") => {
      const adminName =
        profile?.display_name || user?.email || user?.user_metadata?.display_name || "Admin";
      await addSpace(code, adminName, isPrivate, spacePassword, user?.id ?? null);

      // Link the creator as owner before writing anything else — RLS on `pools`
      // and `spaces` checks space membership, so this has to land first.
      if (user?.email) {
        const { error } = await supabase.from("space_admins").upsert(
          {
            space_code: code,
            user_id: user.id,
            email: user.email,
            role: "owner",
            accepted: true,
          },
          { onConflict: "space_code,email" }
        );
        if (error) console.warn("Could not link space to owner:", error);
      }

      // Create first pool and initialize space meta + config in Supabase (spaces table)
      try {
        const { data: pool, error: poolErr } = await supabase
          .from("pools")
          .insert({
            space_code: code,
            name: "Pool 1",
            archived: false,
            // Boards require an end date; the first one gets a 90-day default
            // the owner can change in the admin panel.
            expires_at: addDaysISO(90),
          })
          .select("id")
          .single();
        if (poolErr || !pool) {
          console.error("Could not create default pool:", poolErr?.message || poolErr);
        } else {
          const meta = { activePoolId: pool.id };
          const metaKey = `fb-${code}-meta`;
          const adminKey = `fb-${code}-${pool.id}-admin`;
          const { error: spacesErr } = await supabase.from("spaces").insert([
            { key: metaKey, space_code: code, pool_id: "", type: "meta", value: meta },
            {
              key: adminKey,
              space_code: code,
              pool_id: pool.id,
              type: "admin",
              value: { ...DEFAULT_CONFIG },
            },
          ]);
          if (spacesErr) {
            console.error("Could not initialize space data (spaces table):", spacesErr.message);
          }
        }
      } catch (e) {
        console.error("Could not initialize space:", e);
      }

      refetchRegistry();
    },
    [user, profile, addSpace, refetchRegistry]
  );
}
