import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { colors, radii, pageStyle, containerStyle, cardStyle, inputStyle, labelStyle, btnPrimary } from "../../styles";
import { BackgroundDecor } from "../layout/BackgroundDecor";

/**
 * Admin site entry point (/admin). Sign in or sign up with email + password.
 * Players never see this page.
 */
export function AdminLanding() {
  const { signUpWithEmail, signInWithEmail } = useAuth();

  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async () => {
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
          setMode("login");
          setPassword("");
          setSuccess("Account created. Confirm your email if prompted, then sign in.");
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

          {/* Logo */}
          <div style={{ marginBottom: 40 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`,
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
                background: `linear-gradient(135deg, ${colors.white} 30%, ${colors.accentViolet})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              SQUAREBET
            </h1>
            <p style={{
              color: colors.accentGold,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              margin: 0,
            }}>
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
                background: "#ffffff06",
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
                    background: mode === m.key
                      ? `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`
                      : "transparent",
                    color: mode === m.key ? colors.white : colors.textMuted,
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 14 }}>
              {mode === "register" && (
                <div>
                  <label style={labelStyle}>Name</label>
                  <input
                    value={displayName}
                    onChange={(e) => { setDisplayName(e.target.value); setError(""); }}
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
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  style={inputStyle}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  style={inputStyle}
                  placeholder={mode === "register" ? "At least 6 characters" : "Your password"}
                />
              </div>
            </div>

            {error && (
              <p style={{ color: colors.accentRed, fontSize: 13, margin: "14px 0 0", textAlign: "left" }}>
                {error}
              </p>
            )}
            {success && (
              <p style={{ color: colors.accentGreen, fontSize: 13, margin: "14px 0 0", textAlign: "left" }}>
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
              {loading ? "…" : mode === "register" ? "Create Account" : "Sign In"}
            </button>

            {mode === "register" && (
              <p style={{ color: colors.textDim, fontSize: 11, margin: "12px 0 0" }}>
                Invited to admin someone else's space? Sign up with the email you were
                invited by and it will show up automatically.
              </p>
            )}
          </div>

          <p style={{ color: colors.textDim, fontSize: 12, margin: "24px 0 0" }}>
            Just here to play?{" "}
            <a href="/" style={{ color: colors.accentViolet, fontWeight: 600, textDecoration: "none" }}>
              Join a space
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
