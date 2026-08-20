import React, { useState } from "react";
import { adminSectionStyle, btnPrimary, btnSecondary, radii } from "../../styles";
import { colors } from "../../styles";

function timeAgo(ts) {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/**
 * Queue of entry requests waiting on payment confirmation. Squares are only
 * placed on the board when an admin approves a request here.
 */
export function PendingEntriesSection({ pending, emptyCount, onApprove, onReject }) {
  const [confirmReject, setConfirmReject] = useState(null);

  return (
    <div style={adminSectionStyle}>
      <h3
        style={{
          margin: "0 0 8px",
          fontSize: 15,
          fontWeight: 700,
          color: colors.textSecondary,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 18 }}>💵</span>
        Pending Entries
        {pending.length > 0 && (
          <span
            style={{
              background: colors.accentOrange,
              color: "#1a1a2e",
              borderRadius: radii.pill,
              padding: "1px 9px",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {pending.length}
          </span>
        )}
      </h3>
      <p style={{ color: colors.textDim, fontSize: 12, margin: "0 0 14px" }}>
        Check that the money actually arrived before approving. Approving assigns the squares;
        rejecting discards the request.
      </p>

      {pending.length === 0 ? (
        <p style={{ color: colors.textMuted, fontSize: 13, margin: 0 }}>
          No entry requests waiting.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {pending.map((entry) => {
            const willPlace = Math.min(entry.squares, emptyCount);
            const shortfall = entry.squares - willPlace;
            const isConfirming = confirmReject === entry.id;

            return (
              <div
                key={entry.id}
                style={{
                  background: colors.surface3,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radii.lg,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 10,
                    marginBottom: 4,
                  }}
                >
                  <strong style={{ color: colors.textPrimary, fontSize: 14 }}>{entry.name}</strong>
                  <span style={{ color: colors.textDim, fontSize: 11, flexShrink: 0 }}>
                    {timeAgo(entry.requestedAt)}
                  </span>
                </div>

                <p style={{ margin: "0 0 10px", color: colors.textMuted, fontSize: 12 }}>
                  <strong style={{ color: colors.accentGreenBright }}>${entry.amount}</strong> ·{" "}
                  {entry.squares} square{entry.squares !== 1 ? "s" : ""} requested
                  {shortfall > 0 && (
                    <span style={{ color: colors.accentRed }}>
                      {" "}
                      · only {willPlace} left, {shortfall} won't be placed
                    </span>
                  )}
                </p>

                {isConfirming ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: colors.accentRed, fontSize: 12, flex: 1 }}>
                      Discard this request?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onReject(entry.id);
                        setConfirmReject(null);
                      }}
                      style={{
                        ...btnSecondary,
                        padding: "6px 14px",
                        fontSize: 12,
                        color: colors.accentRed,
                        borderColor: "#ff6b6b40",
                      }}
                    >
                      Yes, reject
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReject(null)}
                      style={{ ...btnSecondary, padding: "6px 14px", fontSize: 12 }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => onApprove(entry.id)}
                      disabled={willPlace < 1}
                      style={{
                        ...btnPrimary,
                        flex: 1,
                        padding: "8px 14px",
                        fontSize: 13,
                        opacity: willPlace < 1 ? 0.4 : 1,
                        cursor: willPlace < 1 ? "not-allowed" : "pointer",
                      }}
                    >
                      {willPlace < 1 ? "Board full" : `Approve ${willPlace}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReject(entry.id)}
                      style={{
                        ...btnSecondary,
                        flex: 1,
                        padding: "8px 14px",
                        fontSize: 13,
                        color: colors.textDim,
                      }}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
