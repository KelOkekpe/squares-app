import React from "react";
import { colors, radii } from "../../styles";
import { buildPaymentLink, configuredProviders } from "../../utils";

/**
 * Sending the entry fee for a pick'em contest.
 *
 * Same arrangement as the squares payment step and for the same reason: the
 * link opens the organiser's own payment app with the amount and a reference
 * filled in, and the money moves between two people. This app never touches it.
 *
 * Deliberately lighter than the squares version — a sheet has one fixed price,
 * so there is no amount to choose and nothing to reconcile against a square
 * count.
 */
export function PickemPaymentStep({ config, note }) {
  const fee = Number(config?.entryFee) || 0;
  if (fee <= 0) return null;

  const providers = configuredProviders(config.paymentHandles);
  const amount = fee.toFixed(2);

  return (
    <div
      style={{
        padding: 16,
        background: colors.surfaceDeep,
        borderRadius: radii.lg,
        border: `1px solid ${colors.border}`,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 10,
        }}
      >
        <strong style={{ fontSize: 14, color: colors.textSecondary }}>Entry fee</strong>
        <span style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>${amount}</span>
      </div>

      {providers.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {providers.map((provider) => {
            const handle = config.paymentHandles?.[provider.key];
            const href = buildPaymentLink(provider.key, handle, fee, note);

            // Zelle has no shareable link format, so the handle is shown to copy.
            if (!href) {
              return (
                <div
                  key={provider.key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    background: colors.surface2,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radii.md,
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: colors.textMuted }}>{provider.label}</span>
                  <strong style={{ color: colors.textPrimary }}>{handle}</strong>
                </div>
              );
            }

            return (
              <a
                key={provider.key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  textAlign: "center",
                  padding: "11px 12px",
                  borderRadius: radii.md,
                  background: colors.surface5,
                  border: `1px solid ${colors.border}`,
                  color: colors.textPrimary,
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Pay ${amount} with {provider.label}
              </a>
            );
          })}
        </div>
      ) : (
        <p style={{ color: colors.textMuted, fontSize: 12, margin: 0, lineHeight: 1.6 }}>
          Your admin hasn't said where to send the fee yet. Submit your picks anyway — they're
          recorded either way — and ask them how to pay.
        </p>
      )}

      {config.paymentInstructions && (
        <p style={{ color: colors.textDim, fontSize: 12, margin: "10px 0 0", lineHeight: 1.6 }}>
          {config.paymentInstructions}
        </p>
      )}
    </div>
  );
}
