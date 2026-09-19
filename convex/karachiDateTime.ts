const KARACHI_TIME_ZONE = "Asia/Karachi";
const KARACHI_UTC_OFFSET = "+05:00";
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function getKarachiDateString(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    const match = DATE_PATTERN.exec(text);
    if (!match) return null;
    const parsed = new Date(`${text}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text
      ? text
      : null;
  }

  const timestamp = Number(value || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KARACHI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function normalizeClockTime(value: unknown): string | null {
  let time = String(value || "").trim();
  const twelveHour = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2]);
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    const period = twelveHour[3].toUpperCase();
    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;
    time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  const twentyFourHour = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!twentyFourHour) return null;
  const hour = Number(twentyFourHour[1]);
  const minute = Number(twentyFourHour[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseKarachiDateTimeMillis(dateValue: unknown, timeValue: unknown): number | null {
  const date = getKarachiDateString(dateValue);
  const time = normalizeClockTime(timeValue);
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}:00${KARACHI_UTC_OFFSET}`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function getKarachiDayStartMillis(value: unknown): number | null {
  const date = getKarachiDateString(value);
  return date ? parseKarachiDateTimeMillis(date, "00:00") : null;
}
