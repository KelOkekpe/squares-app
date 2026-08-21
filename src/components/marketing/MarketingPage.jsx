import React, { useState } from "react";
import { colors, radii, pageStyle, containerStyle, btnPrimary, btnSecondary } from "../../styles";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { normalizeCode, spaceUrlPrefix } from "../../utils";
import { BackgroundDecor } from "../layout/BackgroundDecor";
import { ThemeToggle } from "../common";

/* ── small building blocks ─────────────────────────────── */

function Section({ children, style }) {
  return (
    <section style={{ ...containerStyle, paddingTop: 56, paddingBottom: 56, ...style }}>
      {children}
    </section>
  );
}

function Eyebrow({ children }) {
  return (
    <p
      style={{
        color: colors.accentViolet,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 2,
        textTransform: "uppercase",
        margin: "0 0 12px",
      }}
    >
      {children}
    </p>
  );
}

function Card({ icon, title, children, tone }) {
  return (
    <div
      style={{
        background: colors.surface3,
        border: `1px solid ${tone ? `${tone}40` : colors.border}`,
        borderRadius: radii.xl,
        padding: 22,
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
      <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: colors.textPrimary }}>
        {title}
      </h3>
      <p style={{ margin: 0, color: colors.textMuted, fontSize: 14, lineHeight: 1.6 }}>
        {children}
      </p>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div
        style={{
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`,
          color: colors.white,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 13,
        }}
      >
        {n}
      </div>
      <div>
        <h4
          style={{ margin: "4px 0 4px", fontSize: 15, fontWeight: 700, color: colors.textPrimary }}
        >
          {title}
        </h4>
        <p style={{ margin: 0, color: colors.textMuted, fontSize: 14, lineHeight: 1.6 }}>
          {children}
        </p>
      </div>
    </div>
  );
}

/* ── page ──────────────────────────────────────────────── */

export function MarketingPage({ onEnterSpace, onOpenJoin }) {
  const isMobile = useIsMobile();
  const [code, setCode] = useState("");

  const grid = (min) => ({
    display: "grid",
    gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
    gap: 14,
  });

  const enter = () => {
    const clean = normalizeCode(code);
    if (clean) onEnterSpace(clean);
  };

  return (
    <div style={pageStyle}>
      <BackgroundDecor />

      {/* nav */}
      <div
        style={{
          ...containerStyle,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 20,
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 17,
            }}
          >
            🏈
          </div>
          <span style={{ fontWeight: 800, fontSize: 17, color: colors.headline }}>
            SQUARE<span style={{ color: colors.accentViolet }}>POOL</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ThemeToggle size={32} />
          <a
            href="/admin"
            style={{ ...btnSecondary, padding: "8px 16px", fontSize: 13, textDecoration: "none" }}
          >
            Sign in
          </a>
        </div>
      </div>

      {/* hero */}
      <Section style={{ paddingTop: isMobile ? 40 : 64, paddingBottom: 40, textAlign: "center" }}>
        <h1
          style={{
            fontSize: isMobile ? 38 : 60,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: isMobile ? -1.5 : -2.5,
            margin: "0 auto 18px",
            maxWidth: 780,
            color: colors.headline,
          }}
        >
          Football squares,{" "}
          <span
            style={{
              background: `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            without the clipboard
          </span>
        </h1>
        <p
          style={{
            color: colors.textMuted,
            fontSize: isMobile ? 16 : 19,
            lineHeight: 1.6,
            margin: "0 auto 30px",
            maxWidth: 600,
          }}
        >
          Set up a board in a minute, share one link, and let it run itself. Scores arrive on their
          own, winners are worked out for you, and nobody has to squint at a photo of a paper grid.
        </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <a href="/admin" style={{ ...btnPrimary, padding: "14px 30px", textDecoration: "none" }}>
            Start free — first board's on us
          </a>
          <button
            type="button"
            onClick={onOpenJoin}
            style={{ ...btnSecondary, padding: "14px 26px" }}
          >
            I have a code
          </button>
        </div>
        <p style={{ color: colors.textDim, fontSize: 13, margin: 0 }}>
          Free to sign up · no card to start · players never make an account
        </p>
      </Section>

      {/* quick join */}
      <Section style={{ paddingTop: 0, paddingBottom: 48 }}>
        <div
          style={{
            maxWidth: 480,
            margin: "0 auto",
            background: colors.surface3,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.xl,
            padding: 20,
          }}
        >
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 13,
              color: colors.textMuted,
              textAlign: "center",
            }}
          >
            Someone sent you a code? Jump straight in.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: colors.textDim, fontSize: 14, flexShrink: 0 }}>
              {spaceUrlPrefix()}
            </span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enter()}
              placeholder="enter-space-code"
              style={{
                flex: "1 1 140px",
                minWidth: 0,
                background: colors.surfaceInput,
                border: `1px solid ${colors.borderInput}`,
                color: colors.textPrimary,
                padding: "11px 14px",
                borderRadius: radii.lg,
                fontSize: 15,
                fontWeight: 600,
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={enter}
              style={{ ...btnSecondary, padding: "11px 20px", flexShrink: 0 }}
            >
              Go
            </button>
          </div>
        </div>
      </Section>

      {/* the pitch */}
      <Section style={{ paddingTop: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <Eyebrow>Why organisers switch</Eyebrow>
          <h2
            style={{
              fontSize: isMobile ? 26 : 34,
              fontWeight: 900,
              letterSpacing: -1,
              margin: 0,
              color: colors.headline,
            }}
          >
            The tedious parts, handled
          </h2>
        </div>

        <div style={grid(230)}>
          <Card icon="📋" title="Retire the paper grid">
            No more chasing people for names, redrawing squares, or working out who won at 1am.
            Everything lives in one place that everyone can see.
          </Card>
          <Card icon="⚡" title="Players just play">
            No account, no download, no password. They tap your link, pick a number of squares, and
            they're in. That's the whole flow.
          </Card>
          <Card icon="🎛️" title="You stay in control">
            Approve every entry before squares are handed out, set your own price and payouts, run
            several boards at once, and bring in co-admins.
          </Card>
          <Card icon="📡" title="Scores land on their own" tone={colors.accentGreenBright}>
            Link a board to the real game and quarter winners fill themselves in. Only finished
            quarters count, so a lead mid-drive never decides a payout.
          </Card>
          <Card icon="🎯" title="Someone always wins" tone={colors.accentGold}>
            Board didn't fill? Smart Fill shares the leftovers among everyone who bought in,
            proportional to what they paid, and scales the payout to the money actually collected.
            No dead squares, no refunds.
          </Card>
          <Card icon="💸" title="Money stays yours">
            Players pay you directly through your own Venmo or Cash App — we never touch it. A
            one-tap link fills in the amount and a reference so you can match payments at a glance.
          </Card>
        </div>
      </Section>

      {/* how it works */}
      <Section>
        <div
          style={{
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.xxl,
            padding: isMobile ? 24 : 36,
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <Eyebrow>How it works</Eyebrow>
            <h2
              style={{
                fontSize: isMobile ? 24 : 30,
                fontWeight: 900,
                letterSpacing: -0.8,
                margin: 0,
                color: colors.headline,
              }}
            >
              Up and running before kickoff
            </h2>
          </div>
          <div style={{ ...grid(240), gap: 22 }}>
            <Step n="1" title="Make a board">
              Sign up free, name your space, set your price per square and what you're paying out
              each quarter.
            </Step>
            <Step n="2" title="Share one link">
              Send it to your group. They enter a name, choose how many squares, and pay you however
              you already get paid.
            </Step>
            <Step n="3" title="Approve and forget">
              Confirm the money landed and squares are assigned at random. From there the board
              keeps itself up to date.
            </Step>
          </div>
        </div>
      </Section>

      {/* pricing */}
      <Section>
        <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto" }}>
          <Eyebrow>Pricing</Eyebrow>
          <h2
            style={{
              fontSize: isMobile ? 26 : 34,
              fontWeight: 900,
              letterSpacing: -1,
              margin: "0 0 14px",
              color: colors.headline,
            }}
          >
            Your first board is free
          </h2>
          <p style={{ color: colors.textMuted, fontSize: 16, lineHeight: 1.7, margin: "0 0 24px" }}>
            Signing up costs nothing and your first board costs nothing — run a whole game before
            you decide. After that it's a flat one-time fee per board.{" "}
            <strong style={{ color: colors.textSecondary }}>Never a percentage of your pot.</strong>{" "}
            What your players put in is between you and them.
          </p>
          <a href="/admin" style={{ ...btnPrimary, padding: "14px 30px", textDecoration: "none" }}>
            Create your first board
          </a>
        </div>
      </Section>

      {/* footer */}
      <footer
        style={{
          ...containerStyle,
          borderTop: `1px solid ${colors.border}`,
          paddingTop: 22,
          paddingBottom: 40,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ color: colors.textDim, fontSize: 12 }}>
          SquarePool · squares pools, minus the admin
        </span>
        <span style={{ display: "flex", gap: 16 }}>
          <a href="/join" style={{ color: colors.textMuted, fontSize: 12, textDecoration: "none" }}>
            Join a board
          </a>
          <a
            href="/admin"
            style={{ color: colors.textMuted, fontSize: 12, textDecoration: "none" }}
          >
            Organiser sign in
          </a>
        </span>
      </footer>
    </div>
  );
}
