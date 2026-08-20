/**
 * Routing helpers.
 *
 * Sites live on paths, spaces live in the fragment. They're separate
 * namespaces, so a space code can never shadow a site route:
 *
 *   /            → player landing (join a space)
 *   /admin       → admin site (sign in / sign up, then dashboard)
 *   /superadmin  → superadmin console (superadmin role only)
 *   /#<code>     → a space
 *
 * Two older link shapes still resolve, and are rewritten to /#<code> on
 * arrival: the original #/<code>, and the path form /<code>.
 */

export const ADMIN_PATH = "/admin";
export const SUPERADMIN_PATH = "/superadmin";

/** Lowercase, strip anything that isn't a-z, 0-9 or a dash. */
export function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Supabase returns auth results in the fragment — the same place we put space
 * codes. Email confirmation, magic links, recovery and auth errors all land as
 * #access_token=...&type=signup or #error=...&error_description=...
 *
 * These must never be treated as a space code, and must never be rewritten:
 * supabase-js reads the fragment on load, so clearing it loses the session.
 */
const AUTH_FRAGMENT_KEYS = [
  "access_token",
  "refresh_token",
  "provider_token",
  "error",
  "error_code",
  "error_description",
];

export function isAuthCallbackHash(hash) {
  const raw = String(hash || "").replace(/^#\/?/, "");
  if (!raw.includes("=")) return false;
  const params = new URLSearchParams(raw);
  return AUTH_FRAGMENT_KEYS.some((k) => params.has(k));
}

/** Human-readable message from an auth error fragment, or null. */
export function authErrorFromHash(hash) {
  const raw = String(hash || "").replace(/^#\/?/, "");
  if (!raw.includes("=")) return null;
  const params = new URLSearchParams(raw);
  const description = params.get("error_description");
  if (description) return description.replace(/\+/g, " ");
  const code = params.get("error_code") || params.get("error");
  return code ? `Sign-in failed (${code})` : null;
}

/** Shareable URL for a space, e.g. https://squares.app/#scriberfam */
export function spaceUrl(code) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/#${code}`;
}

/** Canonical in-app path for a space. */
export function spacePath(code) {
  return `/#${code}`;
}

/** Prefix shown next to space-code inputs, e.g. "localhost:3000/#" */
export function spaceUrlPrefix() {
  return typeof window !== "undefined" ? `${window.location.host}/#` : "";
}

/**
 * Read the current URL as a route object.
 *   { name: "player" } | { name: "admin" } | { name: "space", code }
 *
 * Returns a `redirectTo` when the URL should be rewritten to its canonical
 * form (legacy link shapes).
 */
export function parseLocation(pathname, hash) {
  // Checked before anything else, and deliberately without a redirectTo —
  // rewriting the URL here would throw away the tokens supabase-js needs.
  if (isAuthCallbackHash(hash)) return { name: "auth" };

  const segment = normalizeCode(String(pathname || "").split("/")[1] || "");

  // Sites are matched on the path first; a lingering fragment is ignored.
  if (segment === "superadmin") return { name: "superadmin" };
  if (segment === "admin") return { name: "admin" };

  // Spaces live in the fragment. Accepts both "#code" and the legacy "#/code".
  const rawHash = String(hash || "");
  const code = normalizeCode(rawHash.replace(/^#\/?/, ""));
  if (code) {
    const canonical = spacePath(code);
    const current = `${pathname || "/"}${rawHash}`;
    return current === canonical
      ? { name: "space", code }
      : { name: "space", code, redirectTo: canonical };
  }

  // Legacy path-form space link (/scriberfam) → /#scriberfam
  if (segment) return { name: "space", code: segment, redirectTo: spacePath(segment) };

  return { name: "player" };
}
