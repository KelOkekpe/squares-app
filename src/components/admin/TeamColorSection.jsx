import React from "react";
import { adminSectionStyle, adminInputStyle, labelStyle } from "../../styles";
import { fonts } from "../../styles";

export function ColorPicker({ label, value, onChange, inputStyle }) {
  return (
    <div style={{ flex: 1 }}>
      <label style={{ ...labelStyle, fontSize: 10 }}>{label}</label>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 36,
            height: 36,
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            background: "none",
            padding: 0,
          }}
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...inputStyle,
            fontFamily: fonts.mono,
            fontSize: 12,
          }}
        />
      </div>
    </div>
  );
}

function TeamPreview({ bg, color, name }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${bg}, ${bg}cc)`,
        color,
        padding: "8px 16px",
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: "uppercase",
        textAlign: "center",
      }}
    >
      {name} — Preview
    </div>
  );
}

export function TeamColorSection({ config, setConfig }) {
  const update = (field) => (val) => setConfig((c) => ({ ...c, [field]: val }));

  return (
    <div style={adminSectionStyle}>
      {/* ── X-axis team ──────────────────── */}
      <label style={labelStyle}>X-Axis Team</label>
      <input
        value={config.teamX}
        onChange={(e) => update("teamX")(e.target.value)}
        style={{ ...adminInputStyle, marginBottom: 12 }}
        placeholder="e.g. Seattle Seahawks"
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <ColorPicker
          label="Background"
          value={config.teamXBg || "#1e3a5f"}
          onChange={update("teamXBg")}
          inputStyle={adminInputStyle}
        />
        <ColorPicker
          label="Text Color"
          value={config.teamXColor || "#7db8f0"}
          onChange={update("teamXColor")}
          inputStyle={adminInputStyle}
        />
      </div>
      <div style={{ marginBottom: 20 }}>
        <TeamPreview
          bg={config.teamXBg || "#1e3a5f"}
          color={config.teamXColor || "#7db8f0"}
          name={config.teamX || "Team X"}
        />
      </div>

      {/* ── Y-axis team ──────────────────── */}
      <label style={labelStyle}>Y-Axis Team</label>
      <input
        value={config.teamY}
        onChange={(e) => update("teamY")(e.target.value)}
        style={{ ...adminInputStyle, marginBottom: 12 }}
        placeholder="e.g. New England Patriots"
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
        <ColorPicker
          label="Background"
          value={config.teamYBg || "#3a1e2e"}
          onChange={update("teamYBg")}
          inputStyle={adminInputStyle}
        />
        <ColorPicker
          label="Text Color"
          value={config.teamYColor || "#f0a0b8"}
          onChange={update("teamYColor")}
          inputStyle={adminInputStyle}
        />
      </div>
      <TeamPreview
        bg={config.teamYBg || "#3a1e2e"}
        color={config.teamYColor || "#f0a0b8"}
        name={config.teamY || "Team Y"}
      />
    </div>
  );
}
