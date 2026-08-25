import { useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { useSpacesRegistry } from "./useSpacesRegistry";

/**
 * Creates a space and links the signed-in user to it as owner, so it shows up
 * in "My Spaces". It deliberately arrives with no board — the owner chooses
 * squares or pick'em on the way in.
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

      // No board is created here on purpose. A space used to arrive with a
      // "Pool 1" already in it — an empty Seahawks-vs-Patriots grid nobody
      // asked for, which the owner then had to notice was a placeholder and
      // rename or archive. The space now starts empty and asks what they want
      // to run.
      try {
        const metaKey = `fb-${code}-meta`;
        const { error: spacesErr } = await supabase
          .from("spaces")
          .insert([{ key: metaKey, space_code: code, pool_id: "", type: "meta", value: {} }]);
        if (spacesErr) {
          console.error("Could not initialize space data (spaces table):", spacesErr.message);
        }
      } catch (e) {
        console.error("Could not initialize space:", e);
      }

      refetchRegistry();
    },
    [user, profile, addSpace, refetchRegistry]
  );
}
