import { useState, useEffect, useCallback } from "react";
import { parseLocation } from "../utils/routes";

function readRoute() {
  const route = parseLocation(window.location.pathname, window.location.hash);
  // Rewrite legacy link shapes (#/code, /code) to /#code without a reload.
  if (route.redirectTo) {
    window.history.replaceState({}, "", route.redirectTo);
  }
  return route;
}

/** Keep the same object when nothing changed, so we don't re-render for free. */
function sameRoute(a, b) {
  return a.name === b.name && a.code === b.code;
}

/**
 * Router for the two site paths (/ and /admin) plus fragment-addressed
 * spaces (/#code). navigate() pushes history entries so back works.
 */
export function useRoute() {
  const [route, setRoute] = useState(readRoute);

  useEffect(() => {
    const sync = () => {
      const next = readRoute();
      setRoute((prev) => (sameRoute(prev, next) ? prev : next));
    };
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    const url = to.startsWith("/") ? to : `/${to}`;
    const current = `${window.location.pathname}${window.location.hash}`;
    if (current !== url) {
      if (replace) window.history.replaceState({}, "", url);
      else window.history.pushState({}, "", url);
    }
    const next = readRoute();
    setRoute((prev) => (sameRoute(prev, next) ? prev : next));
  }, []);

  return { route, navigate };
}
