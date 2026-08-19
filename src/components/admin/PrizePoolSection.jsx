import React from "react";
import { adminSectionStyle, adminInputStyle, labelStyle } from "../../styles";
import { colors } from "../../styles";

export function PrizePoolSection({ config, setConfig }) {
  return (
    <div style={adminSectionStyle}>
      <label style={labelStyle}>Prize Pool & Payouts</label>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ ...labelStyle, fontSize: 10 }}>Total Prize Pot ($)</label>
          <input
            type="number"
            min={0}
            value={config.totalPot || ""}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                totalPot: Number(e.target.value) || 0,
              }))
            }
            style={adminInputStyle}
            placeholder="e.g. 1000"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ ...labelStyle, fontSize: 10 }}>Quarterly Payout ($)</label>
          <input
            type="number"
            min={0}
            value={config.quarterlyPayout || ""}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                quarterlyPayout: Number(e.target.value) || 0,
              }))
            }
            style={adminInputStyle}
            placeholder="e.g. 250"
          />
        </div>
      </div>
      {(config.totalPot > 0 || config.quarterlyPayout > 0) && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 16px",
            background: "#ffffff06",
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            display: "flex",
            justifyContent: "center",
            gap: 28,
            fontSize: 13,
          }}
        >
          {config.totalPot > 0 && (
            <span style={{ color: colors.accentGreenBright, fontWeight: 700 }}>
              Pot: ${config.totalPot.toLocaleString()}
            </span>
          )}
          {config.quarterlyPayout > 0 && (
            <span style={{ color: colors.accentYellow, fontWeight: 700 }}>
              Per Quarter: ${config.quarterlyPayout.toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
