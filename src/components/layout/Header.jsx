import React, { useState, useEffect } from "react";
import { containerStyle, btnSecondary } from "../../styles";
import { colors, radii } from "../../styles";
import { useAuth } from "../../hooks/useAuth";

export function Header({ view, spaceCode, onHome, onViewBoard, onAdmin, onExit }) {
  const { isLoggedIn, isOwner, profile, isSpaceAdmin, signOut } = useAuth();
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);

  // Determine if the current user should see the Admin button
  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      if (!isLoggedIn) {
        if (mounted) setCanAccessAdmin(false);
        return;
      }

      // Global owners always see admin
      if (isOwner) {
        if (mounted) setCanAccessAdmin(true);
        return;
      }

      // Check space-level admin (space admins have global role 'player' but can admin specific spaces)
      if (spaceCode) {
        const isAdmin = await isSpaceAdmin(spaceCode);
        if (mounted) setCanAccessAdmin(isAdmin);
      } else {
        if (mounted) setCanAccessAdmin(false);
      }
    }

    checkAccess();
    return () => { mounted = false; };
  }, [isLoggedIn, isOwner, spaceCode, isSpaceAdmin]);

  return (
    <>
      <header
        style={{
          padding: "20px 0",
          borderBottom: `1px solid ${colors.border}`,
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            ...containerStyle,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
            onClick={onHome}
          >
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
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 18,
                  letterSpacing: -0.5,
                  color: colors.white,
                }}
              >
                GRID
                <span style={{ color: colors.accentViolet }}>IRON</span>
              </span>
              {spaceCode && (
                <span style={{ fontSize: 11, color: colors.textMuted, letterSpacing: 1, textTransform: "lowercase" }}>
                  #{spaceCode}
                </span>
              )}
            </div>
          </div>

          <nav style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* User indicator */}
            {isLoggedIn && (
              <span style={{
                color: colors.textDim,
                fontSize: 11,
                marginRight: 4,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: isOwner ? colors.accentGold : colors.accentGreen,
                  display: "inline-block",
                }} />
                {profile?.display_name?.split(" ")[0] || "User"}
              </span>
            )}

            {/* Players are never signed in — only admins see a sign-out */}
            {isLoggedIn && (
              <button
                type="button"
                onClick={() => {
                  signOut();
                  onExit?.(); // Leave space so we don't hit the private-space password gate
                }}
                style={{
                  ...btnSecondary,
                  padding: "8px 14px",
                  fontSize: 12,
                  color: colors.textDim,
                }}
              >
                Sign Out
              </button>
            )}

            {onExit && (
              <button
                onClick={onExit}
                style={{
                  ...btnSecondary,
                  padding: "10px 20px",
                  fontSize: 13,
                  color: colors.textDim,
                }}
              >
                Exit
              </button>
            )}
            <button
              onClick={onViewBoard}
              style={{
                ...btnSecondary,
                padding: "10px 20px",
                fontSize: 13,
                background: view === "board" ? "#ffffff10" : "transparent",
              }}
            >
              View Board
            </button>
            {/* Admin button — hidden for logged-in players */}
            {canAccessAdmin && (
              <button
                onClick={onAdmin}
                style={{
                  ...btnSecondary,
                  padding: "10px 20px",
                  fontSize: 13,
                  color: colors.accentRed,
                  borderColor: "#ff6b6b30",
                }}
              >
                Admin
              </button>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
