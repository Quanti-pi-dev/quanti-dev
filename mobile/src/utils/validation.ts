// ─── Validation Utilities ─────────────────────────────────────
// Fix 27: shared validation helpers to replace ad-hoc inline checks

/**
 * Returns true if the email string is a structurally valid email address.
 * More robust than a simple `.includes('@')` check.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Returns true if the password meets the minimum length requirement.
 */
export function isValidPassword(password: string, minLength = 8): boolean {
  return password.length >= minLength;
}
