export const APP_TIMEZONE = "Asia/Kolkata";

/**
 * Normalizes any input into a Date object or null if invalid.
 */
export function toDate(dateInput: string | Date | number | null | undefined): Date | null {
  if (dateInput === null || dateInput === undefined) return null;
  try {
    const date = new Date(dateInput);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

// Cache formatters once to avoid expensive instantiations on every render
const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: APP_TIMEZONE,
});

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: APP_TIMEZONE,
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZone: APP_TIMEZONE,
});

/**
 * Formats date to "13 Jul 2026" in APP_TIMEZONE
 */
export function formatDate(dateInput: string | Date | number | null | undefined): string {
  const date = toDate(dateInput);
  if (!date) return "—";
  return dateFormatter.format(date);
}

/**
 * Formats time to "09:00 PM" in APP_TIMEZONE
 */
export function formatTime(dateInput: string | Date | number | null | undefined): string {
  const date = toDate(dateInput);
  if (!date) return "—";
  return timeFormatter.format(date);
}

/**
 * Formats datetime to "13 Jul 2026, 09:00 PM IST" in APP_TIMEZONE
 */
export function formatDateTime(dateInput: string | Date | number | null | undefined): string {
  const date = toDate(dateInput);
  if (!date) return "—";
  return `${dateTimeFormatter.format(date)} IST`;
}

/**
 * Calculates a human-readable relative time string.
 */
export function getRelativeTime(dateInput: string | Date | number | null | undefined): string {
  const date = toDate(dateInput);
  if (!date) return "Never";
  
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
