import { createClient } from "@supabase/supabase-js";

// These will be set via environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate URL format
const isValidUrl = (url) => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

// Check if credentials are valid — Supabase is required; no localStorage fallback
const hasValidCredentials = supabaseUrl && supabaseAnonKey && isValidUrl(supabaseUrl);

// Create Supabase client (null only when credentials are missing or invalid)
export const supabase = hasValidCredentials ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseEnabled = () => supabase !== null;

/**
 * Drop the persisted auth token.
 *
 * A stale refresh token makes supabase-js hang while trying to refresh, which
 * stalls every query — including the ones anonymous players depend on, who
 * never needed a session in the first place. Clearing it is what a user would
 * otherwise be doing by hand via devtools.
 */
export function clearAuthStorage() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-") && k.includes("-auth-token")) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    return keys.length;
  } catch {
    return 0;
  }
}

/**
 * Recover from a session we can't use. Clears storage synchronously so the next
 * request goes out anonymously; signOut is fired without awaiting because it
 * can hang on the same lock we're recovering from.
 */
export function recoverFromStaleSession() {
  const cleared = clearAuthStorage();
  try {
    supabase?.auth.signOut({ scope: "local" }).catch(() => {});
  } catch {
    /* ignore */
  }
  return cleared;
}
