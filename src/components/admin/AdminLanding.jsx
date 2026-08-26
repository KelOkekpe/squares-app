import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  colors,
  radii,
  pageStyle,
  containerStyle,
  cardStyle,
  inputStyle,
  labelStyle,
  btnPrimary,
} from "../../styles";
import { BackgroundDecor } from "../layout/BackgroundDecor";
import { PasswordInput } from "../common";
import { ThemeToggle } from "../common";
import { LegalConsent } from "../common";

/**
 * Admin site entry point (/admin). Sign in or sign up with email + password.
 * Players never see this page.
 */
export function AdminLanding() {
  const {
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    requestPasswordReset,
    resendConfirmation,
  } = useAuth();

  const [mode, setMode] = useState("login"); // 'login' | 'register' | 'forgot'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  // The address just submitted, so the confirmation can be sent again.
  const [pendingConfirm, setPendingConfirm] = useState("");

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setSuccess("");
    setPendingConfirm("");
  };

  const handleResend = async () => {
    setError("");
    setLoading(true);
    const { error: resendError } = await resendConfirmation(pendingConfirm);
    setLoading(false);
    setSuccess(
      resendError
        ? `Couldn't resend it: ${resendError.message}`
        : `Sent again to ${pendingConfirm}. It can take a minute to arrive.`
    );
  };

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    const { error: oauthError } = await signInWithGoogle();
    // On success the browser navigates away, so loading is only cleared on failure
    if (oauthError) {
      setError(oauthError.message || "Could not start Google sign-in");
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setError("");
    setSuccess("");
    if (!email.trim()) {
      setError("Enter the email address you signed up with");
      return;
    }

    setLoading(true);
    const { error: resetError } = await requestPasswordReset(email.trim());
    setLoading(false);
    if (resetError) {
      setError(resetError.message || "Could not send the reset email");
      return;
    }

    // Deliberately the same message whether or not that address has an account.
    // Saying "no account found" would turn this into a way to check who is
    // registered.
    const sentTo = email.trim();
    setMode("login");
    setSuccess(`If ${sentTo} has an account, a reset link is on its way.`);
  };

  const handleSubmit = async () => {
    if (mode === "forgot") {
      await handleForgot();
      return;
    }
    setError("");
    setSuccess("");

    if (mode === "register" && !displayName.trim()) {
      setError("Please enter your name");
      return;
    }
    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }
    if (mode === "register" && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      if (mode === "register") {
        const { error: signUpError } = await signUpWithEmail(
          email.trim(),
          password,
          displayName.trim(),
          "owner"
        );
        if (signUpError) {
          setError(signUpError.message);
        } else {
          // If email confirmation is on there's no session yet, so land them
          // back on Sign In with an explanation. Otherwise AuthProvider will
          // flip straight through to the dashboard.
          //
          // The wording covers both outcomes deliberately. Supabase returns the
          // same success shape whether the account was created or the address
          // was already taken, and naming which one happened would turn this
          // form into a way to check who has an account. "Account created" was
          // worse than vague: someone re-signing-up an existing address was
          // told it had worked, then waited for an email that never came.
          const submitted = email.trim();
          setMode("login");
          setPassword("");
          setPendingConfirm(submitted);
          setSuccess(
            "Check your inbox for a confirmation link. If you already have an account, sign in instead."
          );
        }
      } else {
        const { error: signInError } = await signInWithEmail(email.trim(), password);
        if (signInError) setError(signInError.message);
      }
    } catch (err) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <BackgroundDecor />
      <div style={{ ...containerStyle, paddingTop: 80, paddingBottom: 60 }}>
        <div style={{ maxWidth: 420, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <ThemeToggle />
          </div>

          {/* Logo */}
          <div style={{ marginBottom: 40 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: `linear-gradient(135deg, ${colors.accentBrand}, ${colors.accentBrandAlt})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                margin: "0 auto 18px",
              }}
            >
              🏈
            </div>
            <h1
              style={{
                fontSize: 36,
                fontWeight: 900,
                lineHeight: 1.1,
                margin: "0 0 10px",
                letterSpacing: -1.5,
                background: `linear-gradient(135deg, ${colors.headline} 30%, ${colors.accentBrandAlt})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              SQUAREPOOL
            </h1>
            <p
              style={{
                color: colors.accentGold,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              Admin
            </p>
            <p style={{ color: colors.textMuted, fontSize: 14, margin: "12px 0 0" }}>
              Create spaces, run boards, invite admins.
            </p>
          </div>

          <div style={cardStyle}>
            {/* Sign in / Sign up toggle */}
            <div
              style={{
                display: "flex",
                background: colors.surface3,
                borderRadius: radii.pill,
                border: `1px solid ${colors.border}`,
                padding: 4,
                marginBottom: 24,
              }}
            >
              {[
                { key: "login", label: "Sign In" },
                { key: "register", label: "Sign Up" },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => switchMode(m.key)}
                  style={{
                    flex: 1,
                    padding: "10px 20px",
                    borderRadius: radii.pill,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 14,
                    transition: "all 0.2s",
                    fontFamily: "inherit",
                    background:
                      mode === m.key
                        ? `linear-gradient(135deg, ${colors.accentBrand}, ${colors.accentBrandAlt})`
                        : "transparent",
                    color: mode === m.key ? colors.white : colors.textMuted,
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Google — players never see this; /admin is the only entry point */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 20px",
                borderRadius: radii.lg,
                border: `1px solid ${colors.borderSubtle}`,
                background: colors.surface4,
                color: colors.textPrimary,
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                fontFamily: "inherit",
                opacity: loading ? 0.6 : 1,
                marginBottom: 18,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ flex: 1, height: 1, background: colors.border }} />
              <span style={{ color: colors.textDim, fontSize: 12, fontWeight: 600 }}>OR</span>
              <div style={{ flex: 1, height: 1, background: colors.border }} />
            </div>

            <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 14 }}>
              {mode === "register" && (
                <div>
                  <label style={labelStyle}>Name</label>
                  <input
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      setError("");
                    }}
                    style={inputStyle}
                    placeholder="Your display name"
                  />
                </div>
              )}
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  style={inputStyle}
                  placeholder="you@example.com"
                />
              </div>
              {mode !== "forgot" && (
                <div>
                  <label style={labelStyle}>Password</label>
                  <PasswordInput
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    style={inputStyle}
                    placeholder={mode === "register" ? "At least 6 characters" : "Your password"}
                  />
                </div>
              )}
            </div>

            {error && (
              <p
                style={{
                  color: colors.accentRed,
                  fontSize: 13,
                  margin: "14px 0 0",
                  textAlign: "left",
                }}
              >
                {error}
              </p>
            )}
            {success && (
              <p
                style={{
                  color: colors.accentGreen,
                  fontSize: 13,
                  margin: "14px 0 0",
                  textAlign: "left",
                }}
              >
                {success}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              style={{
                ...btnPrimary,
                width: "100%",
                marginTop: 20,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading
                ? "…"
                : mode === "register"
                  ? "Create Account"
                  : mode === "forgot"
                    ? "Email me a reset link"
                    : "Sign In"}
            </button>

            {/* Only on the branch that creates an account — signing in again
                does not re-form the agreement, and the notice would just be
                noise on a screen someone sees every week. */}
            {mode === "register" && <LegalConsent action="creating an account" />}

            {/* Only on sign-in: there is nothing to recover mid-signup, and the
                recovery screen is where you land coming back from the email. */}
            {/* Only after a signup attempt, and only on sign-in: this is the
                one moment the address is known and the email may be missing. */}
            {mode === "login" && pendingConfirm && (
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                style={{
                  background: "none",
                  border: "none",
                  color: colors.accentBrandAlt,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  marginTop: 14,
                  padding: 0,
                  display: "block",
                  width: "100%",
                }}
              >
                Didn't get the email? Send it again
              </button>
            )}

            {mode === "login" && (
              <button
                type="button"
                onClick={() => switchMode("forgot")}
                style={{
                  background: "none",
                  border: "none",
                  color: colors.textDim,
                  fontSize: 13,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  marginTop: 14,
                  padding: 0,
                }}
              >
                Forgot your password?
              </button>
            )}

            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => switchMode("login")}
                style={{
                  background: "none",
                  border: "none",
                  color: colors.accentBrandAlt,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  marginTop: 14,
                  padding: 0,
                }}
              >
                ← Back to sign in
              </button>
            )}

            {mode === "register" && (
              <p style={{ color: colors.textDim, fontSize: 11, margin: "12px 0 0" }}>
                Invited to admin someone else's space? Sign up with the email you were invited by
                and it will show up automatically.
              </p>
            )}
          </div>

          <p style={{ color: colors.textDim, fontSize: 12, margin: "24px 0 0" }}>
            Just here to play?{" "}
            <a
              href="/"
              style={{ color: colors.accentBrandAlt, fontWeight: 600, textDecoration: "none" }}
            >
              Join a space
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
