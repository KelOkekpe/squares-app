/**
 * Darken a hex colour by a given ratio (0–1).
 * darken("#ff0000", 0.5) → a colour 50 % darker.
 */
export function darken(hex, amount = 0.35) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.floor(((num >> 16) & 0xff) * (1 - amount)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0xff) * (1 - amount)));
  const b = Math.max(0, Math.floor((num & 0xff) * (1 - amount)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** sRGB relative luminance (WCAG), 0 = black, 1 = white. */
export function luminance(hex) {
  const num = parseInt(String(hex).replace("#", "").slice(0, 6), 16);
  const channel = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const r = channel((num >> 16) & 0xff);
  const g = channel((num >> 8) & 0xff);
  const b = channel(num & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two hex colours, 1 (identical) to 21 (black/white). */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Whichever candidate stands out most against `background`.
 *
 * The grid used to paint its axis numbers in the team's background colour,
 * which works while that colour is dark and disappears entirely once it's
 * white. Choosing by contrast keeps the existing look for dark team colours
 * and stays legible for light ones.
 */
export function bestContrast(candidates, background) {
  const usable = candidates.filter(Boolean);
  if (!usable.length) return background;
  return usable.reduce((best, c) =>
    contrastRatio(c, background) > contrastRatio(best, background) ? c : best
  );
}

/**
 * The colour for a board's axis digits.
 *
 * The gutter keeps its own background — the team's colour, darkened — so the
 * digits have to work against whatever that turns out to be. A dark team
 * colour used to leave near-black digits on a near-black gutter, and a white
 * one left black digits on mid grey.
 *
 * The team's own colour is kept when it is light enough to read against the
 * gutter, so a board keeps its identity; otherwise the digits go light. Only
 * light candidates are considered — a technically-contrasting dark digit is
 * what made this unreadable in the first place.
 *
 * Exported rather than inlined so the theme check tests the rule that actually
 * ships; duplicating it there let a broken threshold pass unnoticed.
 */
export const MIN_DIGIT_CONTRAST = 3; // large, bold digits — WCAG large-text
export const MIN_DIGIT_LUMINANCE = 0.35;

export function axisDigitColor({ candidates, background, fallback }) {
  const legible = (candidates || [])
    .filter(Boolean)
    .filter(
      (c) =>
        luminance(c) >= MIN_DIGIT_LUMINANCE && contrastRatio(c, background) >= MIN_DIGIT_CONTRAST
    );
  return legible.length ? bestContrast(legible, background) : fallback;
}
