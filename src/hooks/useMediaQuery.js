import { useState, useEffect } from "react";

/**
 * Reactive matchMedia.
 *
 * The app styles everything inline, and inline styles beat stylesheet rules —
 * so CSS media queries can't reach them. Breakpoints have to be resolved in JS
 * and branched in the style objects instead.
 */
export function useMediaQuery(query) {
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [matches, setMatches] = useState(() =>
    supported ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    if (!supported) return undefined;
    const mql = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);

    setMatches(mql.matches);

    // addListener is the pre-Safari-14 spelling
    if (mql.addEventListener) {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [query, supported]);

  return matches;
}

export const MOBILE_BREAKPOINT = 640;

/** True on phone-width screens. */
export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT}px)`);
}
