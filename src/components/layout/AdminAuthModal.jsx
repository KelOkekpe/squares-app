import React from "react";
import { cardStyle, inputStyle, btnPrimary, btnSecondary } from "../../styles";
import { ADMIN_PASSWORD } from "../../utils";

export function AdminAuthModal({
  adminPass,
  setAdminPass,
  password,
  onSuccess,
  onCancel,
}) {
  const attempt = () => {
    if (adminPass === (password || ADMIN_PASSWORD)) {
      onSuccess();
      setAdminPass("");
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ ...cardStyle, maxWidth: 360, textAlign: "center" }}>
        <h3 style={{ marginTop: 0, color: "#ff6b6b" }}>Admin Access</h3>
        <input
          type="password"
          placeholder="Enter admin password"
          value={adminPass}
          onChange={(e) => setAdminPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && attempt()}
          style={{ ...inputStyle, marginBottom: 16, textAlign: "center" }}
        />
        <p style={{ color: "#666", fontSize: 11, margin: "0 0 16px" }}>
          Enter the admin password for this board
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              onCancel();
              setAdminPass("");
            }}
            style={{ ...btnSecondary, flex: 1 }}
          >
            Cancel
          </button>
          <button
            onClick={attempt}
            style={{ ...btnPrimary, flex: 1, background: "#ff4444" }}
          >
            Enter
          </button>
        </div>
      </div>
    </div>
  );
}
