import React, { useState, useEffect } from "react";
import { spaceUrl, PAYMENT_PROVIDERS } from "../../utils";
import { colors, radii, adminSectionStyle, adminInputStyle, labelStyle } from "../../styles";
import { useAuth } from "../../hooks/useAuth";
import { TeamColorSection } from "./TeamColorSection";
import { PrizePoolSection } from "./PrizePoolSection";
import { QuarterScoresSection } from "./QuarterScoresSection";
import { OverrideCellSection } from "./OverrideCellSection";
import { BoardManagementSection } from "./BoardManagementSection";
import { AdminInviteSection } from "./AdminInviteSection";
import { PendingEntriesSection } from "./PendingEntriesSection";
import { ApprovalNotice } from "./ApprovalNotice";
import { GameLinkSection } from "./GameLinkSection";
import { SmartFillSection } from "./SmartFillSection";
import { PickemSettingsSection } from "./PickemSettingsSection";
import { EntriesSection } from "./EntriesSection";

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
  pending = [],
  emptyCount = 0,
  onApproveEntry,
  onRejectEntry,
  approvalNotice,
  onDismissNotice,
  onResetPool,
  onToggleSubmissions,
  poolConfigs,
  poolBusyId,
  participants = [],
  setParticipants,
  onRemoveEntry,
  onSmartFill,
  pendingCounts = {},
  isPickem,
  slate,
  setSlate,
  picks,
  onSetPickPaid,
  onRemovePickEntry,
  onActivateBoard,
  checkoutStartingFor,
  checkoutError,
}) {
  const [tab, setTab] = useState("space");
  // Starts blank so a setting is never changed on whichever board happened to
  // be in view — the admin picks one deliberately first.
  const [selectedBoard, setSelectedBoard] = useState("");

  // Archiving the board you're managing would otherwise leave the picker
  // pointing at something it no longer lists.
  useEffect(() => {
    if (!selectedBoard) return;
    const stillListed = pools.some((p) => p.id === selectedBoard && !p.archived);
    if (!stillListed) setSelectedBoard("");
  }, [selectedBoard, pools]);

  // Entries waiting anywhere in the space, and how many are on a board other
  // than the one being viewed — the case that reads as "pending is broken".
  const totalPending = Object.values(pendingCounts).reduce((n, v) => n + (v || 0), 0);
  const otherPending = totalPending - (pendingCounts[activePoolId] || 0);
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
              background: colors.surface5,
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
          {/* Two groups: things that belong to the space, and things that
              belong to one board. Everything used to be a single scroll. */}
          <div
            style={{
              display: "flex",
              gap: 4,
              background: colors.surface3,
              borderRadius: radii.pill,
              border: `1px solid ${colors.border}`,
              padding: 4,
            }}
          >
            {[
              { key: "space", label: "Space" },
              { key: "board", label: isPickem ? "Game Settings" : "Board Settings" },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1,
                  padding: "9px 16px",
                  borderRadius: radii.pill,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  fontFamily: "inherit",
                  background:
                    tab === t.key
                      ? `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`
                      : "transparent",
                  color: tab === t.key ? colors.white : colors.textMuted,
                }}
              >
                {t.label}
                {t.key === "board" && totalPending > 0 && (
                  <span
                    style={{
                      marginLeft: 8,
                      background: colors.accentOrange,
                      color: "#1a1a2e",
                      borderRadius: radii.pill,
                      padding: "1px 8px",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {totalPending}
                  </span>
                )}
              </button>
            ))}
          </div>

          {tab === "space" && (
            <>
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
                onResetPool={onResetPool}
                onToggleSubmissions={onToggleSubmissions}
                poolConfigs={poolConfigs}
                poolBusyId={poolBusyId}
                onActivateBoard={onActivateBoard}
                checkoutStartingFor={checkoutStartingFor}
                checkoutError={checkoutError}
              />

              {/* Assign Admins (space owners only) */}
              {canManageAdmins && spaceCode && (
                <AdminInviteSection spaceCode={spaceCode} isOwner={canManageAdmins} />
              )}
            </>
          )}

          {tab === "board" && (
            <>
              {/* Which board these settings apply to. Pending counts are shown per
                board because an admin looking at the wrong one sees an empty
                queue and assumes entries were lost. */}
              <div style={adminSectionStyle}>
                <label style={labelStyle}>Board</label>
                <select
                  value={selectedBoard}
                  onChange={(e) => {
                    setSelectedBoard(e.target.value);
                    if (e.target.value) onSwitchPool(e.target.value);
                  }}
                  style={adminInputStyle}
                >
                  <option value="">Select a board…</option>
                  {/* Archived boards are excluded — unarchive from Pool
                      Management to manage one again. */}
                  {pools
                    .filter((p) => !p.archived)
                    .map((p) => {
                      const waiting = poolConfigs && pendingCounts ? pendingCounts[p.id] || 0 : 0;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {waiting ? ` — ${waiting} pending` : ""}
                        </option>
                      );
                    })}
                </select>
                {otherPending > 0 && (
                  <p style={{ color: colors.accentOrange, fontSize: 12, margin: "8px 0 0" }}>
                    {otherPending} entry request{otherPending === 1 ? "" : "s"} waiting on another
                    board. Switch boards above to review {otherPending === 1 ? "it" : "them"}.
                  </p>
                )}
              </div>

              {!selectedBoard ? (
                <p style={{ color: colors.textMuted, fontSize: 13, margin: "4px 0 0" }}>
                  Pick a board above to manage its entries, price, teams and scores.
                </p>
              ) : (
                <>
                  {isPickem ? (
                    <PickemSettingsSection
                      spaceCode={spaceCode}
                      poolId={activePoolId}
                      slate={slate}
                      setSlate={setSlate}
                      picks={picks}
                      onSetPaid={onSetPickPaid}
                      onRemove={onRemovePickEntry}
                    />
                  ) : (
                    <>
                      {/* Surfaced immediately after approval — the only moment the
                    assigned squares are knowable */}
                      <ApprovalNotice notice={approvalNotice} onDismiss={onDismissNotice} />

                      {/* Entry requests awaiting payment confirmation */}
                      <PendingEntriesSection
                        pending={pending}
                        emptyCount={emptyCount}
                        onApprove={onApproveEntry}
                        onReject={onRejectEntry}
                      />

                      {/* Confirmed entries */}
                      <EntriesSection participants={participants} onRemove={onRemoveEntry} />
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

                      {/* Where players should send payment */}
                      <div style={adminSectionStyle}>
                        <label style={labelStyle}>Payment instructions</label>
                        <p style={{ color: colors.textDim, fontSize: 12, margin: "0 0 10px" }}>
                          Players get a tappable link that opens your payment app with the amount
                          and a reference already filled in. Payments go directly to you — this app
                          never handles them.
                        </p>

                        {/* Structured handles build the deep links. Leave any blank to
                        hide that option from players. */}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            marginBottom: 14,
                          }}
                        >
                          {PAYMENT_PROVIDERS.map((provider) => (
                            <div
                              key={provider.key}
                              style={{ display: "flex", gap: 8, alignItems: "center" }}
                            >
                              <span
                                style={{
                                  width: 74,
                                  flexShrink: 0,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: colors.textMuted,
                                }}
                              >
                                {provider.label}
                              </span>
                              <input
                                value={config.paymentHandles?.[provider.key] || ""}
                                onChange={(e) =>
                                  setConfig((c) => ({
                                    ...c,
                                    paymentHandles: {
                                      ...(c.paymentHandles || {}),
                                      [provider.key]: e.target.value,
                                    },
                                  }))
                                }
                                style={adminInputStyle}
                                placeholder={provider.placeholder}
                                title={provider.hint}
                              />
                            </div>
                          ))}
                        </div>

                        <label style={{ ...labelStyle, fontSize: 10 }}>
                          Extra instructions (optional)
                        </label>
                        <textarea
                          rows={2}
                          value={config.paymentInstructions || ""}
                          onChange={(e) =>
                            setConfig((c) => ({ ...c, paymentInstructions: e.target.value }))
                          }
                          style={{ ...adminInputStyle, resize: "vertical", fontFamily: "inherit" }}
                          placeholder={"Venmo @your-handle\nInclude your name in the note"}
                        />
                      </div>

                      {/* Team names + colours */}
                      <TeamColorSection config={config} setConfig={setConfig} />

                      {/* Fill an undersold board and scale the payout to match */}
                      <SmartFillSection config={config} board={board} onSmartFill={onSmartFill} />

                      {/* Prize pool */}
                      <PrizePoolSection config={config} setConfig={setConfig} />

                      {/* Link a real game so scores fill themselves in */}
                      <GameLinkSection config={config} setConfig={setConfig} />

                      {/* Quarter scores */}
                      <QuarterScoresSection config={config} scores={scores} setScores={setScores} />

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
                            <label style={{ ...labelStyle, marginBottom: 2 }}>Submissions</label>
                            <span style={{ color: "#666", fontSize: 12 }}>
                              {config.submissionsDisabled ? "Currently closed" : "Currently open"}
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
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
