import React from "react";
import { adminSectionStyle, adminInputStyle, labelStyle } from "../../styles";
import { colors } from "../../styles";
import { PAYMENT_PROVIDERS } from "../../utils";

/**
 * Where players send their money.
 *
 * Shared by both contest types. It used to live inside the squares-only branch
 * of the admin panel, so a pick'em admin had no way to say where to pay — and
 * their players hit "Your admin hasn't added payment details yet" with nothing
 * anyone could do about it.
 */
export function PaymentDetailsSection({ config, setConfig }) {
  return (
    <div style={adminSectionStyle}>
      <label style={labelStyle}>Payment instructions</label>
      <p style={{ color: colors.textDim, fontSize: 12, margin: "0 0 10px" }}>
        Players get a tappable link that opens your payment app with the amount and a reference
        already filled in. Payments go directly to you — this app never handles them.
      </p>

      {/* Structured handles build the deep links. Leave any blank to
        hide that option from players. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginBottom: 14,
        }}
      >
        {PAYMENT_PROVIDERS.map((provider) => (
          <div key={provider.key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span
              style={{
                width: 74,
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 700,
                color: colors.textMuted,
              }}
            >
              {provider.label}
            </span>
            <input
              value={config.paymentHandles?.[provider.key] || ""}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  paymentHandles: {
                    ...(c.paymentHandles || {}),
                    [provider.key]: e.target.value,
                  },
                }))
              }
              style={adminInputStyle}
              placeholder={provider.placeholder}
              title={provider.hint}
            />
          </div>
        ))}
      </div>

      <label style={{ ...labelStyle, fontSize: 10 }}>Extra instructions (optional)</label>
      <textarea
        rows={2}
        value={config.paymentInstructions || ""}
        onChange={(e) => setConfig((c) => ({ ...c, paymentInstructions: e.target.value }))}
        style={{ ...adminInputStyle, resize: "vertical", fontFamily: "inherit" }}
        placeholder={"Venmo @your-handle\nInclude your name in the note"}
      />
    </div>
  );
}
