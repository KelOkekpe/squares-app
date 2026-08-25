import React from "react";
import { inputStyle, labelStyle, radii } from "../../styles";
import { colors } from "../../styles";

export const PAYOUT_METHODS = [
  { key: "zelle", label: "Zelle", placeholder: "email or phone on file" },
  { key: "venmo", label: "Venmo", placeholder: "@your-handle" },
  { key: "cashapp", label: "Cash App", placeholder: "$yourcashtag" },
];

/**
 * How a winner wants to be paid.
 *
 * One method at a time. It used to show all three handle fields at once with a
 * "preferred" toggle beside each, which asked people to fill in accounts they
 * weren't going to be paid through and made the preferred one easy to miss.
 * Nobody is paid three ways.
 *
 * Shared between the squares join flow and the pick'em sheet — a pick'em winner
 * is owed money exactly as a squares winner is.
 */
export function PayoutPicker({ method, setMethod, handles, setHandles, compact }) {
  const selected = PAYOUT_METHODS.find((m) => m.key === method);

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        borderRadius: radii.lg,
        padding: compact ? 12 : 14,
        marginBottom: compact ? 12 : 18,
        background: colors.surface2,
      }}
    >
      <label style={{ ...labelStyle, marginBottom: 2 }}>How you'd like to be paid</label>
      <p style={{ color: colors.textDim, fontSize: 11, margin: "0 0 10px" }}>
        Optional — but if you win, this is how your admin sends it.
      </p>

      <select
        value={method || ""}
        onChange={(e) => {
          const next = e.target.value;
          setMethod(next);
          // Clearing the method clears the handle with it, so a stale value
          // from a method they changed their mind about isn't submitted.
          if (!next) setHandles({});
        }}
        style={{ ...inputStyle, marginBottom: selected ? 10 : 0 }}
      >
        <option value="">Choose a method…</option>
        {PAYOUT_METHODS.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label}
          </option>
        ))}
      </select>

      {selected && (
        <input
          value={handles?.[selected.key] || ""}
          onChange={(e) => setHandles({ [selected.key]: e.target.value })}
          style={{ ...inputStyle, marginBottom: 0 }}
          placeholder={selected.placeholder}
          aria-label={`Your ${selected.label} details`}
        />
      )}
    </div>
  );
}
