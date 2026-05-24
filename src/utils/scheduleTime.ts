// Stable, locale- and UTC-independent schedule time helpers.
//
// Counter-offer / booking times must be handled as real local-time instants so
// that crossing midnight rolls the calendar day correctly (e.g. 11:00 PM + 1h
// becomes the next day 12:00 AM, not the same day). Avoid toISOString() (UTC) for
// dates and toLocaleTimeString() for machine-readable times.

const pad = (n: number) => String(n).padStart(2, "0");

// Local calendar date as "YYYY-MM-DD" (NOT UTC).
export function toLocalDateString(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

// Local 24-hour time as "HH:mm".
export function toLocalTime24(value: Date): string {
  return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

// Minutes since midnight from "HH:mm" (24h) or "h:mm AM/PM" (12h). Null if
// the string cannot be parsed.
export function clockMinutesFromString(value?: string | null): number | null {
  const raw = String(value || "").trim();
  const twelve = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelve) {
    let hour = Number(twelve[1]) || 0;
    const minute = Number(twelve[2]) || 0;
    const period = twelve[3].toUpperCase();
    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;
    return hour * 60 + minute;
  }
  const twentyFour = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!twentyFour) return null;
  const hour = Math.max(0, Math.min(23, Number(twentyFour[1]) || 0));
  const minute = Math.max(0, Math.min(59, Number(twentyFour[2]) || 0));
  return hour * 60 + minute;
}

// Format minutes-since-midnight as "HH:mm" (24h). Null in -> null out.
export function minutesToTime24(minutes?: number | null): string | undefined {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) {
    return undefined;
  }
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
}

// Build a real local-time epoch (ms) from a "YYYY-MM-DD" date string and a time
// string (12h or 24h). Returns null if either part is invalid. The local Date
// constructor is used so there is no UTC shift; the day is taken from the date
// string directly (no rollover surprises).
export function combineLocalDateTime(
  dateStr?: string | null,
  timeStr?: string | null,
): number | null {
  const date = String(dateStr || "").trim();
  const minutes = clockMinutesFromString(timeStr);
  if (!date || minutes === null) return null;
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;
  const built = new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0, 0);
  const ms = built.getTime();
  return Number.isFinite(ms) ? ms : null;
}
