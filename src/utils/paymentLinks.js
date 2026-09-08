/**
 * Prefilled deep links to the organiser's own payment app.
 *
 * The money never touches this platform — the link opens Venmo or Cash App
 * with the recipient, amount and note already filled in, and the payment
 * happens between two people inside that app. We only remove the typing.
 *
 * That distinction is deliberate: processing entry fees ourselves would make
 * this the rail carrying wagers into a game of chance, which is a materially
 * different legal and processor posture. See CLAUDE.md.
 */

export const PAYMENT_PROVIDERS = [
  {
    key: "venmo",
    label: "Venmo",
    placeholder: "@your-handle",
    hint: "Your Venmo username",
    supportsNote: true,
  },
  {
    key: "cashapp",
    label: "Cash App",
    placeholder: "$yourcashtag",
    hint: "Your $cashtag",
    supportsNote: false,
  },
  {
    key: "paypal",
    label: "PayPal",
    placeholder: "paypal.me/you",
    hint: "Your PayPal.Me link",
    supportsNote: false,
  },
  {
    key: "zelle",
    label: "Zelle",
    placeholder: "email or phone",
    hint: "Zelle has no shared link format — players copy this",
    supportsNote: false,
    linkable: false,
  },
];

/** Unambiguous characters only — this gets read aloud and retyped. */
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePaymentRef() {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }
  return out;
}

const clean = (handle) => String(handle || "").trim();

/**
 * A tappable URL for this provider, or null when the provider has no link
 * format (Zelle) or no handle is configured.
 */
export function buildPaymentLink(provider, handle, amount, note) {
  const raw = clean(handle);
  if (!raw) return null;

  const amt = Number(amount) > 0 ? Number(amount).toFixed(2) : null;

  switch (provider) {
    case "venmo": {
      const user = raw.replace(/^@/, "").replace(/^https?:\/\/(www\.)?venmo\.com\//, "");
      const params = new URLSearchParams({ txn: "pay", audience: "private", recipients: user });
      if (amt) params.set("amount", amt);
      if (note) params.set("note", note);
      return `https://venmo.com/?${params.toString()}`;
    }
    case "cashapp": {
      // Cash App's link format carries no note field
      const tag = raw.replace(/^\$/, "").replace(/^https?:\/\/(www\.)?cash\.app\/\$?/, "");
      return amt ? `https://cash.app/$${tag}/${amt}` : `https://cash.app/$${tag}`;
    }
    case "paypal": {
      const user = raw
        .replace(/^https?:\/\/(www\.)?paypal\.me\//i, "")
        .replace(/^paypal\.me\//i, "")
        .replace(/^@/, "");
      return amt ? `https://paypal.me/${user}/${amt}` : `https://paypal.me/${user}`;
    }
    default:
      return null; // Zelle and anything unrecognised
  }
}

/** The note a player sends with payment, so an admin can reconcile it. */
export function buildPaymentNote({ playerName, poolName, ref }) {
  // Plain hyphen: an em-dash survives the URL fine but reads as noise once a
  // payment app renders it back.
  return [poolName || "Squares", playerName, ref && `Ref ${ref}`].filter(Boolean).join(" - ");
}

/**
 * The memo a squares buyer puts on their payment: "John Jones - 5 squares".
 *
 * Replaces a generated reference code. The code was unambiguous but meant
 * nothing to either party — an organiser reading their Venmo feed had to come
 * back to the app to find out who K7M2QX was, whereas a name and a count can be
 * matched against the pending list at a glance.
 *
 * Kept separate from buildPaymentNote rather than replacing it, because
 * pick'em still uses the reference form.
 */
export function buildSquaresNote({ playerName, squares }) {
  const name = String(playerName || "").trim();
  const n = Number(squares);
  if (!name) return "";
  if (!Number.isFinite(n) || n < 1) return name;
  // Plain hyphen, for the same reason the other builder uses one: an em-dash
  // survives the URL and then reads as noise in the payment app.
  return `${name} - ${n} ${n === 1 ? "square" : "squares"}`;
}

/** Providers this space has actually configured, in display order. */
export function configuredProviders(handles = {}) {
  return PAYMENT_PROVIDERS.filter((p) => clean(handles[p.key]));
}
