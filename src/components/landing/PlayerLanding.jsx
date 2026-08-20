import React, { useState } from "react";
import { useSpacesRegistry } from "../../hooks/useSpacesRegistry";
import { useSpaceAccess } from "../../hooks/useSpaceAccess";
import { normalizeCode, spaceUrlPrefix } from "../../utils/routes";
import {
  colors,
  pageStyle,
  containerStyle,
  cardStyle,
  inputStyle,
  btnPrimary,
  btnSecondary,
} from "../../styles";
import { BackgroundDecor } from "../layout/BackgroundDecor";
import { PasswordInput } from "../common";
import { ThemeToggle } from "../common";

/**
 * Player landing page. Players never sign up or sign in — they enter a space
 * code, clear the password gate if the space is private, and play.
 */
export function PlayerLanding({ onEnterSpace }) {
  const { spaces, loading, error: registryError, refetch: refetchSpaces } = useSpacesRegistry();
  const { hasAccess, verifyAndGrantAccess } = useSpaceAccess();

  const [codeword, setCodeword] = useState("");
  const [error, setError] = useState("");
  const [pendingSpaceCode, setPendingSpaceCode] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  const handleEnter = () => {
    const code = normalizeCode(codeword);
    if (!code) {
      setError("Please enter a space code");
      return;
    }
    if (loading) {
      setError("Still loading spaces — try again in a second");
      return;
    }

    const found = spaces.find((s) => s.code === code);
    if (!found) {
      setError(`No space found for "${code}"`);
      return;
    }

    if (found.isPrivate && !hasAccess(code)) {
      setPendingSpaceCode(code);
      setPasswordInput("");
      setError("");
      return;
    }
    onEnterSpace(code);
  };

  const handlePasswordSubmit = async () => {
    if (!pendingSpaceCode) return;
    const { ok, error: verifyError } = await verifyAndGrantAccess(pendingSpaceCode, passwordInput);
    if (ok) {
      const code = pendingSpaceCode;
      setPendingSpaceCode("");
      setPasswordInput("");
      onEnterSpace(code);
    } else {
      setError(verifyError || "Incorrect password");
    }
  };

  const closePasswordPrompt = () => {
    setPendingSpaceCode("");
    setPasswordInput("");
    setError("");
  };

  return (
    <div style={pageStyle}>
      <BackgroundDecor />
      <div style={{ ...containerStyle, paddingTop: 100, paddingBottom: 60 }}>
        <div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <ThemeToggle />
          </div>

          {/* Logo */}
          <div style={{ marginBottom: 48 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                margin: "0 auto 20px",
              }}
            >
              🏈
            </div>
            <h1
              style={{
                fontSize: 48,
                fontWeight: 900,
                lineHeight: 1.1,
                margin: "0 0 12px",
                letterSpacing: -2,
                background: `linear-gradient(135deg, ${colors.headline} 30%, ${colors.accentViolet})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              SQUAREBET
            </h1>
            <p style={{ color: colors.textMuted, fontSize: 16, margin: 0 }}>
              Sports squares made easy. Enter your code, pick your squares, play.
            </p>
          </div>

          {/* Join form */}
          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>Join a Space</h3>
            <p style={{ color: colors.textMuted, fontSize: 13, marginBottom: 24 }}>
              Enter the space code shared by your admin — no account needed
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ color: colors.textDim, fontSize: 15, flexShrink: 0 }}>
                {spaceUrlPrefix()}
              </span>
              <input
                value={codeword}
                onChange={(e) => {
                  setCodeword(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleEnter()}
                style={{ ...inputStyle, fontWeight: 600 }}
                placeholder="enter-space-code"
                autoFocus
              />
            </div>
            {error && !pendingSpaceCode && (
              <p
                style={{
                  color: colors.accentRed,
                  fontSize: 13,
                  margin: "12px 0 0",
                  textAlign: "left",
                }}
              >
                {error}
              </p>
            )}
            {registryError && (
              <p
                style={{
                  color: colors.accentRed,
                  fontSize: 13,
                  margin: "12px 0 0",
                  textAlign: "left",
                }}
              >
                Couldn't reach the server.{" "}
                <span
                  onClick={() => {
                    setError("");
                    refetchSpaces();
                  }}
                  style={{ color: colors.accentViolet, cursor: "pointer", fontWeight: 700 }}
                >
                  Retry
                </span>
              </p>
            )}
            <button
              onClick={handleEnter}
              disabled={loading}
              style={{
                ...btnPrimary,
                width: "100%",
                marginTop: 20,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Loading…" : "Enter Space"}
            </button>
          </div>

          {/* Admins get sent to their own site */}
          <p style={{ color: colors.textDim, fontSize: 12, margin: "24px 0 0" }}>
            Running a pool?{" "}
            <a
              href="/admin"
              style={{ color: colors.accentViolet, fontWeight: 600, textDecoration: "none" }}
            >
              Go to the admin site
            </a>
          </p>
        </div>
      </div>

      {/* Space password modal */}
      {pendingSpaceCode && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: colors.overlay,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => e.target === e.currentTarget && closePasswordPrompt()}
        >
          <div style={{ ...cardStyle, maxWidth: 360, width: "100%" }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>Private Space</h3>
            <p style={{ color: colors.textMuted, fontSize: 13, margin: "0 0 16px" }}>
              Enter the password for <strong>#{pendingSpaceCode}</strong>
            </p>
            <PasswordInput
              value={passwordInput}
              onChange={(e) => {
                setPasswordInput(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
              placeholder="Space password"
              style={{ ...inputStyle, marginBottom: 16 }}
              autoFocus
            />
            {error && (
              <p style={{ color: colors.accentRed, fontSize: 12, margin: "0 0 12px" }}>{error}</p>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={closePasswordPrompt}
                style={{ ...btnSecondary, flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePasswordSubmit}
                style={{ ...btnPrimary, flex: 1 }}
              >
                Enter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
