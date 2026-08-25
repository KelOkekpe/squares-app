import Stripe from "stripe";
import { requireEnv, BOARD_PRICE_CENTS, STRIPE_PRICE_ID, stripeMode } from "./_lib/env.js";
import { requireSpaceAdmin } from "./_lib/supabaseAdmin.js";

/**
 * Creates a Stripe Checkout Session for one board.
 *
 * The price is never taken from the request — a client that could name its own
 * amount could name zero. The board id is carried in session metadata so the
 * webhook knows what to unlock without trusting a later client call.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { spaceCode, poolId, returnTo } = req.body || {};
    if (!spaceCode || !poolId) {
      return res.status(400).json({ error: "spaceCode and poolId are required" });
    }

    const auth = await requireSpaceAdmin(req, spaceCode);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { supabase, user } = auth;

    // Confirm the board exists in this space and still needs paying for.
    const { data: pool, error: poolError } = await supabase
      .from("pools")
      .select("id, name, paid, space_code")
      .eq("id", poolId)
      .eq("space_code", spaceCode)
      .maybeSingle();

    if (poolError || !pool) return res.status(404).json({ error: "No such board" });
    if (pool.paid) return res.status(409).json({ error: "This board is already active" });

    const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
    // Recorded on every session so the logs answer "which mode was this
    // deployment in" without anyone having to recall what they pasted into
    // Vercel. A board that took a real payment and never activated is almost
    // always this.
    console.log(`checkout: creating session in Stripe ${stripeMode()} mode for pool ${poolId}`);
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const back = returnTo || `${origin}/admin`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        STRIPE_PRICE_ID
          ? { price: STRIPE_PRICE_ID, quantity: 1 }
          : {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: BOARD_PRICE_CENTS,
                product_data: {
                  name: `Squares board — ${pool.name}`,
                  description: `Activates "${pool.name}" in /${spaceCode} so players can join.`,
                },
              },
            },
      ],
      // The webhook trusts only this. Never a value posted back by the browser.
      metadata: { poolId: pool.id, spaceCode, userId: user.id },
      success_url: `${back}?board=paid`,
      cancel_url: `${back}?board=cancelled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("checkout error:", err);

    // Only an authenticated space admin reaches this point, and a swallowed
    // "Could not start checkout" makes a misconfigured deploy indistinguishable
    // from a Stripe outage. Surface the two causes that are actually
    // actionable; neither leaks a secret.
    if (/Missing required environment variable/.test(err?.message || "")) {
      return res.status(500).json({
        error: `Payments are not configured on the server — ${err.message}`,
        code: "not_configured",
      });
    }
    if (err?.type && String(err.type).startsWith("Stripe")) {
      // Stripe redacts the key in its own messages
      return res.status(500).json({
        error: `Stripe rejected the request: ${err.message}`,
        code: err.code || err.type,
      });
    }
    return res.status(500).json({ error: "Could not start checkout", code: "unknown" });
  }
}
