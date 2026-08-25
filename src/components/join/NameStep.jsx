import React from "react";
import { inputStyle, labelStyle, btnPrimary } from "../../styles";
import { PayoutPicker } from "./PayoutPicker";
import { colors } from "../../styles";

export const isValidEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || "").trim());
/**
 * Step 1 of joining: who you are and how to reach you.
 *
 * Email is required — an approved entry is money owed, and a name
 * alone gives an admin no way to reach a winner or tell two players with the
 * same name apart. Payout details are optional and only matter if you win.
 */
export function NameStep({
  firstName,
  setFirstName,
  middleInitial,
  setMiddleInitial,
  lastName,
  setLastName,
  email,
  setEmail,
  payoutMethod,
  setPayoutMethod,
  payoutHandles,
  setPayoutHandles,
  nameSubmitted,
  setNameSubmitted,
  fullName,
}) {
  const emailOk = isValidEmail(email);
  const isValid = firstName.trim() && lastName.trim() && emailOk;

  return (
    <div style={{ marginBottom: nameSubmitted ? 32 : 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
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
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Your Details</h3>
      </div>

      {!nameSubmitted ? (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 3 }}>
              <label style={labelStyle}>First Name *</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={inputStyle}
                placeholder="John"
              />
            </div>
            <div style={{ flex: 1, minWidth: 62 }}>
              <label style={labelStyle}>M.I.</label>
              <input
                value={middleInitial}
                onChange={(e) =>
                  setMiddleInitial(
                    e.target.value
                      .replace(/[^A-Za-z]/g, "")
                      .slice(0, 1)
                      .toUpperCase()
                  )
                }
                style={{ ...inputStyle, textAlign: "center" }}
                placeholder="Q"
                maxLength={1}
              />
            </div>
            <div style={{ flex: 3 }}>
              <label style={labelStyle}>Last Name *</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={inputStyle}
                placeholder="Doe"
              />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="you@example.com"
            />
            {email && !emailOk && (
              <p style={{ color: colors.accentRed, fontSize: 11, margin: "4px 0 0" }}>
                That doesn't look like a valid email
              </p>
            )}
          </div>

          <p style={{ color: colors.textDim, fontSize: 11, margin: "0 0 18px" }}>
            Your admin uses this to confirm your payment and reach you if you win.
          </p>

          {/* Optional — only relevant if they win */}
          <PayoutPicker
            method={payoutMethod}
            setMethod={setPayoutMethod}
            handles={payoutHandles}
            setHandles={setPayoutHandles}
          />

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
            background: colors.surface2,
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ color: colors.accentGreenBright, fontWeight: 600 }}>{fullName}</div>
            <div style={{ color: colors.textDim, fontSize: 11, marginTop: 2 }}>{email}</div>
          </div>
          <button
            onClick={() => setNameSubmitted(false)}
            style={{
              background: "none",
              border: "none",
              color: colors.textMuted,
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
