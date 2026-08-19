import React from "react";
import { inputStyle, labelStyle, btnPrimary } from "../../styles";
import { colors } from "../../styles";

export function NameStep({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  nameSubmitted,
  setNameSubmitted,
  fullName,
}) {
  const isValid = firstName.trim() && lastName.trim();

  return (
    <div style={{ marginBottom: nameSubmitted ? 32 : 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: nameSubmitted ? colors.accentGreen : colors.accentPurple,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 800,
            color: colors.white,
            flexShrink: 0,
          }}
        >
          {nameSubmitted ? "✓" : "1"}
        </div>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Enter Your Name</h3>
      </div>

      {!nameSubmitted ? (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>First Name *</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={inputStyle}
                placeholder="John"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Last Name *</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={inputStyle}
                placeholder="Doe"
              />
            </div>
          </div>
          <button
            onClick={() => {
              if (isValid) setNameSubmitted(true);
            }}
            disabled={!isValid}
            style={{ ...btnPrimary, width: "100%", opacity: isValid ? 1 : 0.4 }}
          >
            Continue
          </button>
        </>
      ) : (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 16px",
            background: "#22aa4415",
            borderRadius: 10,
            border: "1px solid #22aa4430",
          }}
        >
          <span style={{ color: "#88ddaa", fontWeight: 600 }}>{fullName}</span>
          <button
            onClick={() => setNameSubmitted(false)}
            style={{
              background: "none",
              border: "none",
              color: "#666",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
