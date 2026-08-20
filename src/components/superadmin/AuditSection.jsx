import React from "react";
import { colors, radii } from "../../styles";

const TONE = {
  close_account: colors.accentRed,
  delete_space: colors.accentRed,
  view_as: colors.accentOrange,
  set_role: colors.accentGold,
  transfer_space: colors.accentViolet,
  space_password_reset: colors.accentGold,
  space_made_public: colors.accentGold,
  reopen_account: colors.accentGreenBright,
};

function when(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function AuditSection({ audit }) {
  if (!audit.length) {
    return <p style={{ color: colors.textMuted, fontSize: 13 }}>No actions recorded yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {audit.map((row) => (
        <div
          key={row.id}
          style={{
            display: "flex",
            gap: 10,
            alignItems: "baseline",
            padding: "8px 12px",
            background: "#ffffff04",
            border: `1px solid ${colors.border}`,
            borderRadius: radii.md,
            fontSize: 12,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              color: TONE[row.action] || colors.textSecondary,
              fontWeight: 700,
              minWidth: 130,
            }}
          >
            {row.action}
          </span>
          <span style={{ color: colors.textMuted, flex: 1, minWidth: 140 }}>
            {row.metadata?.email || row.target_id}
            {row.metadata?.to ? ` → ${row.metadata.to_email || row.metadata.to}` : ""}
            {row.metadata?.reason ? ` · ${row.metadata.reason}` : ""}
          </span>
          <span style={{ color: colors.textDim }}>{row.actor_email}</span>
          <span style={{ color: colors.textDim, fontSize: 11 }}>{when(row.created_at)}</span>
        </div>
      ))}
    </div>
  );
}
