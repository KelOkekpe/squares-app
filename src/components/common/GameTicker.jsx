import React from "react";
import { colors } from "../../styles";
import { useScoreboard } from "../../hooks/useScoreboard";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { TeamLogo } from "./TeamLogo";

/** Height of the fixed bar, exported so views can leave room for it. */
export const TICKER_HEIGHT = 34;

function Side({ team, score, winning, live }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <TeamLogo team={team} size={16} />
      <span style={{ color: colors.textSecondary, fontWeight: 700 }}>{team?.abbr || "?"}</span>
      {score != null && (
        <span
          style={{
            color: winning ? colors.textPrimary : colors.textDim,
            fontWeight: winning ? 800 : 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {score}
        </span>
      )}
      {live && winning && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: colors.accentGreenBright,
            flexShrink: 0,
          }}
        />
      )}
    </span>
  );
}

function Game({ game }) {
  const live = game.state === "in";
  const done = game.state === "post";
  const started = live || done;
  // ESPN reports 0-0 for a game that hasn't kicked off, so the scores are
  // suppressed until it has — "PIT 0 @ BUF 0" next to a kickoff time reads as
  // a scoreless game in progress.
  const a = started ? game.away?.score : null;
  const h = started ? game.home?.score : null;

  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 18px",
        borderRight: `1px solid ${colors.border}`,
        whiteSpace: "nowrap",
        fontSize: 12,
      }}
    >
      <Side team={game.away} score={a} winning={started && a > h} live={live} />
      <span style={{ color: colors.textDimmest }}>@</span>
      <Side team={game.home} score={h} winning={started && h > a} live={live} />
      <span
        style={{
          color: live ? colors.accentGreenBright : colors.textDimmest,
          fontWeight: live ? 700 : 500,
          fontSize: 11,
        }}
      >
        {game.detail}
      </span>
    </span>
  );
}

/**
 * A scrolling strip of this week's NFL games.
 *
 * The list is rendered twice inside the track and the animation moves it by
 * exactly -50%, so the second copy is in the first one's place at the moment it
 * loops. That's what makes it seamless — a single copy would visibly snap back.
 *
 * Fixed to the bottom, so views that use it add TICKER_HEIGHT of bottom padding
 * rather than having their last row quietly sit underneath it.
 */
export function GameTicker() {
  const { games } = useScoreboard();
  const isMobile = useIsMobile();

  if (!games.length) return null;

  // Long enough that reading it isn't a chore, scaled so a short slate doesn't
  // race past. Duration is on the whole doubled track.
  const seconds = Math.max(30, games.length * (isMobile ? 5 : 4));

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        height: TICKER_HEIGHT,
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        background: colors.surfacePrimary,
        borderTop: `1px solid ${colors.border}`,
        zIndex: 40,
      }}
    >
      <div
        className="sp-ticker-track"
        style={{
          display: "flex",
          alignItems: "center",
          willChange: "transform",
          animation: `sp-ticker ${seconds}s linear infinite`,
        }}
      >
        {[0, 1].map((copy) => (
          <span key={copy} style={{ display: "flex", alignItems: "center" }}>
            {games.map((g) => (
              <Game key={`${copy}-${g.id}`} game={g} />
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
