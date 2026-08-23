import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

/**
 * Entrant contact details, for the admin console only.
 *
 * These live in `pickem_contacts` rather than in the sheets themselves — the
 * sheets are readable by every player, and an email address has no business
 * travelling with them. RLS on the table is the gate; this returns an empty map
 * for anyone who isn't an admin of the space.
 */
export function usePickemContacts(spaceCode, poolId, enabled = true) {
  const [contacts, setContacts] = useState({});

  useEffect(() => {
    if (!enabled || !spaceCode || !poolId) {
      setContacts({});
      return undefined;
    }
    let mounted = true;

    (async () => {
      const { data, error } = await supabase
        .from("pickem_contacts")
        .select("entry_id, email, phone")
        .eq("space_code", spaceCode)
        .eq("pool_id", poolId);

      if (!mounted) return;
      if (error) {
        console.error("Could not load entrant contacts:", error.message);
        return;
      }
      setContacts(
        Object.fromEntries(
          (data || []).map((r) => [r.entry_id, { email: r.email, phone: r.phone }])
        )
      );
    })();

    return () => {
      mounted = false;
    };
  }, [spaceCode, poolId, enabled]);

  return contacts;
}
