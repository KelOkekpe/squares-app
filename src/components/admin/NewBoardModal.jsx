import React, { useState, useEffect, useCallback } from "react";
import {
  colors,
  radii,
  cardStyle,
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
} from "../../styles";
import { MAX_ACTIVE_POOLS, todayISO, addDaysISO, isPoolActive } from "../../utils";
import { withTimeout } from "../../utils/async";

/**
 * Creating a board without opening the whole admin console.
 *
 * Picking a week and a game replaces three separate acts of typing — the board
 * name, the end date, and linking the game for live scores — with two
 * selections, and removes the chance of naming a board for one game while
 * linking it to another.
 */
export function NewBoardModal({ pools, onCreate, onClose }) {
  const [blocks, setBlocks] = useState([]);
  const [weekKey, setWeekKey] = useState("");
  const [games, setGames] = useState([]);
  const [gameId, setGameId] = useState("");
  const [gameType, setGameType] = useState("squares");
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [loadingWeeks, setLoadingWeeks] = useState(true);
  const [loadingGames, setLoadingGames] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const activeCount = pools.filter(isPoolActive).length;
  const atLimit = activeCount >= MAX_ACTIVE_POOLS;
  const game = games.find((g) => g.id === gameId);

  const get = useCallback(async (url, label) => {
    const res = await withTimeout(fetch(url), 15000, label);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || `Could not load ${label}`);
    return payload;
  }, []);

  useEffect(() => {
    let live = true;
    get("/api/nfl-weeks", "weeks")
      .then((p) => {
        if (!live) return;
        setBlocks(p.blocks || []);
        // Default to the regular season, which is what most pools run on
        const regular = (p.blocks || []).find((b) => b.seasonType === 2) || p.blocks?.[0];
        const upcoming =
          regular?.weeks.find((w) => new Date(w.endDate) >= new Date()) || regular?.weeks[0];
        if (regular && upcoming) setWeekKey(`${regular.seasonType}:${upcoming.week}:${p.year}`);
      })
      .catch((err) => live && setError(err.message))
      .finally(() => live && setLoadingWeeks(false));
    return () => {
      live = false;
    };
  }, [get]);

  useEffect(() => {
    if (!weekKey) return undefined;
    const [seasonType, week, year] = weekKey.split(":");
    let live = true;
    setLoadingGames(true);
    setGames([]);
    setGameId("");
    get(`/api/nfl-games?week=${week}&seasonType=${seasonType}&year=${year}`, "games")
      .then((p) => live && setGames(p.games || []))
      .catch((err) => live && setError(err.message))
      .finally(() => live && setLoadingGames(false));
    return () => {
      live = false;
    };
  }, [weekKey, get]);

  // Choosing a game names the board and dates it, so neither has to be typed
  useEffect(() => {
    if (!game) return;
    const weekLabel = blocks
      .flatMap((b) => b.weeks.map((w) => ({ ...w, seasonType: b.seasonType })))
      .find((w) => `${w.seasonType}:${w.week}:${weekKey.split(":")[2]}` === weekKey)?.label;

    if (gameType === "pickem") return; // named from the week, below
    setName(`${weekLabel ? `${weekLabel} — ` : ""}${game.shortName || game.name}`);
    if (game.startsAt) {
      // The board stays viewable through game day, then moves to Past Boards
      const kickoff = new Date(game.startsAt);
      const local = new Date(kickoff.getTime() - kickoff.getTimezoneOffset() * 60000);
      setExpiry(local.toISOString().slice(0, 10));
    }
  }, [game, blocks, weekKey, gameType]);

  // A pick'em contest is named for the week and dated from its last kickoff
  useEffect(() => {
    if (gameType !== "pickem" || !games.length) return;
    const weekLabel = blocks
      .flatMap((b) => b.weeks.map((w) => ({ ...w, seasonType: b.seasonType })))
      .find((w) => `${w.seasonType}:${w.week}:${weekKey.split(":")[2]}` === weekKey)?.label;
    setName(`${weekLabel || "Weekly"} Pick'em`);

    const last = [...games].sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt))[0];
    if (last?.startsAt) {
      const d = new Date(last.startsAt);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      setExpiry(local.toISOString().slice(0, 10));
    }
  }, [gameType, games, blocks, weekKey]);

  const submit = async () => {
    setError("");
    if (!name.trim()) return setError("Give it a name");
    if (gameType === "pickem" && !games.length) return setError("Pick a week that has games in it");
    if (atLimit) {
      return setError(`This space already has ${MAX_ACTIVE_POOLS} active boards.`);
    }
    const endsOn = expiry || addDaysISO(30);
    if (endsOn < todayISO()) return setError("The end date can't be in the past");

    setCreating(true);
    const result = await onCreate({
      name: name.trim(),
      expiresAt: endsOn,
      gameType,
      game: gameType === "squares" ? game : null,
      // The slate is frozen at creation so a rescheduled game can't move
      // under picks that were already made against it.
      slate:
        gameType === "pickem"
          ? {
              label: name.trim(),
              games: games.map((g) => ({
                id: g.id,
                shortName: g.shortName,
                startsAt: g.startsAt,
                away: g.away,
                home: g.home,
              })),
              tiebreakGameId: [...games].sort(
                (a, b) => new Date(b.startsAt) - new Date(a.startsAt)
              )[0]?.id,
            }
          : null,
    });
    setCreating(false);
    if (result?.error) {
      // An RLS rejection here almost always means auth.uid() was null — the
      // policy checks space membership, and a signed-out session has none.
      // Quoting Postgres at an admin doesn't help them act on it.
      const rls = /row-level security|violates row-level/i.test(result.error);
      return setError(
        rls
          ? "Couldn't create the board — your session may have expired. Sign out and back in, then try again."
          : result.error
      );
    }
    onClose();
  };

  const select = { ...inputStyle, padding: "11px 12px", fontSize: 14 };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: colors.overlay,
        zIndex: 1200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{ ...cardStyle, width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 4,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>New contest</h3>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: atLimit ? colors.accentRed : colors.textDim,
            }}
          >
            {activeCount}/{MAX_ACTIVE_POOLS} active
          </span>
        </div>
        <p style={{ color: colors.textMuted, fontSize: 13, margin: "0 0 20px" }}>
          Pick the game and everything else fills itself in — including live scores and automatic
          winners.
        </p>

        {/* Two game types share the board model, so both inherit billing,
            expiry, the picker and Past Boards. */}
        <label style={labelStyle}>Contest type</label>
        <div
          style={{
            display: "flex",
            gap: 4,
            background: colors.surface3,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.pill,
            padding: 4,
            marginBottom: 16,
          }}
        >
          {[
            { key: "squares", label: "Squares" },
            { key: "pickem", label: "Pick'em" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setGameType(t.key)}
              style={{
                flex: 1,
                padding: "9px 14px",
                borderRadius: radii.pill,
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                fontFamily: "inherit",
                background:
                  gameType === t.key
                    ? `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`
                    : "transparent",
                color: gameType === t.key ? colors.white : colors.textMuted,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label style={labelStyle}>Week</label>
        <select
          value={weekKey}
          onChange={(e) => setWeekKey(e.target.value)}
          disabled={loadingWeeks}
          style={{ ...select, marginBottom: 14 }}
        >
          {loadingWeeks && <option value="">Loading…</option>}
          {blocks.map((block) => (
            <optgroup key={block.seasonType} label={block.label}>
              {block.weeks.map((w) => (
                <option
                  key={`${block.seasonType}:${w.week}`}
                  value={`${block.seasonType}:${w.week}:${new Date(w.startDate).getFullYear()}`}
                >
                  {w.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {gameType === "squares" && <label style={labelStyle}>Game</label>}
        {gameType === "squares" && (
          <select
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            disabled={loadingGames || !games.length}
            style={{ ...select, marginBottom: 14 }}
          >
            <option value="">
              {loadingGames ? "Loading…" : games.length ? "Select a game…" : "No games this week"}
            </option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.shortName || g.name}
                {g.startsAt
                  ? ` — ${new Date(g.startsAt).toLocaleDateString([], { weekday: "short" })} ${new Date(g.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                  : ""}
              </option>
            ))}
          </select>
        )}

        {gameType === "pickem" && (
          <div
            style={{
              padding: "10px 14px",
              background: colors.surface3,
              border: `1px solid ${colors.border}`,
              borderRadius: radii.lg,
              marginBottom: 14,
              fontSize: 12,
              color: colors.textMuted,
            }}
          >
            {loadingGames
              ? "Loading the slate…"
              : games.length
                ? `All ${games.length} games this week. Picks lock at the first kickoff, and the latest game is the tiebreaker.`
                : "No games this week."}
          </div>
        )}

        <label style={labelStyle}>{gameType === "pickem" ? "Contest name" : "Board name"}</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Week 5 — PHI @ DAL"
          style={{ ...inputStyle, marginBottom: 14 }}
        />

        <label style={labelStyle}>Ends on (optional)</label>
        <input
          type="date"
          value={expiry}
          min={todayISO()}
          onChange={(e) => setExpiry(e.target.value)}
          style={inputStyle}
        />
        <p style={{ color: colors.textDim, fontSize: 11, margin: "6px 0 0" }}>
          {game
            ? "Set from game day. After this the board stops taking entries and moves to Past Boards, still viewable."
            : "Leave blank for 30 days from today."}
        </p>

        {gameType === "squares" && game && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              background: colors.surface3,
              border: `1px solid ${colors.accentGreenBright}40`,
              borderRadius: radii.lg,
              fontSize: 12,
              color: colors.textMuted,
            }}
          >
            <strong style={{ color: colors.accentGreenBright }}>Linked.</strong> Quarter winners
            fill in automatically, and Smart Fill runs five minutes before kickoff.
          </div>
        )}

        {error && (
          <p style={{ color: colors.accentRed, fontSize: 13, margin: "14px 0 0" }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button
            type="button"
            onClick={submit}
            disabled={creating || atLimit || !name.trim()}
            style={{
              ...btnPrimary,
              flex: 2,
              opacity: creating || atLimit || !name.trim() ? 0.5 : 1,
            }}
          >
            {creating ? "Creating…" : "Create board"}
          </button>
          <button type="button" onClick={onClose} style={{ ...btnSecondary, flex: 1 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
