import React, { useState, useEffect, useCallback } from "react";
import { colors, radii } from "../../styles";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { HeroBoard } from "./HeroBoard";
import { HeroTicket } from "./HeroTicket";

const SLIDES = [
  { key: "squares", label: "Squares", render: (scale) => <HeroBoard scale={scale} /> },
  { key: "pickem", label: "Pick'em", render: (scale) => <HeroTicket scale={scale} /> },
];

const INTERVAL_MS = 5200;

/**
 * Slides between the two game types, because the hero has to say "we do two
 * things" before anyone reads a word.
 *
 * Both slides are always mounted and absolutely stacked — measuring one and
 * animating height would jump, and a fixed frame keeps the layout still. The
 * rotation stops on hover and for anyone who asked for reduced motion.
 */
export function HeroCarousel({ scale = 1 }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const go = useCallback(
    (next) => setIndex(((next % SLIDES.length) + SLIDES.length) % SLIDES.length),
    []
  );

  useEffect(() => {
    if (paused || reduceMotion) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused, reduceMotion]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}
    >
      <div
        style={{
          position: "relative",
          width: 360 * scale,
          height: 320 * scale,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {SLIDES.map((slide, i) => {
          const offset = i - index;
          return (
            <div
              key={slide.key}
              aria-hidden={offset !== 0}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: offset === 0 ? 1 : 0,
                transform: `translateX(${offset * 60}px) scale(${offset === 0 ? 1 : 0.94})`,
                transition: reduceMotion
                  ? "opacity 0.2s"
                  : "opacity 0.55s ease, transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)",
                pointerEvents: offset === 0 ? "auto" : "none",
              }}
            >
              {slide.render(scale)}
            </div>
          );
        })}
      </div>

      {/* Labelled rather than plain dots — they're also telling you what the
          product does, not just where you are in a rotation. */}
      <div style={{ display: "flex", gap: 8 }}>
        {SLIDES.map((slide, i) => (
          <button
            key={slide.key}
            type="button"
            onClick={() => go(i)}
            aria-label={`Show ${slide.label}`}
            aria-current={i === index}
            style={{
              background: i === index ? colors.surface5 : "transparent",
              border: `1px solid ${i === index ? colors.accentViolet : colors.border}`,
              color: i === index ? colors.textPrimary : colors.textDim,
              borderRadius: radii.pill,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
          >
            {slide.label}
          </button>
        ))}
      </div>
    </div>
  );
}
