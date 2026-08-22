import React, { useState } from "react";
import { colors, radii, pageStyle, containerStyle, btnPrimary, btnSecondary } from "../../styles";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { normalizeCode, spaceUrlPrefix } from "../../utils";
import { BackgroundDecor } from "../layout/BackgroundDecor";
import { ThemeToggle } from "../common";
import { HeroBoard } from "./HeroBoard";

/* ── small building blocks ─────────────────────────────── */

function Section({ children, style, id }) {
  return (
    <section id={id} style={{ ...containerStyle, paddingTop: 56, paddingBottom: 56, ...style }}>
      {children}
    </section>
  );
}

function Eyebrow({ children, tone }) {
  return (
    <p
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        margin: "0 0 14px",
      }}
    >
      <span
        style={{
          background: tone || colors.accentViolet,
          color: colors.white,
          borderRadius: radii.pill,
          padding: "3px 11px",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 0.6,
        }}
      >
        {children}
      </span>
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
      <nav
        style={{
          ...containerStyle,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 18,
          paddingBottom: 18,
          gap: 12,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 16 : 34 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
              }}
            >
              🏈
            </div>
            <span
              style={{
                fontWeight: 900,
                fontSize: 17,
                letterSpacing: -0.3,
                color: colors.headline,
              }}
            >
              SQUARE<span style={{ color: colors.accentViolet }}>POOL</span>
            </span>
          </div>

          {!isMobile && (
            <div style={{ display: "flex", gap: 22 }}>
              {[
                { label: "How it works", href: "#how" },
                { label: "Features", href: "#features" },
                { label: "Pricing", href: "#pricing" },
              ].map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  style={{
                    color: colors.textMuted,
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  {l.label}
                </a>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 16 }}>
          {!isMobile && (
            <div style={{ textAlign: "right", lineHeight: 1.3 }}>
              <div style={{ color: colors.textMuted, fontSize: 12 }}>
                Squares without the clipboard
              </div>
              <div style={{ color: colors.textPrimary, fontSize: 12, fontWeight: 800 }}>
                First board free
              </div>
            </div>
          )}
          <ThemeToggle size={32} />
          <a
            href="/admin"
            style={{
              background: `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`,
              color: colors.white,
              borderRadius: radii.pill,
              padding: isMobile ? "9px 16px" : "11px 24px",
              fontSize: 14,
              fontWeight: 800,
              textDecoration: "none",
              whiteSpace: "nowrap",
              boxShadow: "var(--glow-primary)",
            }}
          >
            Get started
          </a>
          {!isMobile && (
            <a
              href="/admin"
              style={{
                color: colors.textMuted,
                fontSize: 14,
                textDecoration: "underline",
                whiteSpace: "nowrap",
              }}
            >
              Sign in
            </a>
          )}
        </div>
      </nav>

      {/* hero — copy left, the product itself right, glow bleeding from behind */}
      <div style={{ position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "-30%",
            left: "-15%",
            width: isMobile ? "140%" : "75%",
            height: "160%",
            background: `radial-gradient(ellipse at 30% 40%, ${colors.accentPurple}33 0%, transparent 62%)`,
            pointerEvents: "none",
          }}
        />

        <section
          style={{
            ...containerStyle,
            position: "relative",
            paddingTop: isMobile ? 34 : 60,
            paddingBottom: isMobile ? 60 : 96,
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.05fr 1fr",
            gap: isMobile ? 56 : 40,
            alignItems: "center",
          }}
        >
          <div>
            <p
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                color: colors.textSecondary,
                fontSize: 13,
                fontWeight: 700,
                margin: "0 0 16px",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: colors.accentGreenBright,
                  boxShadow: `0 0 10px ${colors.accentGreenBright}`,
                }}
              />
              Live scores, automatic winners
            </p>

            <h1
              style={{
                fontSize: isMobile ? 42 : 68,
                fontWeight: 900,
                lineHeight: 0.98,
                letterSpacing: isMobile ? -2 : -3.2,
                margin: "0 0 22px",
                color: colors.headline,
              }}
            >
              Run the pool.
              <br />
              Skip the
              <br />
              <span
                style={{
                  background: `linear-gradient(120deg, ${colors.accentViolet}, ${colors.accentPurple})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                paperwork.
              </span>
            </h1>

            <p
              style={{
                color: colors.textMuted,
                fontSize: isMobile ? 16 : 18,
                lineHeight: 1.65,
                margin: "0 0 30px",
                maxWidth: 440,
              }}
            >
              Build a board in a minute and share one link. Players join without an account, scores
              arrive on their own, and every quarter pays out without you doing the maths.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <a
                href="/admin"
                style={{
                  background: `linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentViolet})`,
                  color: colors.white,
                  borderRadius: radii.pill,
                  padding: "15px 32px",
                  fontSize: 15,
                  fontWeight: 800,
                  textDecoration: "none",
                  boxShadow: "var(--glow-primary)",
                }}
              >
                Create a free board
              </a>
              <button
                type="button"
                onClick={onOpenJoin}
                style={{
                  background: "transparent",
                  border: `1px solid ${colors.borderSubtle}`,
                  color: colors.textSecondary,
                  borderRadius: radii.pill,
                  padding: "15px 26px",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                I have a code
              </button>
            </div>

            <p style={{ color: colors.textDim, fontSize: 13, margin: "18px 0 0" }}>
              Free to sign up · first board free · no card required
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <HeroBoard scale={isMobile ? 0.82 : 1} />
          </div>
        </section>
      </div>

      {/* quick join */}
      <Section style={{ paddingTop: 0, paddingBottom: 56 }}>
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
      <Section id="features" style={{ paddingTop: 20 }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <Eyebrow>Features</Eyebrow>
          <h2
            style={{
              fontSize: isMobile ? 30 : 42,
              fontWeight: 900,
              letterSpacing: isMobile ? -1.2 : -1.8,
              lineHeight: 1.05,
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
          <Card icon="🗒️" title="Squares and pick'em" tone={colors.accentViolet}>
            Run a classic squares grid, or a weekly pick'em where everyone picks every game and most
            correct takes it. Same space, same link, same automatic scoring.
          </Card>
          <Card icon="💸" title="Money stays yours">
            Players pay you directly through your own Venmo or Cash App — we never touch it. A
            one-tap link fills in the amount and a reference so you can match payments at a glance.
          </Card>
        </div>
      </Section>

      {/* how it works */}
      <Section id="how">
        <div
          style={{
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.xxl,
            padding: isMobile ? 24 : 36,
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <Eyebrow tone={colors.accentGreenBright}>How it works</Eyebrow>
            <h2
              style={{
                fontSize: isMobile ? 26 : 36,
                fontWeight: 900,
                letterSpacing: -1.4,
                lineHeight: 1.05,
                margin: 0,
                color: colors.headline,
              }}
            >
              Up and running before kickoff
            </h2>
          </div>
          <div style={{ ...grid(240), gap: 22 }}>
            <Step n="1" title="Make a contest">
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
      <Section id="pricing">
        <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto" }}>
          <Eyebrow tone={colors.accentGold}>Pricing</Eyebrow>
          <h2
            style={{
              fontSize: isMobile ? 30 : 42,
              fontWeight: 900,
              letterSpacing: isMobile ? -1.2 : -1.8,
              lineHeight: 1.05,
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
