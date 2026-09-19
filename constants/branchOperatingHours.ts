export const DEFAULT_BRANCH_TIMEZONE = "Asia/Karachi";

export const BRANCH_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type BranchOperatingDay = {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
};

export type BranchOperatingHoursException = {
  date: string;
  isClosed: boolean;
  openTime?: string;
  closeTime?: string;
  label?: string;
};

export type BranchOperatingHours = {
  timezone: string;
  weekly: BranchOperatingDay[];
  exceptions?: BranchOperatingHoursException[];
};

export type BranchHoursAvailability = {
  available: boolean;
  configured: boolean;
  message: string | null;
  reason: "branch_closed" | "invalid_operating_hours" | null;
};

const CLOCK_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(date: string) {
  if (!DATE_PATTERN.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function createDefaultBranchOperatingHours(): BranchOperatingHours {
  return {
    timezone: DEFAULT_BRANCH_TIMEZONE,
    weekly: BRANCH_WEEKDAYS.map((_, dayOfWeek) => ({
      dayOfWeek,
      isClosed: false,
      openTime: "09:00",
      closeTime: "23:00",
    })),
    exceptions: [],
  };
}

function parseClock(value: unknown) {
  const match = CLOCK_PATTERN.exec(String(value || ""));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function validateBranchOperatingHours(value: unknown): string | null {
  if (!value || typeof value !== "object") return "Operating hours are not configured.";
  const schedule = value as Partial<BranchOperatingHours>;
  const timezone = String(schedule.timezone || "").trim();
  if (!timezone || !isValidTimeZone(timezone)) return "Select a valid operating-hours timezone.";
  if (!Array.isArray(schedule.weekly) || schedule.weekly.length !== 7) {
    return "Operating hours must include all seven days.";
  }
  const days = new Set<number>();
  for (const row of schedule.weekly) {
    const day = Number(row?.dayOfWeek);
    if (!Number.isInteger(day) || day < 0 || day > 6 || days.has(day)) {
      return "Operating hours contain an invalid or duplicate weekday.";
    }
    days.add(day);
    if (!row.isClosed && (parseClock(row.openTime) === null || parseClock(row.closeTime) === null)) {
      return `${BRANCH_WEEKDAYS[day]} needs valid opening and closing times.`;
    }
  }

  const exceptions = Array.isArray(schedule.exceptions) ? schedule.exceptions : [];
  if (exceptions.length > 31) return "Keep at most 31 upcoming schedule exceptions.";
  const dates = new Set<string>();
  for (const exception of exceptions) {
    const date = String(exception?.date || "");
    if (!isValidCalendarDate(date)) {
      return "Every schedule exception needs a valid YYYY-MM-DD date.";
    }
    if (dates.has(date)) return `Only one schedule exception is allowed for ${date}.`;
    dates.add(date);
    if (
      !exception.isClosed &&
      (parseClock(exception.openTime) === null || parseClock(exception.closeTime) === null)
    ) {
      return `The ${date} exception needs valid opening and closing times.`;
    }
  }
  return null;
}

type LocalParts = { date: string; dayOfWeek: number; minute: number };

function getLocalParts(timestamp: number, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(timestamp)).map((part) => [part.type, part.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const dateAtUtcMidnight = new Date(`${date}T00:00:00Z`);
  return {
    date,
    dayOfWeek: dateAtUtcMidnight.getUTCDay(),
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function addLocalDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function localDayDifference(fromDate: string, toDate: string) {
  return Math.round(
    (new Date(`${toDate}T00:00:00Z`).getTime() - new Date(`${fromDate}T00:00:00Z`).getTime()) /
      86_400_000,
  );
}

function getWindowForOperatingDate(schedule: BranchOperatingHours, date: string) {
  const exception = (schedule.exceptions || []).find((item) => item.date === date);
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  const source = exception || schedule.weekly.find((item) => item.dayOfWeek === dayOfWeek);
  if (!source || source.isClosed) return null;
  const openMinute = parseClock(source.openTime);
  const closeClockMinute = parseClock(source.closeTime);
  if (openMinute === null || closeClockMinute === null) return null;
  // Equal times represent a continuously-open 24-hour operating day.
  let closeMinute = closeClockMinute <= openMinute ? closeClockMinute + 1440 : closeClockMinute;
  // A dated override is authoritative for its entire local calendar date. Do
  // not let the previous day's overnight window leak into an overridden day;
  // that day's exception contributes its own window when applicable.
  if (closeMinute > 1440) {
    const nextDate = addLocalDays(date, 1);
    if ((schedule.exceptions || []).some((item) => item.date === nextDate)) {
      closeMinute = 1440;
    }
  }
  return { openMinute, closeMinute };
}

export function checkBranchOperatingHours(input: {
  operatingHours: unknown;
  scheduledStartAt: number;
  durationMinutes: number;
  branchLabel?: string | null;
}): BranchHoursAvailability {
  if (!input.operatingHours) {
    return { available: true, configured: false, message: null, reason: null };
  }
  const validationError = validateBranchOperatingHours(input.operatingHours);
  if (validationError) {
    return {
      available: false,
      configured: true,
      message: "This branch's operating hours are invalid. Please ask the venue to update them.",
      reason: "invalid_operating_hours",
    };
  }

  const schedule = input.operatingHours as BranchOperatingHours;
  const startAt = Number(input.scheduledStartAt);
  const durationMinutes = Math.max(1, Math.floor(Number(input.durationMinutes || 0)));
  if (!Number.isFinite(startAt) || startAt <= 0) {
    return {
      available: false,
      configured: true,
      message: "The selected booking time is invalid.",
      reason: "invalid_operating_hours",
    };
  }
  const start = getLocalParts(startAt, schedule.timezone);
  const end = getLocalParts(startAt + durationMinutes * 60_000, schedule.timezone);

  const windows: Array<{ openMinute: number; closeMinute: number }> = [];
  for (const offset of [-1, 0, 1]) {
    const operatingDate = addLocalDays(start.date, offset);
    const window = getWindowForOperatingDate(schedule, operatingDate);
    if (!window) continue;
    const baseOffset = localDayDifference(start.date, operatingDate) * 1440;
    windows.push({
      openMinute: baseOffset + window.openMinute,
      closeMinute: baseOffset + window.closeMinute,
    });
  }
  windows.sort((left, right) => left.openMinute - right.openMinute);
  const merged: Array<{ openMinute: number; closeMinute: number }> = [];
  for (const window of windows) {
    const previous = merged[merged.length - 1];
    if (previous && window.openMinute <= previous.closeMinute) {
      previous.closeMinute = Math.max(previous.closeMinute, window.closeMinute);
    } else {
      merged.push({ ...window });
    }
  }
  const relativeStart = start.minute;
  const relativeEnd = localDayDifference(start.date, end.date) * 1440 + end.minute;
  if (merged.some((window) => relativeStart >= window.openMinute && relativeEnd <= window.closeMinute)) {
    return { available: true, configured: true, message: null, reason: null };
  }

  const branchLabel = String(input.branchLabel || "This branch").trim() || "This branch";
  return {
    available: false,
    configured: true,
    message: `${branchLabel} is closed for part or all of the selected time. Choose a time within its operating hours.`,
    reason: "branch_closed",
  };
}

export function formatBranchOperatingHoursSummary(value: unknown) {
  if (!value || validateBranchOperatingHours(value)) return "Not configured";
  const schedule = value as BranchOperatingHours;
  const openDays = schedule.weekly.filter((day) => !day.isClosed);
  if (!openDays.length) return `Closed all week (${schedule.timezone})`;
  const uniqueWindows = new Set(openDays.map((day) => `${day.openTime}-${day.closeTime}`));
  if (openDays.length === 7 && uniqueWindows.size === 1) {
    const day = openDays[0];
    return `Daily ${day.openTime}–${day.closeTime} (${schedule.timezone})`;
  }
  return `${openDays.length} open days configured (${schedule.timezone})`;
}
