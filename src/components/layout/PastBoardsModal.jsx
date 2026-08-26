import React from "react";
import { colors, radii, cardStyle, btnSecondary } from "../../styles";
import { poolStatus, formatDate } from "../../utils";

/**
 * Completed boards — archived or past their end date. Kept separate from the
 * active picker so finished games stay readable without cluttering the list of
 * boards you can still enter.
 */
export function PastBoardsModal({ pools, activePoolId, onSelect, onClose }) {
  return (
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
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          ...cardStyle,
          maxWidth: 420,
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 6,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>Past Boards</h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: colors.textDim,
              cursor: "pointer",
              fontSize: 18,
              padding: 4,
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p style={{ color: colors.textMuted, fontSize: 13, margin: "0 0 18px" }}>
          These boards have ended. You can still see the grid and who won, but they aren't taking
          new entries.
        </p>

        {pools.length === 0 ? (
          <p style={{ color: colors.textDim, fontSize: 13, margin: 0 }}>No past boards yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...pools]
              .sort((a, b) => (b.expiresAt || "").localeCompare(a.expiresAt || ""))
              .map((p) => {
                const status = poolStatus(p);
                const isCurrent = p.id === activePoolId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelect(p.id);
                      onClose();
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      background: isCurrent ? colors.surface5 : colors.surface3,
                      border: `1px solid ${isCurrent ? colors.accentBrandAlt : colors.border}`,
                      borderRadius: radii.lg,
                      padding: "12px 16px",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      width: "100%",
                    }}
                  >
                    <span style={{ color: colors.textSecondary, fontSize: 14, fontWeight: 600 }}>
                      {p.name}
                    </span>
                    <span style={{ color: colors.textDim, fontSize: 11, flexShrink: 0 }}>
                      {p.archived ? "Archived" : formatDate(p.expiresAt)}
                    </span>
                  </button>
                );
              })}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{ ...btnSecondary, width: "100%", marginTop: 18 }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
