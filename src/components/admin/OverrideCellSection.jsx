import React, { useState } from "react";
import { adminSectionStyle, adminInputStyle, labelStyle } from "../../styles";

export function OverrideCellSection({ setBoard }) {
  const [overrideRow, setOverrideRow] = useState(0);
  const [overrideCol, setOverrideCol] = useState(0);
  const [overrideName, setOverrideName] = useState("");

  const apply = () => {
    setBoard((b) => {
      const nb = b.map((r) => [...r]);
      nb[overrideRow][overrideCol] = overrideName || null;
      return nb;
    });
    setOverrideName("");
  };

  return (
    <div style={adminSectionStyle}>
      <label style={labelStyle}>Override Cell</label>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ ...labelStyle, fontSize: 10 }}>Row (0-9)</label>
          <input
            type="number"
            min={0}
            max={9}
            value={overrideRow}
            onChange={(e) => setOverrideRow(Number(e.target.value))}
            style={adminInputStyle}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ ...labelStyle, fontSize: 10 }}>Col (0-9)</label>
          <input
            type="number"
            min={0}
            max={9}
            value={overrideCol}
            onChange={(e) => setOverrideCol(Number(e.target.value))}
            style={adminInputStyle}
          />
        </div>
        <div style={{ flex: 2 }}>
          <label style={{ ...labelStyle, fontSize: 10 }}>Name</label>
          <input
            value={overrideName}
            onChange={(e) => setOverrideName(e.target.value)}
            style={adminInputStyle}
            placeholder="Name (blank to clear)"
          />
        </div>
      </div>
      <button
        onClick={apply}
        style={{
          marginTop: 10,
          background: "#7c5cbf",
          color: "#fff",
          border: "none",
          padding: "10px 20px",
          borderRadius: 8,
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 13,
          width: "100%",
        }}
      >
        Apply Override
      </button>
    </div>
  );
}
