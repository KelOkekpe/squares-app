import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

/**
 * Entrant contact details, for the admin console only.
 *
 * These used to live in the participants blob, which every player can read —
 * the board draws its names from it. They're in `entry_contacts` now, where RLS
 * limits them to admins of the space; this returns an empty map for anyone
 * else, so a non-admin rendering the same component simply sees nothing.
 */
export function useEntryContacts(spaceCode, poolId, enabled = true) {
  const [contacts, setContacts] = useState({});

  const load = useCallback(async () => {
    if (!enabled || !spaceCode || !poolId) {
      setContacts({});
      return;
    }
    const { data, error } = await supabase
      .from("entry_contacts")
      .select("entry_id, email, payout_method, payout_handles")
      .eq("space_code", spaceCode)
      .eq("pool_id", poolId);

    if (error) {
      console.error("Could not load entrant contacts:", error.message);
      return;
    }
    setContacts(
      Object.fromEntries(
        (data || []).map((r) => [
          r.entry_id,
          {
            email: r.email,
            payoutMethod: r.payout_method,
            payoutHandles: r.payout_handles,
          },
        ])
      )
    );
  }, [spaceCode, poolId, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  /** Called on approval, alongside the participant being written to the blob. */
  const saveContact = useCallback(
    async (entryId, entry) => {
      if (!spaceCode || !poolId || !entryId) return { error: null };
      const { error } = await supabase.from("entry_contacts").upsert(
        {
          space_code: spaceCode,
          pool_id: poolId,
          entry_id: entryId,
          name: entry.name || null,
          email: entry.email || null,
          payout_method: entry.payoutMethod || null,
          payout_handles: entry.payoutHandles || null,
        },
        { onConflict: "space_code,pool_id,entry_id" }
      );
      if (error) {
        console.error("Could not save entrant contact:", error.message);
        return { error: error.message };
      }
      setContacts((prev) => ({
        ...prev,
        [entryId]: {
          email: entry.email || null,
          payoutMethod: entry.payoutMethod || null,
          payoutHandles: entry.payoutHandles || null,
        },
      }));
      return { error: null };
    },
    [spaceCode, poolId]
  );

  const removeContact = useCallback(
    async (entryId) => {
      if (!spaceCode || !poolId || !entryId) return;
      await supabase
        .from("entry_contacts")
        .delete()
        .eq("space_code", spaceCode)
        .eq("pool_id", poolId)
        .eq("entry_id", entryId);
      setContacts((prev) => {
        const next = { ...prev };
        delete next[entryId];
        return next;
      });
    },
    [spaceCode, poolId]
  );

  /** A whole board reset takes every contact with it. */
  const clearContacts = useCallback(async () => {
    if (!spaceCode || !poolId) return;
    await supabase
      .from("entry_contacts")
      .delete()
      .eq("space_code", spaceCode)
      .eq("pool_id", poolId);
    setContacts({});
  }, [spaceCode, poolId]);

  return { contacts, refresh: load, saveContact, removeContact, clearContacts };
}
