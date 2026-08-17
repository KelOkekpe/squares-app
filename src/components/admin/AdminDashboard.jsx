import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useUserSpaces } from "../../hooks/useUserSpaces";
import { useSpacesRegistry } from "../../hooks/useSpacesRegistry";
import { useCreateSpace } from "../../hooks/useCreateSpace";
import { normalizeCode, spaceUrlPrefix } from "../../utils/routes";
import { colors, radii, pageStyle, containerStyle, cardStyle, inputStyle, labelStyle, btnPrimary } from "../../styles";
import { BackgroundDecor } from "../layout/BackgroundDecor";

function LockIcon() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={colors.accentGold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }} aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/**
 * Admin home once signed in: the spaces you own or were invited to admin,
 * plus space creation.
 */
export function AdminDashboard({ onOpenSpace }) {
  const { user, profile, signOut } = useAuth();
  const { spaces: userSpaces, loading: spacesLoading, refetch: refetchUserSpaces } = useUserSpaces();
  const { spaces: registry } = useSpacesRegistry();
  const createSpace = useCreateSpace();

  const [spaceCode, setSpaceCode] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [spacePassword, setSpacePassword] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const code = normalizeCode(spaceCode);
    if (!code) { setError("Please enter a space code"); return; }
    if (code.length < 3) { setError("Space code must be at least 3 characters"); return; }
    if (registry.some((s) => s.code === code) || userSpaces.some((s) => s.code === code)) {
      setError(`"${code}" is already taken`);
      return;
    }
    if (isPrivate && !spacePassword.trim()) { setError("Please set a space password for private spaces"); return; }

    setError("");
    setCreating(true);
    try {
      await createSpace(code, isPrivate, spacePassword);
      await refetchUserSpaces();
      setSpaceCode("");
      setIsPrivate(false);
      setSpacePassword("");
      onOpenSpace(code);
    } catch (err) {
      setError(err?.message || "Failed to create space");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={pageStyle}>
      <BackgroundDecor />
      <div style={{ ...containerStyle, paddingTop: 40, paddingBottom: 60 }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>

          {/* Top bar */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 40,
            gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                }}
              >
                🏈
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: -0.5, color: colors.white }}>
                  SQUAREBET
                </span>
                <span style={{
                  fontSize: 10,
                  color: colors.accentGold,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  fontWeight: 700,
                }}>
                  Admin
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: colors.textMuted, fontSize: 13 }}>
                {profile?.display_name || profile?.email || user?.email}
              </span>
              <button
                type="button"
                onClick={signOut}
                style={{
                  background: "none",
                  border: `1px solid ${colors.border}`,
                  color: colors.textDim,
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "6px 14px",
                  borderRadius: radii.pill,
                  fontFamily: "inherit",
                }}
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* My Spaces */}
          <div style={{ marginBottom: 32 }}>
            <p style={{
              color: colors.textDim,
              fontSize: 12,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              fontWeight: 600,
            }}>
              My Spaces
            </p>

            {spacesLoading ? (
              <p style={{ color: colors.textMuted, fontSize: 14, margin: 0 }}>Loading…</p>
            ) : userSpaces.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: "center" }}>
                <p style={{ color: colors.textMuted, fontSize: 14, margin: 0 }}>
                  No spaces yet. Create your first one below.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {userSpaces.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => onOpenSpace(s.code)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      background: "#ffffff06",
                      border: `1px solid ${colors.border}`,
                      borderRadius: radii.lg,
                      padding: "14px 18px",
                      color: colors.textSecondary,
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {s.isPrivate && <LockIcon />}
                      #{s.code}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      color: s.role === "owner" ? colors.accentGold : colors.accentViolet,
                    }}>
                      {s.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Create a space */}
          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>
              Create a Space
            </h3>
            <p style={{ color: colors.textMuted, fontSize: 13, marginBottom: 20 }}>
              A space holds one or more pools. Share its link and players join — no account needed.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>Space Code</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ color: colors.textDim, fontSize: 14, flexShrink: 0 }}>
                    {spaceUrlPrefix()}
                  </span>
                  <input
                    value={spaceCode}
                    onChange={(e) => { setSpaceCode(normalizeCode(e.target.value)); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && !creating && handleCreate()}
                    style={{ ...inputStyle, fontWeight: 600 }}
                    placeholder="scriberfam"
                  />
                </div>
                <p style={{ color: colors.textDim, fontSize: 11, margin: "6px 0 0" }}>
                  Lowercase letters, numbers, and dashes only
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 0",
                  borderTop: `1px solid ${colors.border}`,
                }}
              >
                <div>
                  <label style={{ ...labelStyle, marginBottom: 2 }}>Private space</label>
                  <p style={{ color: colors.textDim, fontSize: 11, margin: 0 }}>
                    Require a password for players to join
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsPrivate(!isPrivate);
                    if (!isPrivate) setSpacePassword("");
                    setError("");
                  }}
                  style={{
                    width: 48,
                    height: 28,
                    borderRadius: 14,
                    border: "none",
                    cursor: "pointer",
                    background: isPrivate ? colors.accentPurple : "#ffffff15",
                    transition: "all 0.2s",
                    position: "relative",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: isPrivate ? 24 : 4,
                      top: 4,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: colors.white,
                      transition: "left 0.2s",
                    }}
                  />
                </button>
              </div>

              {isPrivate && (
                <div>
                  <label style={labelStyle}>Space password</label>
                  <input
                    type="password"
                    value={spacePassword}
                    onChange={(e) => { setSpacePassword(e.target.value); setError(""); }}
                    style={inputStyle}
                    placeholder="Password players enter to join"
                  />
                </div>
              )}
            </div>

            {error && (
              <p style={{ color: colors.accentRed, fontSize: 13, margin: "14px 0 0" }}>
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              style={{
                ...btnPrimary,
                width: "100%",
                marginTop: 24,
                opacity: creating ? 0.7 : 1,
                cursor: creating ? "not-allowed" : "pointer",
              }}
            >
              {creating ? "Creating…" : "Create Space"}
            </button>
          </div>

          <p style={{ textAlign: "center", margin: "24px 0 0" }}>
            <a
              href="/"
              style={{ color: colors.textDim, fontSize: 12, textDecoration: "none" }}
            >
              View the player site →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
