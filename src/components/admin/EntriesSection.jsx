import React, { useState } from "react";
import { adminSectionStyle, btnSecondary, radii } from "../../styles";
import { colors } from "../../styles";

/**
 * Confirmed entries. Removing one here clears both the participant record and
 * that person's squares — the board and the entry list are separate stores, so
 * blanking cells with Override Cell leaves the entry behind.
 */
export function EntriesSection({ participants, onRemove }) {
  const [confirming, setConfirming] = useState(null);

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
        <span style={{ fontSize: 18 }}>📋</span>
        Entries
        {participants.length > 0 && (
          <span
            style={{
              background: "#ffffff12",
              color: colors.textMuted,
              borderRadius: radii.pill,
              padding: "1px 9px",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {participants.length}
          </span>
        )}
      </h3>
      <p style={{ color: colors.textDim, fontSize: 12, margin: "0 0 14px" }}>
        Removing an entry frees that person's squares on the board and drops
        them from Recent Entries.
      </p>

      {participants.length === 0 ? (
        <p style={{ color: colors.textMuted, fontSize: 13, margin: 0 }}>
          No entries yet.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {participants.map((entry, index) => {
            const isConfirming = confirming === index;
            return (
              <div
                key={`${entry.name}-${entry.time}-${index}`}
                style={{
                  background: "#ffffff06",
                  border: `1px solid ${colors.border}`,
                  borderRadius: radii.lg,
                  padding: "10px 14px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        color: colors.textPrimary,
                        fontSize: 14,
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {entry.name}
                    </div>
                    <div style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>
                      {entry.squares} square{entry.squares !== 1 ? "s" : ""}
                      {entry.amount ? ` · $${entry.amount}` : ""}
                    </div>
                  </div>

                  {!isConfirming && (
                    <button
                      type="button"
                      onClick={() => setConfirming(index)}
                      style={{
                        ...btnSecondary,
                        padding: "6px 14px",
                        fontSize: 12,
                        color: colors.textDim,
                        flexShrink: 0,
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>

                {isConfirming && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      marginTop: 10,
                    }}
                  >
                    <span style={{ color: colors.accentRed, fontSize: 12, flex: 1 }}>
                      Remove and free their squares?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onRemove(index);
                        setConfirming(null);
                      }}
                      style={{
                        ...btnSecondary,
                        padding: "6px 14px",
                        fontSize: 12,
                        color: colors.accentRed,
                        borderColor: "#ff6b6b40",
                      }}
                    >
                      Yes, remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      style={{ ...btnSecondary, padding: "6px 14px", fontSize: 12 }}
                    >
                      Cancel
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
