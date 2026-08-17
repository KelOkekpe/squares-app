import React, { useState } from "react";
import { useSpaceAdmins } from "../../hooks/useSpaceAdmins";
import { colors, radii, adminInputStyle, adminSectionStyle, btnPrimary, btnSecondary } from "../../styles";

export function AdminInviteSection({ spaceCode, isOwner }) {
  const { admins, loading, inviteAdmin, removeAdmin } = useSpaceAdmins(spaceCode);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleInvite = async () => {
    setError("");
    setSuccess("");

    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter an email address");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address");
      return;
    }
    if (admins.find((a) => a.email === trimmed)) {
      setError("This person is already assigned to this space");
      return;
    }

    const { error: inviteError } = await inviteAdmin(trimmed);
    if (inviteError) {
      setError(inviteError.message || "Failed to add admin");
    } else {
      setSuccess(`Added ${trimmed}`);
      setEmail("");
    }
  };

  if (!isOwner) return null;

  return (
    <div style={adminSectionStyle}>
      <h3
        style={{
          margin: "0 0 16px",
          fontSize: 15,
          fontWeight: 700,
          color: colors.textSecondary,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 18 }}>👥</span>
        Assign Space Admins
      </h3>
      <p style={{ color: colors.textDim, fontSize: 12, margin: "0 0 12px" }}>
        Add existing users by email. Registered users get immediate access; others will get access when they sign up.
      </p>

      {/* Assign form */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
            setSuccess("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleInvite()}
          placeholder="admin@example.com"
          style={{ ...adminInputStyle, flex: 1 }}
        />
        <button
          onClick={handleInvite}
          style={{
            ...btnPrimary,
            padding: "10px 20px",
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          Add
        </button>
      </div>

      {error && (
        <p style={{ color: colors.accentRed, fontSize: 12, margin: "0 0 12px" }}>
          {error}
        </p>
      )}
      {success && (
        <p style={{ color: colors.accentGreen, fontSize: 12, margin: "0 0 12px" }}>
          {success}
        </p>
      )}

      {/* Admin list */}
      {loading ? (
        <p style={{ color: colors.textDim, fontSize: 13 }}>Loading...</p>
      ) : admins.length === 0 ? (
        <p style={{ color: colors.textDim, fontSize: 13, margin: 0 }}>
          No admins assigned yet. Add users by email above.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {admins.map((admin) => (
            <div
              key={admin.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                background: "#ffffff04",
                borderRadius: radii.md,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div>
                <span
                  style={{
                    color: colors.textSecondary,
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {admin.email}
                </span>
                <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                  <span
                    style={{
                      fontSize: 11,
                      color: admin.role === "owner" ? colors.accentGold : colors.accentPurple,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {admin.role}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: admin.accepted ? colors.accentGreen : colors.accentOrange,
                      fontWeight: 600,
                    }}
                  >
                    {admin.accepted ? "Active" : "Pending"}
                  </span>
                </div>
              </div>
              {admin.role !== "owner" && (
                <button
                  onClick={() => removeAdmin(admin.id)}
                  style={{
                    ...btnSecondary,
                    padding: "6px 12px",
                    fontSize: 11,
                    color: colors.accentRed,
                    borderColor: "#ff6b6b20",
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
