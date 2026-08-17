import React from "react";
import { cardStyle, btnPrimary, btnSecondary } from "../../styles";
import { colors } from "../../styles";

export function PaymentSuccess({
  fullName,
  addedCount,
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
          background: `linear-gradient(135deg, ${colors.accentGreen}, ${colors.accentGreenLight})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: 32,
        }}
      >
        ✓
      </div>
      <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 800 }}>
        You're In!
      </h2>
      <p style={{ color: colors.textMuted, marginBottom: 8, fontSize: 15 }}>
        <strong style={{ color: colors.textSecondary }}>{fullName}</strong> has
        been placed in{" "}
        <strong style={{ color: colors.accentPurple }}>
          {addedCount} square{addedCount !== 1 ? "s" : ""}
        </strong>
      </p>
      <p style={{ color: colors.textDim, fontSize: 13, marginBottom: 28 }}>
        ${amount} sent · ${pricePerSquare}/square
      </p>

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
