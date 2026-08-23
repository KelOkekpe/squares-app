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
