import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "sqrbet-theme";

function currentTheme() {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function storedPreference() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

/**
 * Light/dark theme.
 *
 * The initial value is resolved by an inline script in index.html so the page
 * never flashes the wrong theme — this hook reads what that script decided
 * rather than deciding again. Until the user picks explicitly, the OS
 * preference wins and keeps winning if it changes.
 */
export function useTheme() {
  const [theme, setThemeState] = useState(currentTheme);

  const apply = useCallback((next) => {
    document.documentElement.setAttribute("data-theme", next);
    setThemeState(next);
  }, []);

  const setTheme = useCallback(
    (next) => {
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {}
      apply(next);
    },
    [apply]
  );

  const toggle = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  // Follow the OS only while the user hasn't chosen for themselves
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e) => {
      if (storedPreference()) return;
      apply(e.matches ? "light" : "dark");
    };
    if (mql.addEventListener) {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [apply]);

  return { theme, isLight: theme === "light", setTheme, toggle };
}
