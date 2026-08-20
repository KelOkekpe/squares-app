import React, { useState } from "react";
import { colors, radii, btnPrimary, btnSecondary } from "../../styles";
import { buildMailtoLink } from "../../utils/notify";

/**
 * Shown right after an approval, because that is the only moment the assigned
 * squares are known — the board stores names, not who got which cell.
 *
 * Sending is a one-click mail link rather than an automated send: transactional
 * email needs a server-side sender, and this app has no backend. The message is
 * built by the same helper an automated sender would use, so wiring one in
 * later is a swap, not a rewrite.
 */
export function ApprovalNotice({ notice, onDismiss }) {
  const [copied, setCopied] = useState(false);
  if (!notice) return null;

  const { entry, coords, message } = notice;

  return (
    <div
      style={{
        background: colors.surface3,
        border: `1px solid ${colors.accentGreenBright}40`,
        borderRadius: radii.lg,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <strong style={{ color: colors.accentGreenBright, fontSize: 14 }}>
          Approved — {entry.name}
        </strong>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            color: colors.textDim,
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: 2,
          }}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      <p style={{ color: colors.textMuted, fontSize: 12, margin: "0 0 8px" }}>
        {coords.length} square{coords.length === 1 ? "" : "s"} assigned. Send {entry.email} their
        coordinates:
      </p>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 12,
        }}
      >
        {coords.map((c, i) => (
          <span
            key={i}
            style={{
              background: colors.surface5,
              border: `1px solid ${colors.border}`,
              borderRadius: radii.pill,
              padding: "3px 10px",
              fontSize: 11,
              fontWeight: 700,
              color: colors.textSecondary,
            }}
          >
            {c.x} / {c.y}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a
          href={buildMailtoLink(message, entry.email)}
          style={{ ...btnPrimary, padding: "8px 16px", fontSize: 13, textDecoration: "none" }}
        >
          Email {entry.firstName || "them"}
        </a>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(message.body).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          style={{ ...btnSecondary, padding: "8px 16px", fontSize: 13 }}
        >
          {copied ? "Copied" : "Copy message"}
        </button>
      </div>
    </div>
  );
}
