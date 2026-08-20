import React, { useState } from "react";
import { colors, radii, btnSecondary, inputStyle } from "../../styles";
import { spaceUrl } from "../../utils/routes";

function ago(ts) {
  if (!ts) return "never";
  const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

export function SpacesSection({ spaces, users, onResetPassword, onTransfer, onDelete }) {
  const [panel, setPanel] = useState(null); // `${code}:${kind}`
  const [value, setValue] = useState("");

  if (!spaces.length) {
    return <p style={{ color: colors.textMuted, fontSize: 13 }}>No spaces match.</p>;
  }

  const open = (code, kind) => {
    setPanel(`${code}:${kind}`);
    setValue("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {spaces.map((s) => {
        const ownerless = !s.owner_id;
        const stale = s.pending_count > 0;
        return (
          <div
            key={s.code}
            style={{
              background: ownerless ? "#ff6b6b0a" : "#ffffff06",
              border: `1px solid ${ownerless ? "#ff6b6b30" : colors.border}`,
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
                  <a
                    href={spaceUrl(s.code)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: colors.textPrimary, textDecoration: "none" }}
                  >
                    #{s.code}
                  </a>
                  {s.is_private && (
                    <span
                      style={{
                        color: colors.accentGold,
                        fontSize: 11,
                        marginLeft: 8,
                        fontWeight: 700,
                      }}
                    >
                      PRIVATE
                    </span>
                  )}
                  {ownerless && (
                    <span
                      style={{
                        color: colors.accentRed,
                        fontSize: 11,
                        marginLeft: 8,
                        fontWeight: 700,
                      }}
                    >
                      NO OWNER
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: colors.textDim, marginTop: 2 }}>
                  {s.owner_email || s.admin_name || "unknown"} · {s.board_count} board
                  {s.board_count === 1 ? "" : "s"} · active {ago(s.last_activity)}
                  {stale && (
                    <span style={{ color: colors.accentOrange, fontWeight: 700 }}>
                      {" "}
                      · {s.pending_count} pending
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => open(s.code, "password")}
                  style={{ ...btnSecondary, padding: "5px 12px", fontSize: 12 }}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => open(s.code, "transfer")}
                  style={{ ...btnSecondary, padding: "5px 12px", fontSize: 12 }}
                >
                  Transfer
                </button>
                <button
                  type="button"
                  onClick={() => open(s.code, "delete")}
                  style={{
                    ...btnSecondary,
                    padding: "5px 12px",
                    fontSize: 12,
                    color: colors.accentRed,
                    borderColor: "#ff6b6b40",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            {panel === `${s.code}:password` && (
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
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="New password — leave blank to make the space public"
                  style={{ ...inputStyle, flex: "1 1 220px", padding: "7px 10px", fontSize: 12 }}
                />
                <button
                  type="button"
                  onClick={() => {
                    onResetPassword(s.code, value);
                    setPanel(null);
                  }}
                  style={{ ...btnSecondary, padding: "7px 14px", fontSize: 12 }}
                >
                  {value.trim() ? "Set password" : "Make public"}
                </button>
                <button
                  type="button"
                  onClick={() => setPanel(null)}
                  style={{ ...btnSecondary, padding: "7px 14px", fontSize: 12 }}
                >
                  Cancel
                </button>
              </div>
            )}

            {panel === `${s.code}:transfer` && (
              <div
                style={{
                  marginTop: 10,
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <select
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  style={{ ...inputStyle, flex: "1 1 200px", padding: "7px 10px", fontSize: 12 }}
                >
                  <option value="">Select new owner…</option>
                  {users
                    .filter((u) => !u.closed_at)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!value}
                  onClick={() => {
                    onTransfer(s.code, value);
                    setPanel(null);
                  }}
                  style={{
                    ...btnSecondary,
                    padding: "7px 14px",
                    fontSize: 12,
                    opacity: value ? 1 : 0.4,
                  }}
                >
                  Transfer
                </button>
                <button
                  type="button"
                  onClick={() => setPanel(null)}
                  style={{ ...btnSecondary, padding: "7px 14px", fontSize: 12 }}
                >
                  Cancel
                </button>
              </div>
            )}

            {panel === `${s.code}:delete` && (
              <div style={{ marginTop: 10 }}>
                <p style={{ color: colors.accentRed, fontSize: 12, margin: "0 0 8px" }}>
                  Permanently deletes the space, its {s.board_count} board
                  {s.board_count === 1 ? "" : "s"}, all entries, and admin links. Not reversible.
                  Type the code to confirm.
                </p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={s.code}
                    style={{ ...inputStyle, flex: "1 1 160px", padding: "7px 10px", fontSize: 12 }}
                  />
                  <button
                    type="button"
                    disabled={value !== s.code}
                    onClick={() => {
                      onDelete(s.code);
                      setPanel(null);
                    }}
                    style={{
                      ...btnSecondary,
                      padding: "7px 14px",
                      fontSize: 12,
                      color: colors.accentRed,
                      borderColor: "#ff6b6b40",
                      opacity: value === s.code ? 1 : 0.4,
                    }}
                  >
                    Delete permanently
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel(null)}
                    style={{ ...btnSecondary, padding: "7px 14px", fontSize: 12 }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
