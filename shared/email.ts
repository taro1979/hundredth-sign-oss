/**
 * Email normalization utilities for Hundredth Sign.
 *
 * Handles Gmail-style aliases (`+` suffix), Gmail dot-insensitivity,
 * and case-insensitive comparison so that ownership checks succeed
 * even when the stored email differs only by alias or dots.
 *
 * IMPORTANT: These utilities are for *comparison* purposes only.
 * The original email address should be preserved in the database
 * for display and delivery.
 */

/** Domains where dots in the local part are ignored. */
const DOT_INSENSITIVE_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
]);

/**
 * Normalize an email address for comparison purposes.
 *
 * 1. Lower-case the entire address.
 * 2. Strip the `+…` alias portion from the local part.
 * 3. For Gmail / Googlemail, also remove all dots from the local part.
 *
 * Returns the normalized string, or `null` if the input is falsy / invalid.
 */
export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;

  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return null;

  let local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  // Strip +alias portion
  const plusIndex = local.indexOf("+");
  if (plusIndex >= 0) {
    local = local.slice(0, plusIndex);
  }

  // Remove dots for dot-insensitive providers
  if (DOT_INSENSITIVE_DOMAINS.has(domain)) {
    local = local.replace(/\./g, "");
  }

  if (!local) return null;

  return `${local}@${domain}`;
}

/**
 * Compare two email addresses after normalization.
 * Returns `true` when both addresses resolve to the same canonical mailbox.
 */
export function emailsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeEmail(a);
  const nb = normalizeEmail(b);
  if (!na || !nb) return false;
  return na === nb;
}
