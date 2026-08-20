import React, { useState } from "react";
import { colors, radii, btnSecondary, inputStyle } from "../../styles";

const ROLES = ["player", "owner", "superadmin"];

export function UsersSection({ users, onClose, onReopen, onSetRole, onViewAs }) {
  const [confirming, setConfirming] = useState(null);
  const [reason, setReason] = useState("");

  if (!users.length) {
    return <p style={{ color: colors.textMuted, fontSize: 13 }}>No users match.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {users.map((u) => {
        const closed = !!u.closed_at;
        const isConfirming = confirming === u.id;
        return (
          <div
            key={u.id}
            style={{
              background: closed ? "#ff6b6b0a" : "#ffffff06",
              border: `1px solid ${closed ? "#ff6b6b30" : colors.border}`,
              borderRadius: radii.lg,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: colors.textPrimary }}>
                  {u.display_name || u.email}
                  {closed && (
                    <span
                      style={{
                        color: colors.accentRed,
                        fontSize: 11,
                        marginLeft: 8,
                        fontWeight: 700,
                      }}
                    >
                      CLOSED
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: colors.textDim, marginTop: 2 }}>
                  {u.email} · {u.space_count} space{u.space_count === 1 ? "" : "s"}
                  {u.closed_reason ? ` · ${u.closed_reason}` : ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={u.role}
                  onChange={(e) => onSetRole(u.id, e.target.value)}
                  style={{
                    ...inputStyle,
                    width: "auto",
                    padding: "5px 8px",
                    fontSize: 12,
                    color: u.role === "superadmin" ? colors.accentRed : colors.textSecondary,
                  }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                {u.role !== "superadmin" && (
                  <button
                    type="button"
                    onClick={() => onViewAs(u.id)}
                    style={{ ...btnSecondary, padding: "5px 12px", fontSize: 12 }}
                  >
                    View as
                  </button>
                )}

                {closed ? (
                  <button
                    type="button"
                    onClick={() => onReopen(u.id)}
                    style={{
                      ...btnSecondary,
                      padding: "5px 12px",
                      fontSize: 12,
                      color: colors.accentGreenBright,
                      borderColor: "#4ade8040",
                    }}
                  >
                    Reopen
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(u.id);
                      setReason("");
                    }}
                    style={{
                      ...btnSecondary,
                      padding: "5px 12px",
                      fontSize: 12,
                      color: colors.accentRed,
                      borderColor: "#ff6b6b40",
                    }}
                  >
                    Close
                  </button>
                )}
              </div>
            </div>

            {isConfirming && (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (recorded in the audit log)"
                  style={{ ...inputStyle, flex: "1 1 200px", padding: "7px 10px", fontSize: 12 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    onClose(u.id, reason);
                    setConfirming(null);
                  }}
                  style={{
                    ...btnSecondary,
                    padding: "7px 14px",
                    fontSize: 12,
                    color: colors.accentRed,
                    borderColor: "#ff6b6b40",
                  }}
                >
                  Confirm close
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  style={{ ...btnSecondary, padding: "7px 14px", fontSize: 12 }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
