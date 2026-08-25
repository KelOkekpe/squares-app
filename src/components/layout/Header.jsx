import React, { useState, useEffect } from "react";
import { containerStyle, btnSecondary } from "../../styles";
import { colors, radii } from "../../styles";
import { useAuth } from "../../hooks/useAuth";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { ThemeToggle } from "../common";

export function Header({ view, spaceCode, onHome, onAdmin, onNewBoard, onExit }) {
  const { isLoggedIn, isOwner, profile, isSpaceAdmin, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);

  // Everything stays on one row, so mobile trims aggressively: smaller
  // buttons, no wordmark, no user chip. overflowX is a safety valve — the page
  // clips horizontal overflow, and a clipped nav is how the Admin button
  // became unreachable in the first place.
  const navButton = {
    ...btnSecondary,
    padding: isMobile ? "7px 10px" : "10px 20px",
    fontSize: isMobile ? 11 : 13,
    whiteSpace: "nowrap",
    flexShrink: 0,
  };

  const onBoard = view === "board";

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
    return () => {
      mounted = false;
    };
  }, [isLoggedIn, isOwner, spaceCode, isSpaceAdmin]);

  return (
    <>
      <header
        style={{
          padding: isMobile ? "14px 0" : "20px 0",
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
            flexWrap: "nowrap",
            gap: 10,
          }}
        >
          {/* Logo leaves the space — the conventional "home" affordance, and
              the only way out now that Exit is gone. */}
          <div
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: isMobile ? 8 : 12,
              minWidth: 0,
            }}
            onClick={onExit || onHome}
            title={onExit ? "Leave this space" : undefined}
          >
            <div
              style={{
                width: isMobile ? 32 : 40,
                height: isMobile ? 32 : 40,
                flexShrink: 0,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: isMobile ? 17 : 20,
              }}
            >
              🏈
            </div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              {/* Wordmark is dropped on mobile so three buttons fit one row */}
              {!isMobile && (
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 18,
                    letterSpacing: -0.5,
                    color: colors.headline,
                  }}
                >
                  SQUARE
                  <span style={{ color: colors.accentViolet }}>POOL</span>
                </span>
              )}
              {spaceCode && (
                <span
                  style={{
                    fontSize: 11,
                    color: colors.textMuted,
                    letterSpacing: 1,
                    textTransform: "lowercase",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  #{spaceCode}
                </span>
              )}
            </div>
          </div>

          {/* Home (on board only) · + Board · Admin · Sign Out — one row */}
          <nav
            style={{
              display: "flex",
              gap: isMobile ? 6 : 8,
              alignItems: "center",
              flexWrap: "nowrap",
              justifyContent: "flex-end",
              overflowX: "auto",
              scrollbarWidth: "none",
            }}
          >
            {/* User indicator — desktop only, it costs a button's width */}
            {isLoggedIn && !isMobile && (
              <span
                style={{
                  color: colors.textDim,
                  fontSize: 11,
                  marginRight: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: isOwner ? colors.accentGold : colors.accentGreen,
                    display: "inline-block",
                  }}
                />
                {profile?.display_name?.split(" ")[0] || "User"}
              </span>
            )}

            {/* Only while on the board. The logo leaves the space, so without
                this there'd be no way back to the home view — and the "view
                board" direction already lives on the home screen itself. */}
            {onBoard && (
              <button onClick={onHome} style={{ ...navButton, background: colors.surface5 }}>
                Home
              </button>
            )}

            {/* Back to the list of every space you run. The logo already did
                this, but nothing said so — an admin inside a space had no
                visible way out of it. */}
            {canAccessAdmin && onExit && (
              <button
                onClick={onExit}
                style={{ ...navButton, color: colors.textMuted }}
                title="Back to all your spaces"
              >
                {isMobile ? "←" : "← Spaces"}
              </button>
            )}

            {/* New board — admins only, opens the panel with the name field ready */}
            {canAccessAdmin && (
              <button
                onClick={onNewBoard}
                style={{ ...navButton, color: colors.accentGreenBright, borderColor: "#4ade8033" }}
                title="Create a new board in this space"
              >
                {isMobile ? "+" : "+ Board"}
              </button>
            )}

            {/* Admin — hidden for players */}
            {canAccessAdmin && (
              <button
                onClick={onAdmin}
                style={{
                  ...navButton,
                  color: colors.accentRed,
                  borderColor: "#ff6b6b30",
                }}
              >
                Admin
              </button>
            )}

            <ThemeToggle size={isMobile ? 28 : 34} />

            {/* Players are never signed in — only admins see a sign-out */}
            {isLoggedIn && (
              <button
                type="button"
                onClick={() => {
                  signOut();
                  onExit?.(); // Leave space so we don't hit the private-space password gate
                }}
                style={{ ...navButton, color: colors.textDim }}
              >
                Sign Out
              </button>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
