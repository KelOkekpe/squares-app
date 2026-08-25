/**
 * Server-only configuration.
 *
 * None of these may ever carry a VITE_ prefix — Vite inlines those into the
 * client bundle, and SUPABASE_SERVICE_ROLE_KEY bypasses every RLS policy.
 */
export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const BOARD_PRICE_CENTS = Number(process.env.BOARD_PRICE_CENTS || 1200);

/**
 * Which Stripe mode the deployed key belongs to, from its prefix.
 *
 * Worth knowing at a glance: a mode switch touches three separate settings —
 * the secret key, the webhook endpoint and its signing secret — and getting one
 * of them wrong produces a payment that succeeds while the board it paid for
 * never activates. Logged on both paths so the answer is in the function logs
 * rather than in someone's memory of what they pasted.
 */
export function stripeMode(key = process.env.STRIPE_SECRET_KEY || "") {
  if (/^(sk|rk)_live_/.test(key)) return "live";
  if (/^(sk|rk)_test_/.test(key)) return "test";
  return "unknown";
}

/**
 * A Stripe price ID, or null to price the line item inline.
 *
 * Only accepted when it actually looks like a price ID. Setting this to an
 * amount ("1200") is an easy mistake, and Stripe's rejection of it happens at
 * checkout — the worst moment to discover a configuration error. Falling back
 * to BOARD_PRICE_CENTS keeps checkout working either way.
 */
const rawPriceId = (process.env.STRIPE_PRICE_ID || "").trim();
export const STRIPE_PRICE_ID = /^price_[A-Za-z0-9]+$/.test(rawPriceId) ? rawPriceId : null;

if (rawPriceId && !STRIPE_PRICE_ID) {
  console.warn(
    `STRIPE_PRICE_ID="${rawPriceId}" is not a Stripe price ID (expected price_...). ` +
      `Ignoring it and charging BOARD_PRICE_CENTS=${BOARD_PRICE_CENTS} instead.`
  );
}
