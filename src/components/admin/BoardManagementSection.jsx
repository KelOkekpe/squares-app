import React, { useState, useEffect, useRef } from "react";
import { MAX_ACTIVE_POOLS, addDaysISO, todayISO, isPoolActive, poolStatus } from "../../utils";
import { colors } from "../../styles";
import { adminSectionStyle, adminInputStyle, labelStyle } from "../../styles";

export function BoardManagementSection({
  pools,
  setPools,
  createPool,
  updatePool,
  toggleArchivePool,
  activePoolId,
  onSwitchPool,
  onResetPool,
  onToggleSubmissions,
  poolConfigs = {},
  poolBusyId,
  onActivateBoard,
  checkoutStartingFor,
  checkoutError,
}) {
  const [newPoolName, setNewPoolName] = useState("");
  const [newPoolExpiry, setNewPoolExpiry] = useState(() => addDaysISO(30));
  const [showArchived, setShowArchived] = useState(false);
  const [createError, setCreateError] = useState("");
  const [confirmReset, setConfirmReset] = useState(null);
  // A reset is a server round trip and can fail; silently closing the
  // confirmation would look exactly like success.
  const [resetError, setResetError] = useState("");
  const [archiveError, setArchiveError] = useState("");

  const isClosed = (poolId) => !!poolConfigs[poolId]?.submissionsDisabled;

  const rowBtn = (tone, disabled) => ({
    background: colors.surface5,
    border: "none",
    color: tone,
    padding: "5px 12px",
    borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "inherit",
    opacity: disabled ? 0.5 : 1,
  });
  const [creating, setCreating] = useState(false);

  // Active means neither archived nor past its end date — expired boards free
  // up a slot without anyone having to archive them.
  const activePools = pools.filter(isPoolActive);
  const completedPools = pools.filter((p) => !isPoolActive(p));
  const atLimit = activePools.length >= MAX_ACTIVE_POOLS;

  const handleCreate = async () => {
    const name = newPoolName.trim();
    setCreateError("");
    if (!name) {
      setCreateError("Give the board a name");
      return;
    }
    if (!newPoolExpiry) {
      setCreateError("Pick an end date");
      return;
    }
    if (newPoolExpiry < todayISO()) {
      setCreateError("The end date can't be in the past");
      return;
    }
    if (atLimit) {
      setCreateError(
        `This space already has ${MAX_ACTIVE_POOLS} active boards. Archive one or let it expire first.`
      );
      return;
    }

    setCreating(true);
    // The cap and the required date are enforced by a database trigger, so its
    // message is shown verbatim rather than second-guessed here.
    const { pool, error } = await createPool(name, newPoolExpiry);
    setCreating(false);

    if (error || !pool) {
      setCreateError(error || "Could not create the board");
      return;
    }
    setNewPoolName("");
    setNewPoolExpiry(addDaysISO(30));
    onSwitchPool(pool.id);
  };

  const toggleArchive = async (id) => {
    setArchiveError("");
    if (toggleArchivePool) {
      // Use database toggle function if available. Unarchiving can be refused
      // now that a name is only reserved by live boards, so the result matters.
      const result = await toggleArchivePool(id);
      if (result?.error) return setArchiveError(result.error);
    } else {
      // Fallback to local state update
      setPools((prev) => prev.map((p) => (p.id === id ? { ...p, archived: !p.archived } : p)));
    }

    // If archiving the active pool, switch to first non-archived
    const target = pools.find((p) => p.id === id);
    if (target && !target.archived && id === activePoolId) {
      const next = pools.find((p) => p.id !== id && !p.archived);
      if (next) onSwitchPool(next.id);
    }
  };

  return (
    <div style={adminSectionStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
        }}
      >
        <label style={labelStyle}>Pool Management</label>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: atLimit ? colors.accentRed : colors.textDim,
          }}
        >
          {activePools.length}/{MAX_ACTIVE_POOLS} active
        </span>
      </div>

      {/* Create new pool */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <input
          value={newPoolName}
          onChange={(e) => {
            setNewPoolName(e.target.value);
            setCreateError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && !creating && handleCreate()}
          style={adminInputStyle}
          placeholder="e.g. Week 5, Super Bowl..."
        />

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 150px", minWidth: 0 }}>
            <label style={{ ...labelStyle, fontSize: 10, marginBottom: 4 }}>
              Ends on (required)
            </label>
            {/* Native date input — gets the platform picker for free, and
                honours the color-scheme we set for light/dark */}
            <input
              type="date"
              value={newPoolExpiry}
              min={todayISO()}
              onChange={(e) => {
                setNewPoolExpiry(e.target.value);
                setCreateError("");
              }}
              style={adminInputStyle}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!newPoolName.trim() || !newPoolExpiry || creating || atLimit}
            style={{
              background:
                newPoolName.trim() && newPoolExpiry && !atLimit
                  ? `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`
                  : colors.surface5,
              color:
                newPoolName.trim() && newPoolExpiry && !atLimit ? colors.white : colors.textDim,
              border: "none",
              padding: "10px 20px",
              borderRadius: 8,
              cursor: atLimit || creating ? "not-allowed" : "pointer",
              fontWeight: 700,
              fontSize: 13,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {creating ? "Creating…" : "+ New Pool"}
          </button>
        </div>

        <p style={{ color: colors.textDim, fontSize: 11, margin: 0 }}>
          After this date the board stops taking entries and moves to Past Boards. It stays
          viewable.
        </p>

        {createError && (
          <p style={{ color: colors.accentRed, fontSize: 12, margin: 0 }}>{createError}</p>
        )}
      </div>

      {archiveError && (
        <p style={{ color: colors.accentRed, fontSize: 12, margin: "0 0 10px" }}>{archiveError}</p>
      )}

      {/* Active pools */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {activePools.map((p) => (
          <div
            key={p.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              padding: "10px 14px",
              background: p.id === activePoolId ? "#6c5ce715" : colors.surface2,
              borderRadius: 8,
              border: `1px solid ${p.id === activePoolId ? "#6c5ce730" : colors.border}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {p.id === activePoolId && (
                <span
                  style={{
                    color: colors.accentPurple,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 1,
                  }}
                >
                  ACTIVE
                </span>
              )}
              <span style={{ color: colors.textSecondary, fontSize: 13, fontWeight: 600 }}>
                {p.name}
              </span>
              {p.paid === false && (
                <span
                  style={{
                    color: colors.accentOrange,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                  }}
                >
                  INACTIVE
                </span>
              )}
              <span style={{ color: colors.textDim, fontSize: 11 }}>
                {new Date(p.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {p.id !== activePoolId && (
                <button onClick={() => onSwitchPool(p.id)} style={rowBtn(colors.accentPurple)}>
                  Switch
                </button>
              )}

              {p.paid === false && (
                <button
                  onClick={() => onActivateBoard?.(p.id)}
                  disabled={checkoutStartingFor === p.id}
                  style={{
                    ...rowBtn(colors.white, checkoutStartingFor === p.id),
                    background: `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`,
                  }}
                  title="Pay to open this board to players"
                >
                  {checkoutStartingFor === p.id ? "Opening…" : "Activate"}
                </button>
              )}

              {/* Submissions and reset act on this row's board, not just the
                  one currently being viewed */}
              <button
                onClick={() => onToggleSubmissions?.(p.id, !isClosed(p.id))}
                disabled={poolBusyId === p.id}
                style={rowBtn(
                  isClosed(p.id) ? colors.accentGreenBright : colors.accentOrange,
                  poolBusyId === p.id
                )}
                title={
                  isClosed(p.id)
                    ? "Let players submit entries again"
                    : "Stop accepting new entries on this board"
                }
              >
                {isClosed(p.id) ? "Open" : "Close"}
              </button>

              <button
                onClick={() => setConfirmReset(p.id)}
                disabled={poolBusyId === p.id}
                style={rowBtn(colors.accentRed, poolBusyId === p.id)}
                title="Clear this board and reshuffle its numbers"
              >
                Reset
              </button>

              <button onClick={() => toggleArchive(p.id)} style={rowBtn(colors.textDim)}>
                Archive
              </button>
            </div>
            {confirmReset === p.id && (
              <div
                style={{
                  flexBasis: "100%",
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: `1px solid ${colors.border}`,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span style={{ color: colors.accentRed, fontSize: 11, flex: 1, minWidth: 180 }}>
                  Clears every square, entry, pending request and score on <strong>{p.name}</strong>
                  , and reshuffles its numbers. Price, teams and payment details are kept.
                </span>
                <button
                  onClick={async () => {
                    const result = await onResetPool?.(p.id);
                    if (result?.ok === false) return setResetError(result.error || "Reset failed");
                    setResetError("");
                    setConfirmReset(null);
                  }}
                  style={rowBtn(colors.accentRed)}
                >
                  Yes, reset
                </button>
                <button
                  onClick={() => {
                    setResetError("");
                    setConfirmReset(null);
                  }}
                  style={rowBtn(colors.textDim)}
                >
                  Cancel
                </button>
                {resetError && (
                  <span style={{ color: colors.accentRed, fontSize: 11, width: "100%" }}>
                    {resetError}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {activePools.some((p) => p.paid === false) && (
        <p style={{ color: colors.accentOrange, fontSize: 11, margin: "8px 0 0" }}>
          Inactive boards don't accept entries. Activating one is a one-off charge for that board —
          your first board in a space is free.
        </p>
      )}

      {checkoutError && (
        <p style={{ color: colors.accentRed, fontSize: 12, margin: "8px 0 0" }}>{checkoutError}</p>
      )}

      {/* Completed pools — archived or past their end date */}
      {completedPools.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              background: "none",
              border: "none",
              color: colors.textDim,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              padding: 0,
              marginBottom: showArchived ? 8 : 0,
            }}
          >
            {showArchived ? "▾" : "▸"} {completedPools.length} completed board
            {completedPools.length !== 1 ? "s" : ""}
          </button>
          {showArchived && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {completedPools.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 14px",
                    background: colors.surface1,
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    opacity: 0.6,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: colors.textMuted, fontSize: 13 }}>{p.name}</span>
                    <span style={{ color: colors.textDim, fontSize: 11 }}>
                      {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleArchive(p.id)}
                    style={{
                      background: "#22aa4410",
                      border: "none",
                      color: "#66cc88",
                      padding: "5px 12px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
