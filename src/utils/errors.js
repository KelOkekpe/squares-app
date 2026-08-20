/**
 * Deciding which database errors a player should actually read.
 *
 * Messages raised by our own RPCs with RAISE EXCEPTION are written for humans
 * ("Email is required", "Too many requests from this email address") and should
 * be shown as-is. Everything else — a missing function, a stale schema cache, a
 * policy rejection — is infrastructure leaking through, and telling a player
 * "Could not find the function public.submit_entry_request(...) in the schema
 * cache" helps nobody and exposes internals.
 */

// PostgREST surfaces a Postgres RAISE EXCEPTION as P0001
const DELIBERATE = "P0001";

// Infrastructure conditions worth naming distinctly to whoever reads the console
const INFRA_HINTS = [
  "schema cache",
  "does not exist",
  "permission denied",
  "violates row-level security",
  "JWT",
];

export function playerFacingError(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;

  if (error.code === DELIBERATE && error.message) return error.message;

  const raw = `${error.message || ""} ${error.details || ""}`.toLowerCase();
  const looksInfra = INFRA_HINTS.some((h) => raw.includes(h.toLowerCase()));

  // Keep the real detail where an admin can find it, show the player something useful
  console.error("Supabase error:", error);

  if (looksInfra) {
    return "This space isn't set up correctly yet. Let your admin know.";
  }
  return error.message && error.message.length < 120 ? error.message : fallback;
}
