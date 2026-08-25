import React from "react";
import { colors, radii } from "../../styles";
import { buildPaymentLink, buildPaymentNote, configuredProviders } from "../../utils";

/**
 * Sending the entry fee for a pick'em contest.
 *
 * The squares payment step without the amount field. A sheet has one fixed
 * price, so there is nothing for the player to type and nothing for the admin
 * to reconcile against a square count — only whether the fee arrived.
 *
 * What the links can carry differs by provider and there is no way around it:
 * Venmo takes the amount and the note, Cash App and PayPal take the amount
 * only, and Zelle has no link format at all, so its handle is shown to copy.
 * The reference is printed either way, since that is what the admin matches
 * against.
 */
export function PickemPaymentStep({ config, contestName, playerName, paymentRef }) {
  const fee = Number(config?.entryFee) || 0;
  if (fee <= 0) return null;

  const providers = configuredProviders(config.paymentHandles);
  const amount = fee.toFixed(2);
  const note = buildPaymentNote({
    playerName: playerName || undefined,
    poolName: contestName || "Pick'em",
    ref: paymentRef,
  });

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
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

      <div
        style={{
          padding: 16,
          background: colors.surfaceDeep,
          borderRadius: radii.lg,
          border: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            paddingBottom: 12,
            marginBottom: 12,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <strong style={{ fontSize: 14, color: colors.textSecondary }}>Entry fee</strong>
          <span style={{ fontSize: 22, fontWeight: 900, color: colors.textPrimary }}>
            ${amount}
          </span>
        </div>

        {providers.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {providers.map((provider) => {
              const handle = config.paymentHandles?.[provider.key];
              const href = buildPaymentLink(provider.key, handle, fee, note);

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
                    padding: "12px",
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

        {paymentRef && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              background: colors.surface2,
              border: `1px solid ${colors.border}`,
              borderRadius: radii.md,
            }}
          >
            <p style={{ margin: 0, fontSize: 11, color: colors.textDim }}>
              Include this reference so your admin can match the payment:
            </p>
            <strong
              style={{
                fontSize: 16,
                letterSpacing: 2,
                color: colors.accentGold,
                fontFamily: "monospace",
              }}
            >
              {paymentRef}
            </strong>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: colors.textDimmest }}>
              Venmo fills it in for you. Cash App and Zelle don't carry a note, so add it yourself.
            </p>
          </div>
        )}

        {config.paymentInstructions && (
          <p style={{ color: colors.textDim, fontSize: 12, margin: "12px 0 0", lineHeight: 1.6 }}>
            {config.paymentInstructions}
          </p>
        )}

        <p style={{ color: colors.textDim, fontSize: 12, margin: "12px 0 0", lineHeight: 1.6 }}>
          Send the payment first, then submit. Your picks are recorded either way — your admin
          confirms the fee separately.
        </p>
      </div>
    </div>
  );
}
