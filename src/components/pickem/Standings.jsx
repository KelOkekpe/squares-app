import React, { useState } from "react";
import { colors, radii, cardStyle } from "../../styles";
import { rankEntries, tiebreakGame, gradedCount, isSlateLocked } from "../../utils";
import { TeamLogo } from "../common";
import { myEntryId } from "../../utils";

/**
 * One player's sheet, revealed under their standings row.
 *
 * Shows every game in slate order rather than only the graded ones, so an
 * expanded sheet doesn't reshuffle as the week goes on.
 */
function PicksBreakdown({ entry, slate }) {
  const games = slate?.games || [];

  return (
    <div
      style={{
        display: "grid",
        gap: 4,
        padding: "10px 14px 12px",
        borderTop: `1px solid ${colors.border}`,
      }}
    >
      {games.map((game) => {
        const pick = entry.picks?.[game.id];
        const picked = pick === "away" ? game.away : pick === "home" ? game.home : null;
        // A tie grades neither side, so it's settled without being right or wrong.
        const decided = game.winner && game.winner !== "tie";
        const correct = decided && pick === game.winner;
        const wrong = decided && pick && pick !== game.winner;

        return (
          <div
            key={game.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              padding: "5px 8px",
              borderRadius: radii.sm,
              background: correct ? colors.pickWinBg : wrong ? colors.pickLossBg : "transparent",
            }}
          >
            <span
              style={{
                width: 14,
                flexShrink: 0,
                fontWeight: 900,
                color: correct
                  ? colors.accentGreenBright
                  : wrong
                    ? colors.accentRed
                    : colors.textDimmest,
              }}
            >
              {correct ? "✓" : wrong ? "✕" : "·"}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                flex: 1,
                minWidth: 0,
                color: colors.textDim,
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              <TeamLogo team={game.away} size={15} />
              {game.away?.abbr || "?"}
              <span style={{ color: colors.textDimmest }}>@</span>
              <TeamLogo team={game.home} size={15} />
              {game.home?.abbr || "?"}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                flexShrink: 0,
                fontWeight: 700,
                color: picked ? colors.textPrimary : colors.textDimmest,
              }}
            >
              {picked ? (
                <>
                  <TeamLogo team={picked} size={15} />
                  {picked.abbr || picked.name}
                </>
              ) : (
                "no pick"
              )}
            </span>
            {game.winner === "tie" && (
              <span style={{ color: colors.textDimmest, fontSize: 10, flexShrink: 0 }}>TIE</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Standings, live as games finish. Only graded games count, so the table is
 * meaningful mid-week rather than blank until Monday night.
 *
 * Rows open to show that player's sheet, but only once the slate has locked.
 * Before kickoff a visible sheet is a sheet to copy, so the disclosure is tied
 * to the same instant that picks stop being editable.
 */
export function Standings({ slate, entries, poolId, requiresPayment = false }) {
  const [expanded, setExpanded] = useState(() => new Set());
  // A contest that charges only counts sheets an admin has confirmed. The
  // picks are recorded either way — that has to happen before kickoff — but
  // appearing to lead a contest you have not paid for is the thing this
  // prevents. A free contest confirms nothing, so everyone counts.
  const all = entries || [];
  const counted = requiresPayment ? all.filter((e) => e.paid) : all;
  const rows = rankEntries(counted, slate);

  // Only whether *your* sheet is waiting. How many others haven't paid is the
  // admin's business — showing it to everyone put a running tally of other
  // people's payment status in front of the whole pool.
  const mine = myEntryId(poolId);
  const yoursAwaiting = requiresPayment && mine ? all.some((e) => e.id === mine && !e.paid) : false;
  const graded = gradedCount(slate);
  const total = slate?.games?.length || 0;
  const tb = tiebreakGame(slate);
  const tbSettled = typeof tb?.total === "number";
  const revealed = isSlateLocked(slate);

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (!rows.length) {
    return (
      <div style={{ ...cardStyle, textAlign: "center" }}>
        <p style={{ color: colors.textMuted, fontSize: 14, margin: 0 }}>
          {yoursAwaiting
            ? "Your sheet is in — it joins the standings once your admin confirms your entry fee."
            : "No picks submitted yet."}
        </p>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800 }}>Standings</h3>
        <span style={{ color: colors.textDim, fontSize: 12 }}>
          {graded}/{total} games final
        </span>
      </div>
      <p style={{ color: colors.textMuted, fontSize: 12, margin: "0 0 8px" }}>
        {tbSettled
          ? `Tiebreaker settled — ${tb.shortName} totalled ${tb.total}.`
          : `Ties break on ${tb?.shortName || "the final game"}: closest total without going over.`}
      </p>
      {yoursAwaiting && (
        <p style={{ color: colors.accentOrange, fontSize: 12, margin: "0 0 6px" }}>
          Your sheet isn't counted yet — waiting on your admin to confirm your entry fee.
        </p>
      )}
      <p style={{ color: colors.textDim, fontSize: 11, margin: "0 0 16px" }}>
        {revealed
          ? "Picks are locked — tap anyone to see their sheet."
          : "Everyone's picks stay hidden until the first kickoff."}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((row) => {
          const leading = row.rank === 1 && graded > 0;
          const open = expanded.has(row.entry.id);

          return (
            <div
              key={row.entry.id}
              style={{
                background: leading ? "#ffd7000f" : colors.surface2,
                border: `1px solid ${leading ? colors.borderGold : colors.border}`,
                borderRadius: radii.lg,
                overflow: "hidden",
              }}
            >
              <div
                onClick={revealed ? () => toggle(row.entry.id) : undefined}
                onKeyDown={
                  revealed
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggle(row.entry.id);
                        }
                      }
                    : undefined
                }
                role={revealed ? "button" : undefined}
                tabIndex={revealed ? 0 : undefined}
                aria-expanded={revealed ? open : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 14px",
                  cursor: revealed ? "pointer" : "default",
                }}
              >
                <span
                  style={{
                    width: 26,
                    flexShrink: 0,
                    fontWeight: 900,
                    fontSize: 14,
                    color: leading ? colors.accentGold : colors.textDim,
                  }}
                >
                  {row.rank}
                </span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.textPrimary,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {row.entry.name}
                  {row.busted && (
                    <span
                      style={{
                        color: colors.accentRed,
                        fontSize: 10,
                        marginLeft: 8,
                        fontWeight: 800,
                      }}
                    >
                      OVER
                    </span>
                  )}
                </span>
                <span style={{ color: colors.textDim, fontSize: 11, flexShrink: 0 }}>
                  TB {row.guess ?? "—"}
                  {row.distance !== null && !row.busted ? ` (−${row.distance})` : ""}
                </span>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 15,
                    color: leading ? colors.accentGold : colors.textPrimary,
                    flexShrink: 0,
                  }}
                >
                  {row.correct}
                </span>
                {revealed && (
                  <span
                    style={{
                      flexShrink: 0,
                      color: colors.textDimmest,
                      fontSize: 10,
                      transform: open ? "rotate(180deg)" : "none",
                      transition: "transform 0.2s",
                    }}
                  >
                    ▼
                  </span>
                )}
              </div>

              {revealed && open && <PicksBreakdown entry={row.entry} slate={slate} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
