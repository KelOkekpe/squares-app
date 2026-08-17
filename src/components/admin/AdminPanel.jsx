import React, { useState, useEffect } from "react";
import { getInitialBoard, spaceUrl } from "../../utils";
import { colors, adminSectionStyle, adminInputStyle, labelStyle } from "../../styles";
import { useAuth } from "../../hooks/useAuth";
import { TeamColorSection } from "./TeamColorSection";
import { PrizePoolSection } from "./PrizePoolSection";
import { QuarterScoresSection } from "./QuarterScoresSection";
import { OverrideCellSection } from "./OverrideCellSection";
import { BoardManagementSection } from "./BoardManagementSection";
import { AdminInviteSection } from "./AdminInviteSection";

export function AdminPanel({
  config,
  setConfig,
  board,
  setBoard,
  headers,
  scores,
  setScores,
  pools,
  setPools,
  createPool,
  updatePool,
  toggleArchivePool,
  activePoolId,
  onSwitchPool,
  onClose,
  spaceCode,
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [canManageAdmins, setCanManageAdmins] = useState(false);
  const { isSpaceOwner } = useAuth();

  useEffect(() => {
    if (spaceCode) {
      isSpaceOwner(spaceCode).then(setCanManageAdmins);
    }
  }, [spaceCode, isSpaceOwner]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: colors.overlay,
        backdropFilter: "blur(12px)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "40px 20px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          background: colors.surfacePrimary,
          borderRadius: 20,
          padding: 32,
          width: "100%",
          maxWidth: 560,
          border: `1px solid ${colors.borderLight}`,
          boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              color: colors.accentRed,
              letterSpacing: -0.5,
            }}
          >
            Admin Console
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "#ffffff10",
              border: "none",
              color: "#888",
              width: 36,
              height: 36,
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Price per square */}
          <div style={adminSectionStyle}>
            <label style={labelStyle}>Price per square ($)</label>
            <input
              type="number"
              min={1}
              value={config.pricePerSquare}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  pricePerSquare: Math.max(1, Number(e.target.value)),
                }))
              }
              style={adminInputStyle}
            />
          </div>

          {/* Invite Members: share space link/code */}
          {spaceCode && (
            <div style={adminSectionStyle}>
              <h3
                style={{
                  margin: "0 0 12px",
                  fontSize: 15,
                  fontWeight: 700,
                  color: colors.textSecondary,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 18 }}>🔗</span>
                Invite Members
              </h3>
              <p style={{ color: colors.textDim, fontSize: 12, margin: "0 0 10px" }}>
                Share this link or space code so others can join:
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  readOnly
                  value={spaceUrl(spaceCode)}
                  style={{
                    ...adminInputStyle,
                    flex: "1 1 200px",
                    fontSize: 12,
                  }}
                />
                <button
                  onClick={() => {
                    const url = spaceUrl(spaceCode);
                    navigator.clipboard?.writeText(url).then(() => {});
                  }}
                  style={{
                    ...adminInputStyle,
                    padding: "10px 16px",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  Copy link
                </button>
              </div>
              <p style={{ color: colors.textDim, fontSize: 11, margin: "8px 0 0" }}>
                Space code: <strong style={{ color: colors.textSecondary }}>{spaceCode}</strong>
              </p>
            </div>
          )}

          {/* Pool management */}
          <BoardManagementSection
            pools={pools}
            setPools={setPools}
            createPool={createPool}
            updatePool={updatePool}
            toggleArchivePool={toggleArchivePool}
            activePoolId={activePoolId}
            onSwitchPool={onSwitchPool}
          />

          {/* Assign Admins (space owners only) */}
          {canManageAdmins && spaceCode && (
            <AdminInviteSection spaceCode={spaceCode} isOwner={canManageAdmins} />
          )}

          {/* Team names + colours */}
          <TeamColorSection config={config} setConfig={setConfig} />

          {/* Prize pool */}
          <PrizePoolSection config={config} setConfig={setConfig} />

          {/* Quarter scores */}
          <QuarterScoresSection
            config={config}
            scores={scores}
            setScores={setScores}
          />

          {/* Override cell */}
          <OverrideCellSection setBoard={setBoard} />

          {/* Toggle submissions */}
          <div style={adminSectionStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <label style={{ ...labelStyle, marginBottom: 2 }}>
                  Submissions
                </label>
                <span style={{ color: "#666", fontSize: 12 }}>
                  {config.submissionsDisabled
                    ? "Currently closed"
                    : "Currently open"}
                </span>
              </div>
              <button
                onClick={() =>
                  setConfig((c) => ({
                    ...c,
                    submissionsDisabled: !c.submissionsDisabled,
                  }))
                }
                style={{
                  background: config.submissionsDisabled
                    ? colors.accentGreen
                    : colors.accentRedDark,
                  color: colors.white,
                  border: "none",
                  padding: "10px 24px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {config.submissionsDisabled ? "Enable" : "Disable"}
              </button>
            </div>
          </div>

          {/* Reset board */}
          <div style={adminSectionStyle}>
            {!confirmReset ? (
              <button
                onClick={() => setConfirmReset(true)}
                style={{
                  background: "#ff222220",
                  color: colors.accentRedMuted,
                  border: "1px solid #ff222240",
                  padding: "12px 24px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  width: "100%",
                }}
              >
                Reset Entire Board
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    setBoard(getInitialBoard());
                    setScores({});
                    setConfirmReset(false);
                  }}
                  style={{
                    flex: 1,
                    background: colors.accentRedDeep,
                    color: colors.white,
                    border: "none",
                    padding: "12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  Confirm Reset
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  style={{
                    flex: 1,
                    background: "#ffffff10",
                    color: "#aaa",
                    border: `1px solid ${colors.borderSubtle}`,
                    padding: "12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 13,
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
