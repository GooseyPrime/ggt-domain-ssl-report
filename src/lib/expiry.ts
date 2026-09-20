/** Expiry warning helpers. WARN if days left ≤ 30 (includes already expired). */

export const WARN_DAYS = 30;

/**
 * Days remaining from `now` until `isoDate` (UTC calendar).
 * Negative = already past. Returns null if date cannot be parsed.
 */
export function daysUntil(isoDate: string, now: Date = new Date()): number | null {
  const t = Date.parse(isoDate);
  if (Number.isNaN(t)) return null;
  const ms = t - now.getTime();
  // Floor toward -∞ so "29.9 days" still warns as 29; expired stays negative
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

/** Red warning when date is known and daysLeft ≤ WARN_DAYS (or already expired). */
export function shouldWarn(daysLeft: number | null): boolean {
  if (daysLeft === null) return false;
  return daysLeft <= WARN_DAYS;
}

export function formatDaysLeft(daysLeft: number | null): string {
  if (daysLeft === null) return "unknown";
  if (daysLeft < 0) return `expired ${Math.abs(daysLeft)} day(s) ago`;
  if (daysLeft === 0) return "expires today";
  return `${daysLeft} day(s) left`;
}
