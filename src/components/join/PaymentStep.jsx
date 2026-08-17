import React from "react";
import { QRCode } from "../common";
import { inputStyle, labelStyle, btnPrimary, btnSecondary } from "../../styles";
import { colors } from "../../styles";

export function PaymentStep({
  qrMemo,
  config,
  emptyCount,
  amount,
  setAmount,
  squaresForAmount,
  onConfirm,
  onViewBoard,
}) {
  const canSubmit = squaresForAmount >= 1 && !config.submissionsDisabled;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: colors.accentPurple,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 800,
            color: colors.white,
            flexShrink: 0,
          }}
        >
          2
        </div>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
          Send Payment
        </h3>
      </div>

      {/* QR code */}
      <div
        style={{
          textAlign: "center",
          padding: 24,
          background: "#0a0a1e",
          borderRadius: 16,
          border: `1px solid ${colors.border}`,
          marginBottom: 20,
        }}
      >
        <QRCode
          value={qrMemo}
          size={180}
          blurred={config.submissionsDisabled}
        />
        <p
          style={{
            marginTop: 14,
            color: colors.textMuted,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          Memo:{" "}
          <span style={{ color: colors.textSecondary, fontWeight: 600 }}>
            {qrMemo}
          </span>
        </p>
        <p style={{ color: colors.textDim, fontSize: 11, margin: "8px 0 0" }}>
          ${config.pricePerSquare} per square · {emptyCount} available
        </p>
      </div>

      {/* Amount */}
      <label style={labelStyle}>Amount Sent ($)</label>
      <input
        type="number"
        min={config.pricePerSquare}
        step="any"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ ...inputStyle, marginBottom: 8 }}
        placeholder={`Minimum $${config.pricePerSquare}`}
      />

      {amount && (
        <p style={{ color: "#a0a0cc", fontSize: 13, margin: "4px 0 16px" }}>
          {squaresForAmount > 0 ? (
            <>
              You'll get{" "}
              <strong style={{ color: colors.accentPurple }}>
                {Math.min(squaresForAmount, emptyCount)} square
                {Math.min(squaresForAmount, emptyCount) !== 1 ? "s" : ""}
              </strong>
              {squaresForAmount > emptyCount && (
                <span style={{ color: colors.accentRed }}>
                  {" "}
                  (only {emptyCount} available)
                </span>
              )}
              {Number(amount) % config.pricePerSquare !== 0 && (
                <span style={{ color: colors.accentOrange }}>
                  {" "}
                  · ${Number(amount) % config.pricePerSquare} remainder
                </span>
              )}
            </>
          ) : (
            <span style={{ color: colors.accentRed }}>
              Minimum ${config.pricePerSquare} per square
            </span>
          )}
        </p>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onConfirm}
          disabled={!canSubmit}
          style={{ ...btnPrimary, flex: 2, opacity: canSubmit ? 1 : 0.4 }}
        >
          Confirm Payment
        </button>
        <button onClick={onViewBoard} style={{ ...btnSecondary, flex: 1 }}>
          View Board
        </button>
      </div>
    </div>
  );
}
