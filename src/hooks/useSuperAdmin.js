import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { withTimeout } from "../utils/async";

const VIEW_AS_KEY = "sb-view-as";

function loadViewAs() {
  try {
    const raw = sessionStorage.getItem(VIEW_AS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Superadmin console data layer.
 *
 * Every call goes through a SECURITY DEFINER RPC that re-checks is_superadmin()
 * server-side — the client-side role check is for UI only and is not the
 * security boundary.
 */
export function useSuperAdmin() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Survives navigation so the banner can't be lost by clicking into a space
  const [viewAs, setViewAs] = useState(loadViewAs);

  const call = useCallback(async (fn, args = {}) => {
    const { data, error: rpcError } = await withTimeout(supabase.rpc(fn, args), 10000, fn);
    if (rpcError) throw rpcError;
    return data;
  }, []);

  const refresh = useCallback(
    async (search = "") => {
      setLoading(true);
      setError("");
      try {
        const [s, u, sp, a] = await Promise.all([
          call("superadmin_stats"),
          call("superadmin_list_users", { p_search: search || null }),
          call("superadmin_list_spaces", { p_search: search || null }),
          call("superadmin_audit_log", { p_limit: 100 }),
        ]);
        setStats(s || null);
        setUsers(u || []);
        setSpaces(sp || []);
        setAudit(a || []);
      } catch (err) {
        const message = err?.message || "Could not load superadmin data";
        // "permission denied for function" means EXECUTE was never granted,
        // which is a different problem from not holding the role — and it has
        // a specific fix rather than being a mystery.
        setError(
          /permission denied for function/i.test(message)
            ? `${message} — run supabase/migration_fix_superadmin_grants.sql in the SQL Editor.`
            : message
        );
      } finally {
        setLoading(false);
      }
    },
    [call]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Each action refreshes so the dashboard can't drift from the database
  const act = useCallback(
    async (fn, args) => {
      setError("");
      try {
        await call(fn, args);
        await refresh();
        return { ok: true };
      } catch (err) {
        const message = err?.message || "Action failed";
        setError(message);
        return { ok: false, error: message };
      }
    },
    [call, refresh]
  );

  const startViewAs = useCallback(
    async (userId) => {
      try {
        const snapshot = await call("superadmin_view_as", { p_user_id: userId });
        setViewAs(snapshot);
        try {
          sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(snapshot));
        } catch {}
        return { ok: true };
      } catch (err) {
        const message = err?.message || "Could not open that account";
        setError(message);
        return { ok: false, error: message };
      }
    },
    [call]
  );

  const stopViewAs = useCallback(() => {
    setViewAs(null);
    try {
      sessionStorage.removeItem(VIEW_AS_KEY);
    } catch {}
  }, []);

  return {
    stats,
    users,
    spaces,
    audit,
    loading,
    error,
    setError,
    refresh,
    viewAs,
    startViewAs,
    stopViewAs,
    closeAccount: (id, reason) =>
      act("superadmin_close_account", { p_user_id: id, p_reason: reason || null }),
    reopenAccount: (id) => act("superadmin_reopen_account", { p_user_id: id }),
    setRole: (id, role) => act("superadmin_set_role", { p_user_id: id, p_role: role }),
    resetSpacePassword: (code, password) =>
      act("superadmin_reset_space_password", {
        p_space_code: code,
        p_new_password: password || null,
      }),
    transferSpace: (code, newOwner) =>
      act("superadmin_transfer_space", { p_space_code: code, p_new_owner: newOwner }),
    deleteSpace: (code) => act("superadmin_delete_space", { p_space_code: code }),
  };
}
