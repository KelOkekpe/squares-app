import React from "react";
import { cardStyle, btnPrimary, btnSecondary } from "../../styles";
import { colors } from "../../styles";

/**
 * Shown after a player submits an entry request. Nothing is on the board yet —
 * an admin has to confirm the payment arrived first.
 */
export function EntrySubmitted({
  fullName,
  requestedCount,
  amount,
  pricePerSquare,
  onViewBoard,
  onDone,
}) {
  return (
    <div style={{ ...cardStyle, textAlign: "center" }}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${colors.accentOrange}, ${colors.accentYellow})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: 32,
        }}
      >
        ⏳
      </div>
      <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>
        Request Submitted
      </h2>
      <p style={{ color: colors.textMuted, marginBottom: 8, fontSize: 15 }}>
        <strong style={{ color: colors.textSecondary }}>{fullName}</strong>{" "}
        requested{" "}
        <strong style={{ color: colors.accentPurple }}>
          {requestedCount} square{requestedCount !== 1 ? "s" : ""}
        </strong>
      </p>
      <p style={{ color: colors.textDim, fontSize: 13, marginBottom: 20 }}>
        ${amount} · ${pricePerSquare}/square
      </p>

      <div
        style={{
          padding: "12px 16px",
          background: "#ffffff06",
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          marginBottom: 24,
        }}
      >
        <p style={{ margin: 0, color: colors.textMuted, fontSize: 12, lineHeight: 1.6 }}>
          Your admin will confirm your payment and assign your squares. They'll
          appear on the board once approved — check back shortly.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onViewBoard} style={{ ...btnPrimary, flex: 1 }}>
          View Board
        </button>
        <button onClick={onDone} style={{ ...btnSecondary, flex: 1 }}>
          Done
        </button>
      </div>
    </div>
  );
}
