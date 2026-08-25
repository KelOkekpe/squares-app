import React from "react";
import { inputStyle, labelStyle, btnPrimary, btnSecondary, radii } from "../../styles";
import { LegalConsent } from "../common";
import { buildPaymentLink, configuredProviders } from "../../utils";
import { colors } from "../../styles";

export function PaymentStep({
  config,
  emptyCount,
  amount,
  setAmount,
  squaresForAmount,
  submitting,
  submitError,
  paymentRef: ref,
  paymentNote: note,
  onConfirm,
  onViewBoard,
}) {
  const canSubmit = squaresForAmount >= 1 && !config.submissionsDisabled && !submitting;
  const providers = configuredProviders(config.paymentHandles);
  const amountLabel = Number(amount) > 0 ? ` $${Number(amount).toFixed(2)}` : "";

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
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Send Payment</h3>
      </div>

      {/* Where to send the money — set by the admin in the admin panel */}
      <div
        style={{
          padding: 20,
          background: colors.surfaceDeep,
          borderRadius: 16,
          border: `1px solid ${colors.border}`,
          marginBottom: 20,
        }}
      >
        {/* Tapping one of these opens the organiser's payment app with the
            amount and reference filled in. The payment happens there, between
            the player and the organiser — never through this app. */}
        {providers.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {providers.map((provider) => {
              const handle = config.paymentHandles?.[provider.key];
              const href = buildPaymentLink(provider.key, handle, amount, note);

              if (!href) {
                // Zelle has no shared link format — show the handle to copy
                return (
                  <div
                    key={provider.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 14px",
                      background: colors.surface3,
                      border: `1px solid ${colors.border}`,
                      borderRadius: radii.lg,
                    }}
                  >
                    <span style={{ fontSize: 12, color: colors.textMuted }}>
                      <strong style={{ color: colors.textSecondary }}>{provider.label}</strong>{" "}
                      {handle}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(handle)}
                      style={{ ...btnSecondary, padding: "5px 12px", fontSize: 11 }}
                    >
                      Copy
                    </button>
                  </div>
                );
              }

              return (
                <a
                  key={provider.key}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "12px 16px",
                    background: colors.surface3,
                    border: `1px solid ${colors.borderSubtle}`,
                    borderRadius: radii.lg,
                    color: colors.textPrimary,
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  <span>
                    Pay{amountLabel} with {provider.label}
                  </span>
                  <span style={{ color: colors.accentViolet, fontSize: 12 }}>Open →</span>
                </a>
              );
            })}

            {ref && (
              <p style={{ color: colors.textDim, fontSize: 11, margin: "2px 0 0" }}>
                Reference <strong style={{ color: colors.textMuted }}>{ref}</strong> is added to the
                note so your admin can match your payment.
                {providers.some((p) => !p.supportsNote) &&
                  " Cash App and PayPal can't carry a note — add it yourself if you use those."}
              </p>
            )}
          </div>
        )}

        {config.paymentInstructions ? (
          <p
            style={{
              margin: 0,
              color: colors.textSecondary,
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {config.paymentInstructions}
          </p>
        ) : (
          <p style={{ margin: 0, color: colors.textMuted, fontSize: 13, lineHeight: 1.6 }}>
            Your admin hasn't added payment details yet. Ask them where to send payment before
            submitting.
          </p>
        )}
        <p style={{ color: colors.textDim, fontSize: 11, margin: "12px 0 0" }}>
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
              You'll request{" "}
              <strong style={{ color: colors.accentPurple }}>
                {Math.min(squaresForAmount, emptyCount)} square
                {Math.min(squaresForAmount, emptyCount) !== 1 ? "s" : ""}
              </strong>
              {squaresForAmount > emptyCount && (
                <span style={{ color: colors.accentRed }}> (only {emptyCount} available)</span>
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

      {/* Set expectations before they submit */}
      <div
        style={{
          padding: "12px 16px",
          background: colors.surface3,
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          marginBottom: 16,
        }}
      >
        <p style={{ margin: 0, color: colors.textMuted, fontSize: 12, lineHeight: 1.6 }}>
          Send the payment first, then submit. Your squares are assigned once your admin confirms
          the money arrived — they aren't reserved in the meantime.
        </p>
      </div>

      {submitError && (
        <p style={{ color: colors.accentRed, fontSize: 13, margin: "0 0 14px" }}>{submitError}</p>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onConfirm}
          disabled={!canSubmit}
          style={{ ...btnPrimary, flex: 2, opacity: canSubmit ? 1 : 0.4 }}
        >
          {submitting ? "Submitting…" : "Submit Request"}
        </button>
        <button onClick={onViewBoard} style={{ ...btnSecondary, flex: 1 }}>
          View Board
        </button>
      </div>

      <LegalConsent action="submitting an entry" />
    </div>
  );
}
