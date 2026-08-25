import Stripe from "stripe";
import { requireEnv, stripeMode } from "./_lib/env.js";
import { adminClient } from "./_lib/supabaseAdmin.js";

// Stripe signs the exact bytes it sent, so the body must not be parsed before
// verification. Without this the signature check fails on every request.
export const config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

/**
 * Marks a board paid once Stripe confirms the payment.
 *
 * This endpoint is public, so the signature check is the only thing standing
 * between it and anyone who wants free boards — it runs before anything else,
 * and nothing from the request body is trusted until it passes.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end();
  }

  const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"));

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      await rawBody(req),
      req.headers["stripe-signature"],
      requireEnv("STRIPE_WEBHOOK_SECRET")
    );
  } catch (err) {
    console.error("webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // The signature only proves the event came from the endpoint whose secret we
  // hold. It says nothing about whether that endpoint matches the key we use
  // everywhere else — and a live event processed by a test-mode deployment (or
  // the reverse) would mark a board paid against a payment that doesn't exist
  // in the mode the app is actually running in. Refused loudly rather than
  // silently, so it shows up red in Stripe's webhook attempts.
  const mode = stripeMode();
  if (mode !== "unknown" && event.livemode !== (mode === "live")) {
    console.error(
      `Stripe mode mismatch: ${mode}-mode key received a ${event.livemode ? "live" : "test"} event. ` +
        `STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are from different modes.`
    );
    return res.status(400).send("Stripe mode mismatch between secret key and webhook endpoint");
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true, ignored: event.type });
  }

  const session = event.data.object;
  const { poolId, spaceCode } = session.metadata || {};

  if (!poolId || !spaceCode) {
    console.error("checkout.session.completed without pool metadata", session.id);
    return res.status(200).json({ received: true, skipped: "no metadata" });
  }
  if (session.payment_status !== "paid") {
    return res.status(200).json({ received: true, skipped: session.payment_status });
  }

  try {
    const supabase = adminClient();

    // Stripe retries on any non-2xx, so this has to be safe to run twice.
    // checkout_session_id is uniquely indexed, and the paid filter means a
    // replay updates nothing rather than double-applying.
    const { error } = await supabase
      .from("pools")
      .update({
        paid: true,
        paid_at: new Date().toISOString(),
        checkout_session_id: session.id,
      })
      .eq("id", poolId)
      .eq("space_code", spaceCode)
      .eq("paid", false);

    if (error) throw error;

    console.log(`board ${poolId} in ${spaceCode} activated by session ${session.id}`);
    return res.status(200).json({ received: true });
  } catch (err) {
    // Returning 500 asks Stripe to retry, which is what we want if the write
    // failed — the customer has paid and the board must end up active.
    console.error("failed to activate board:", err);
    return res.status(500).json({ error: "activation failed" });
  }
}
