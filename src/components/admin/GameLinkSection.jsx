import React, { useState, useCallback } from "react";
import { adminSectionStyle, adminInputStyle, labelStyle, btnSecondary, radii } from "../../styles";
import { colors } from "../../styles";
import { withTimeout } from "../../utils/async";

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Links a board to a real game so quarter scores fill themselves in.
 *
 * Picking a game also names the axes, since a squares grid is only meaningful
 * once each side maps to a team — and which team sits on which axis is what
 * decides who wins.
 */
export function GameLinkSection({ config, setConfig }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [date, setDate] = useState(todayStamp());
  const linked = config.game;

  const loadGames = useCallback(async (stamp) => {
    setError("");
    setLoading(true);
    try {
      const response = await withTimeout(fetch(`/api/nfl-games?dates=${stamp}`), 15000, "games");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load games");
      setGames(payload.games || []);
      if (!payload.games?.length) setError("No games found for that date.");
    } catch (err) {
      setError(err?.message || "Could not load games");
      setGames([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const link = (game) => {
    setConfig((c) => ({
      ...c,
      // X is the column axis, Y the rows. Away on top matches how a printed
      // squares grid is usually laid out.
      teamX: game.away.name || c.teamX,
      teamY: game.home.name || c.teamY,
      game: {
        provider: "espn",
        id: game.id,
        name: game.name,
        startsAt: game.startsAt,
        xTeamId: game.away.id,
        yTeamId: game.home.id,
      },
    }));
    setGames([]);
  };

  const swapAxes = () =>
    setConfig((c) => ({
      ...c,
      teamX: c.teamY,
      teamY: c.teamX,
      game: c.game ? { ...c.game, xTeamId: c.game.yTeamId, yTeamId: c.game.xTeamId } : c.game,
    }));

  return (
    <div style={adminSectionStyle}>
      <label style={labelStyle}>Live scores</label>
      <p style={{ color: colors.textDim, fontSize: 12, margin: "0 0 10px" }}>
        Link this board to a game and quarter scores fill in automatically. Only finished quarters
        are recorded, so a lead mid-quarter never decides a winner.
      </p>

      {linked ? (
        <div
          style={{
            background: colors.surface3,
            border: `1px solid ${colors.borderSuccess}`,
            borderRadius: radii.lg,
            padding: "12px 14px",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
            {linked.name}
          </div>
          <div style={{ fontSize: 11, color: colors.textDim, marginTop: 4 }}>
            Columns: {config.teamX} · Rows: {config.teamY}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={swapAxes}
              style={{ ...btnSecondary, padding: "5px 12px", fontSize: 11 }}
            >
              Swap axes
            </button>
            <button
              type="button"
              onClick={() => setConfig((c) => ({ ...c, game: null }))}
              style={{
                ...btnSecondary,
                padding: "5px 12px",
                fontSize: 11,
                color: colors.accentRed,
              }}
            >
              Unlink
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 150px", minWidth: 0 }}>
              <label style={{ ...labelStyle, fontSize: 10, marginBottom: 4 }}>Game date</label>
              <input
                type="date"
                value={`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`}
                onChange={(e) => setDate(e.target.value.replace(/-/g, ""))}
                style={adminInputStyle}
              />
            </div>
            <button
              type="button"
              onClick={() => loadGames(date)}
              disabled={loading}
              style={{ ...btnSecondary, padding: "10px 18px", fontSize: 13, flexShrink: 0 }}
            >
              {loading ? "Loading…" : "Find games"}
            </button>
          </div>

          {error && (
            <p style={{ color: colors.accentRed, fontSize: 12, margin: "8px 0 0" }}>{error}</p>
          )}

          {games.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
              {games.map((game) => (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => link(game)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    background: colors.surface2,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radii.md,
                    padding: "9px 12px",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    color: colors.textSecondary,
                    fontSize: 12,
                  }}
                >
                  <span>{game.shortName || game.name}</span>
                  <span style={{ color: colors.textDim, fontSize: 11 }}>
                    {game.status === "STATUS_FINAL"
                      ? "Final"
                      : new Date(game.startsAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
