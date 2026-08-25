/**
 * Facts the legal pages state about who runs SquarePool.
 *
 * Single-sourced deliberately. An operator name or governing state that
 * disagrees between the Terms and the Privacy Policy is the kind of error that
 * undermines both documents, and they are long enough that a find-and-replace
 * would miss one.
 */

/** Inbound support address. Forwarded — see docs/EMAIL.md for the DNS records. */
export const SUPPORT_EMAIL = "support@squarepool.app";

/**
 * The entity users are contracting with.
 *
 * Left as a marked placeholder until the LLC name and formation state are
 * filled in. check:legal fails if either still reads PLACEHOLDER while the
 * pages are reachable in a production build, so this cannot ship unset.
 */
export const OPERATOR_NAME = "PLACEHOLDER_LLC_NAME";
export const OPERATOR_STATE = "PLACEHOLDER_STATE";

/** Shown at the top of both documents. Bump when the terms materially change. */
export const LEGAL_UPDATED = "August 25, 2026";

/** True once the operator details are real, used to gate the production check. */
export const legalDetailsSet = () =>
  !OPERATOR_NAME.startsWith("PLACEHOLDER") && !OPERATOR_STATE.startsWith("PLACEHOLDER");
