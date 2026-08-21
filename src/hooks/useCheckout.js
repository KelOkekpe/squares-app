import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { withTimeout } from "../utils/async";

/**
 * Starts Stripe Checkout for a board.
 *
 * The session is created server-side — the browser never names a price, and
 * the board it unlocks is carried in Stripe metadata rather than posted back
 * afterwards by the client.
 */
export function useCheckout() {
  const [startingFor, setStartingFor] = useState(null);
  const [error, setError] = useState("");

  const startCheckout = useCallback(async (spaceCode, poolId) => {
    setError("");
    setStartingFor(poolId);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in again");

      const response = await withTimeout(
        fetch("/api/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            spaceCode,
            poolId,
            returnTo: `${window.location.origin}/admin`,
          }),
        }),
        15000,
        "checkout"
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.url) {
        throw new Error(payload.error || "Could not start checkout");
      }

      window.location.href = payload.url;
      return { ok: true };
    } catch (err) {
      const message = err?.message || "Could not start checkout";
      setError(message);
      setStartingFor(null);
      return { ok: false, error: message };
    }
  }, []);

  return { startCheckout, startingFor, error, setError };
}
