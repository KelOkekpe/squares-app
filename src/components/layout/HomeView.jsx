import React from "react";
import { btnPrimary, btnSecondary } from "../../styles";
import { colors, radii } from "../../styles";

export function HomeView({
  config,
  emptyCount,
  participants,
  pools,
  activePoolId,
  onSwitchPool,
  onJoin,
  onViewBoard,
}) {
  const activePools = pools.filter((p) => !p.archived);
  const currentPool = pools.find((p) => p.id === activePoolId);

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
      <div style={{ marginBottom: 40 }}>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 900,
            lineHeight: 1.1,
            margin: "0 0 16px",
            letterSpacing: -2,
            background: `linear-gradient(135deg, ${colors.white} 30%, ${colors.accentViolet})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Football
          <br />
          Squares
        </h1>
        <p
          style={{
            color: colors.textMuted,
            fontSize: 16,
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {config.teamX} vs {config.teamY}
        </p>

        {/* Pool selector */}
        {activePools.length > 1 && (
          <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
            <div
              style={{
                display: "inline-flex",
                background: "#ffffff06",
                borderRadius: radii.pill,
                border: `1px solid ${colors.border}`,
                padding: 3,
                gap: 2,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {activePools.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSwitchPool(p.id)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: radii.pill,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                    transition: "all 0.15s",
                    background:
                      p.id === activePoolId
                        ? `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`
                        : "transparent",
                    color: p.id === activePoolId ? colors.white : colors.textMuted,
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {activePools.length === 1 && currentPool && (
          <p style={{ color: colors.textDim, fontSize: 13, marginTop: 8 }}>
            {currentPool.name}
          </p>
        )}

        <div
          style={{
            display: "inline-flex",
            gap: 24,
            marginTop: 16,
            padding: "12px 28px",
            background: "#ffffff06",
            borderRadius: 100,
            border: `1px solid ${colors.border}`,
          }}
        >
          <span
            style={{ color: colors.accentPurple, fontWeight: 700, fontSize: 14 }}
          >
            ${config.pricePerSquare}/square
          </span>
          <span style={{ color: colors.textDimmest }}>|</span>
          <span style={{ color: "#a0a0cc", fontSize: 14 }}>
            {emptyCount} squares left
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          onClick={onJoin}
          style={{
            ...btnPrimary,
            width: "100%",
            padding: "18px",
            fontSize: 16,
            opacity: config.submissionsDisabled || emptyCount === 0 ? 0.5 : 1,
          }}
          disabled={config.submissionsDisabled || emptyCount === 0}
        >
          {config.submissionsDisabled ? "Submissions Closed" : emptyCount === 0 ? "Pool Full" : "Join the Pool"}
        </button>
        <button
          onClick={onViewBoard}
          style={{ ...btnSecondary, width: "100%", padding: "16px" }}
        >
          View Board
        </button>
      </div>

      {/* Recent participants */}
      {participants.length > 0 && (
        <div style={{ marginTop: 40, textAlign: "left" }}>
          <h3
            style={{
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: colors.textDim,
              marginBottom: 12,
              fontWeight: 700,
            }}
          >
            Recent Entries
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...participants]
              .reverse()
              .slice(0, 5)
              .map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 16px",
                    background: "#ffffff04",
                    borderRadius: 10,
                    border: "1px solid #ffffff06",
                  }}
                >
                  <span
                    style={{
                      color: colors.textSecondary,
                      fontSize: 14,
                      fontWeight: 500,
                    }}
                  >
                    {p.name}
                  </span>
                  <span
                    style={{
                      color: colors.accentPurple,
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {p.squares} square{p.squares !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
