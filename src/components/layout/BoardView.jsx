import React from "react";
import { btnPrimary } from "../../styles";
import { SquaresGrid } from "../grid/SquaresGrid";
import { WinnersSummary } from "../grid/WinnersSummary";

export function BoardView({ board, headers, config, scores, emptyCount, onJoin }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: -1,
            }}
          >
            The Board
          </h2>
          <p style={{ margin: "4px 0 0", color: "#666", fontSize: 13 }}>
            {config.teamX} vs {config.teamY}
          </p>
        </div>
        {/* Home lives in the header nav — no second one here */}
        <button
          onClick={onJoin}
          disabled={config.submissionsDisabled || emptyCount === 0}
          style={{
            ...btnPrimary,
            opacity: config.submissionsDisabled || emptyCount === 0 ? 0.5 : 1,
          }}
        >
          {emptyCount === 0 ? "Pool Full" : "Join Pool"}
        </button>
      </div>

      <SquaresGrid board={board} headers={headers} config={config} scores={scores} />

      <WinnersSummary headers={headers} board={board} scores={scores} />
    </div>
  );
}
