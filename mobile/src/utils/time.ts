// ─── Time Utilities ──────────────────────────────────────────
// Provides a relative time formatter ("Just now", "5m ago", etc.)
// and a compact date formatter for the UI.

/**
 * Returns the current local date as a "YYYY-MM-DD" string.
 * Use this instead of `new Date().toISOString().split('T')[0]`,
 * which always returns the UTC date and causes streak/goal
 * mismatches for users in non-UTC timezones (e.g. IST = UTC+5:30).
 */
export function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts an ISO date string into a human-readable relative time.
 * Examples: "Just now", "5m ago", "2h ago", "Yesterday", "Mar 28"
 */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Compact date+time string for logs: "Mar 28, 2:30 PM"
 */
export function formatCompactDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
