import React from "react";
import { QUARTERS } from "../../utils";
import { adminSectionStyle, adminInputStyle, labelStyle } from "../../styles";

export function QuarterScoresSection({ config, scores, setScores }) {
  return (
    <div style={adminSectionStyle}>
      <label style={labelStyle}>Quarter Scores</label>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr auto",
          gap: 8,
          alignItems: "center",
        }}
      >
        {QUARTERS.map((q) => (
          <React.Fragment key={q}>
            <span style={{ color: "#c8c8e8", fontSize: 13, fontWeight: 700 }}>
              {q}
            </span>
            <input
              type="number"
              min={0}
              placeholder={config.teamX?.split(" ").pop() || "X"}
              value={scores[q]?.x ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setScores((s) => ({
                  ...s,
                  [q]:
                    val === "" && !scores[q]?.y
                      ? undefined
                      : {
                          x: val === "" ? 0 : Number(val),
                          y: scores[q]?.y ?? 0,
                        },
                }));
              }}
              style={{ ...adminInputStyle, textAlign: "center", padding: "8px" }}
            />
            <input
              type="number"
              min={0}
              placeholder={config.teamY?.split(" ").pop() || "Y"}
              value={scores[q]?.y ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setScores((s) => ({
                  ...s,
                  [q]:
                    val === "" && !scores[q]?.x
                      ? undefined
                      : {
                          x: scores[q]?.x ?? 0,
                          y: val === "" ? 0 : Number(val),
                        },
                }));
              }}
              style={{ ...adminInputStyle, textAlign: "center", padding: "8px" }}
            />
            <button
              onClick={() =>
                setScores((s) => {
                  const ns = { ...s };
                  delete ns[q];
                  return ns;
                })
              }
              style={{
                background: "#ff444420",
                border: "1px solid #ff444440",
                color: "#ff6666",
                borderRadius: 6,
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Clear
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
