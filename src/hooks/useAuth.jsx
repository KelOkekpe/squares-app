import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  supabase,
  isSupabaseEnabled,
  clearAuthStorage,
  recoverFromStaleSession,
} from "../lib/supabase";
import { withTimeout, isUnusableSessionError } from "../utils/async";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // Supabase auth user
  const [profile, setProfile] = useState(null); // user_profiles row
  const [loading, setLoading] = useState(true);
  // True from a recovery link until the password is actually changed.
  const [recovering, setRecovering] = useState(false);
  // Which user's profile is already loaded, so a token refresh doesn't refetch it
  const profileForRef = useRef(null);

  // Load user profile from user_profiles table
  const loadProfile = useCallback(async (authUser) => {
    if (!authUser || !isSupabaseEnabled()) {
      setProfile(null);
      return null;
    }
    try {
      const { data, error } = await withTimeout(
        supabase.from("user_profiles").select("*").eq("id", authUser.id).maybeSingle(),
        8000,
        "profile load"
      );

      if (error) throw error;
      setProfile(data);
      return data;
    } catch (err) {
      console.error("Error loading profile:", err);
      setProfile(null);
      return null;
    }
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    if (!isSupabaseEnabled()) {
      setLoading(false);
      return;
    }

    // Get initial session.
    //
    // This used to have no .catch(): if getSession() rejected or hung on a
    // stale refresh token, `loading` stayed true forever and the app sat on
    // "Loading…" until localStorage was cleared by hand. Now a failure drops
    // the unusable session and continues as signed-out, which is recoverable.
    let cancelled = false;
    withTimeout(supabase.auth.getSession(), 15000, "auth session")
      .then((result) => {
        if (cancelled) return;
        const authUser = result?.data?.session?.user ?? null;
        setUser(authUser);
        if (authUser) {
          profileForRef.current = authUser.id;
          loadProfile(authUser).finally(() => !cancelled && setLoading(false));
        } else {
          setProfile(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;

        // Only an explicit rejection means the session is unusable. A timeout
        // means the response was slow — which is normal returning from an
        // external redirect like Stripe Checkout — and clearing credentials
        // there logs the user out of a perfectly good session.
        if (isUnusableSessionError(err)) {
          console.warn("Session rejected — clearing credentials:", err?.message || err);
          recoverFromStaleSession();
          setUser(null);
          setProfile(null);
        } else {
          console.warn("Session restore was slow; keeping credentials:", err?.message || err);
          // onAuthStateChange still fires when it resolves, so the session
          // recovers on its own rather than being thrown away.
        }
        setLoading(false);
      });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const authUser = session?.user ?? null;

      // A recovery link signs the user in *and* fires this. Reading the
      // fragment instead would be a race — supabase-js clears it as soon as it
      // has consumed the token, and it does that before React renders. This
      // event is the only reliable signal that the session came from a "forgot
      // password" link rather than an ordinary sign-in.
      if (event === "PASSWORD_RECOVERY") setRecovering(true);

      // supabase-js refreshes the token whenever a tab regains focus, and fires
      // this with a fresh object for the same person. Handing that down changes
      // identity for every consumer, re-running their queries and blanking the
      // screen behind a loading gate. Keep the previous object when it's the
      // same user.
      setUser((prev) => (authUser ? (prev?.id === authUser.id ? prev : authUser) : null));

      if (authUser) {
        // Same reasoning: don't refetch a profile we already hold
        if (profileForRef.current !== authUser.id) {
          profileForRef.current = authUser.id;
          await loadProfile(authUser);
        }
      } else {
        profileForRef.current = null;
        setProfile(null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  // ── Sign up with email/password ──
  // Only the /admin site offers sign-up, so accounts default to 'owner'.
  const signUpWithEmail = useCallback(async (email, password, displayName, role = "owner") => {
    if (!isSupabaseEnabled()) {
      return { user: null, error: { message: "Supabase is required" } };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          role: role, // 'owner' or 'player'
        },
      },
    });

    if (error) return { user: null, error };

    // Supabase does not error when the address is already registered — it
    // returns a success-shaped response with an empty `identities` array, so
    // the signup form can't be used to discover who has an account. Nothing is
    // created and, in that case, no confirmation email goes out either.
    //
    // Reported as a flag rather than an error: saying "that email is taken"
    // would give away exactly what the obfuscation exists to hide.
    const alreadyRegistered = Array.isArray(data?.user?.identities)
      ? data.user.identities.length === 0
      : false;
    if (alreadyRegistered) return { user: data.user, error: null, alreadyRegistered: true };

    // The profile is auto-created by the database trigger; ensure role is persisted
    // (trigger may not receive metadata in some flows, so we explicitly upsert)
    if (data.user) {
      const prof = {
        id: data.user.id,
        email,
        display_name: displayName,
        role,
      };
      setProfile(prof);
      try {
        await supabase
          .from("user_profiles")
          .upsert(
            { id: data.user.id, email, display_name: displayName, role },
            { onConflict: "id" }
          );
      } catch (e) {
        console.warn("Could not persist profile role:", e);
      }
    }

    return { user: data.user, error: null };
  }, []);

  // ── Sign in with email/password ──
  const signInWithEmail = useCallback(
    async (email, password) => {
      if (!isSupabaseEnabled()) {
        return { user: null, error: { message: "Supabase is required" } };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { user: null, error };

      if (data.user) {
        loadProfile(data.user).catch((err) => console.warn("Profile load failed:", err));
      }

      return { user: data.user, error: null };
    },
    [loadProfile]
  );

  /**
   * Send the confirmation email again.
   *
   * The single most common alpha support request: the first one is lost,
   * filtered, or clicked after it expired, and without this the only way out is
   * an admin deleting the half-created account by hand.
   */
  const resendConfirmation = useCallback(async (email) => {
    if (!isSupabaseEnabled()) {
      return { error: { message: "Supabase is required" } };
    }
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    });
    return { error };
  }, []);

  // ── Password reset ──
  // Supabase returns the recovery session in the URL fragment, same as a
  // confirmation link. It's sent to /admin so the callback lands on the site
  // that owns sign-in rather than the marketing page.
  //
  // The result is deliberately not distinguished between a known and unknown
  // address: telling a caller which is which turns this into a way to check
  // who has an account.
  const requestPasswordReset = useCallback(async (email) => {
    if (!isSupabaseEnabled()) {
      return { error: { message: "Supabase is required" } };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/admin`,
    });
    return { error };
  }, []);

  // Called from the recovery screen. The session already exists by then —
  // supabase-js consumed the token from the fragment — so this is an ordinary
  // authenticated update.
  const updatePassword = useCallback(async (password) => {
    if (!isSupabaseEnabled()) {
      return { error: { message: "Supabase is required" } };
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setRecovering(false);
    return { error };
  }, []);

  /** Leaving the recovery screen without setting a password. */
  const endRecovery = useCallback(() => setRecovering(false), []);

  // ── Sign in with Google ──
  // Only offered on /admin — players never sign in. Supabase returns the
  // session in the URL fragment, which parseLocation() already recognises as
  // an auth callback rather than a space code.
  const signInWithGoogle = useCallback(async () => {
    if (!isSupabaseEnabled()) {
      return { error: { message: "Supabase is required" } };
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/admin` },
    });
    return { error };
  }, []);

  // Google sends no role, so handle_new_user() defaults an OAuth signup to
  // 'player'. This promotes a genuinely new signup to 'owner' server-side;
  // it deliberately leaves invited admins (who already have a membership row)
  // and superadmins alone. See migration_google_oauth.sql.
  const claimOwnerRole = useCallback(async () => {
    if (!isSupabaseEnabled()) return null;
    try {
      const { data, error } = await withTimeout(
        supabase.rpc("claim_owner_role"),
        8000,
        "claim owner role"
      );
      if (error) throw error;
      if (data) setProfile((prev) => (prev ? { ...prev, role: data } : prev));
      return data;
    } catch (err) {
      console.warn("Could not settle account role:", err?.message || err);
      return null;
    }
  }, []);

  // ── Sign out ──
  // Clear local state and Supabase auth storage immediately so the UI updates
  // right away. When the server is down or restarted, supabase.auth.signOut()
  // can hang on its revocation request; we must not await it or the user will
  // appear stuck. We clear localStorage ourselves so a refresh stays logged out.
  const signOut = useCallback(() => {
    if (!isSupabaseEnabled()) {
      setUser(null);
      setProfile(null);
      return;
    }
    setUser(null);
    setProfile(null);
    clearAuthStorage();
    supabase.auth.signOut({ scope: "local" }).catch((err) => {
      console.warn("Sign out (background):", err);
    });
  }, []);

  // ── Update profile ──
  const updateProfile = useCallback(
    async (updates) => {
      if (!user) return { error: { message: "Not logged in" } };
      if (!isSupabaseEnabled()) return { error: { message: "Supabase is required" } };

      const { error } = await supabase.from("user_profiles").update(updates).eq("id", user.id);

      if (!error) {
        setProfile((prev) => ({ ...prev, ...updates }));
      }
      return { error };
    },
    [user, profile]
  );

  // ── Role checks ── (fallback to user_metadata for signup where profile may lag)
  const roleFromProfile = profile?.role;
  const roleFromMetadata = user?.user_metadata?.role;
  const effectiveRole = roleFromProfile || roleFromMetadata;
  const isOwner = effectiveRole === "owner";
  const isSuperadmin = roleFromProfile === "superadmin"; // profile only — never trust user_metadata for this
  const isClosed = !!profile?.closed_at;
  const isLoggedIn = !!user;

  // Check if user is admin/owner of a specific space
  const getSpaceRole = useCallback(
    async (spaceCode) => {
      if (!user || !isSupabaseEnabled()) return null;

      try {
        const { data, error } = await supabase
          .from("space_admins")
          .select("role, accepted")
          .eq("space_code", spaceCode)
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (data && data.accepted) return data.role; // 'owner' or 'admin'

        // No linked row - try claiming a pending invite (e.g. invited before profile existed)
        const { data: claimedRole } = await supabase.rpc("accept_space_invite", {
          p_space_code: spaceCode,
        });
        if (claimedRole) return claimedRole;

        return null;
      } catch {
        return null;
      }
    },
    [user]
  );

  const isSpaceAdmin = useCallback(
    async (spaceCode) => {
      const role = await getSpaceRole(spaceCode);
      return role === "owner" || role === "admin";
    },
    [getSpaceRole]
  );

  const isSpaceOwner = useCallback(
    async (spaceCode) => {
      const role = await getSpaceRole(spaceCode);
      return role === "owner";
    },
    [getSpaceRole]
  );

  const value = {
    user,
    profile,
    loading,
    isLoggedIn,
    isOwner,
    isSuperadmin,
    isClosed,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    resendConfirmation,
    requestPasswordReset,
    updatePassword,
    recovering,
    endRecovery,
    claimOwnerRole,
    signOut,
    updateProfile,
    getSpaceRole,
    isSpaceAdmin,
    isSpaceOwner,
    loadProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
