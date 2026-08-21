import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env.js";

/**
 * Service-role client. Bypasses RLS entirely, so it exists only inside
 * serverless functions and is never constructed from anything the browser can
 * reach.
 */
export function adminClient() {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * Resolve the caller's Supabase session from the Authorization header and
 * confirm they administer the space in question.
 *
 * The client is untrusted: it sends a JWT, not a user id or a claim about
 * which space it owns.
 */
export async function requireSpaceAdmin(req, spaceCode) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return { error: "Not signed in", status: 401 };

  const supabase = adminClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) return { error: "Not signed in", status: 401 };

  const user = userData.user;

  const [{ data: membership }, { data: registry }] = await Promise.all([
    supabase
      .from("space_admins")
      .select("role")
      .eq("space_code", spaceCode)
      .eq("user_id", user.id)
      .eq("accepted", true)
      .maybeSingle(),
    supabase.from("spaces_registry").select("owner_id").eq("code", spaceCode).maybeSingle(),
  ]);

  const isAdmin = !!membership || registry?.owner_id === user.id;
  if (!isAdmin) return { error: "You do not administer this space", status: 403 };

  return { supabase, user };
}
