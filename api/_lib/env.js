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
export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || null;
