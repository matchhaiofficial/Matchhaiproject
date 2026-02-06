export type MatchroomTimeWindow = {
  startMs: number;
  endMs: number;
};

export function parseScheduledDateTime(dateStr?: string, timeStr?: string): Date | null {
  if (!dateStr || !timeStr) return null;

  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  if (dateStr.includes("-")) {
    const [y, m, d] = dateStr.split("-").map((v) => Number(v));
    year = y;
    month = m;
    day = d;
  } else if (dateStr.includes("/")) {
    const [d, m, y] = dateStr.split("/").map((v) => Number(v));
    year = y;
    month = m;
    day = d;
  }

  if (!year || !month || !day) return null;

  let hour = 0;
  let minute = 0;
  const trimmed = timeStr.trim();
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    hour = Number(ampmMatch[1]);
    minute = Number(ampmMatch[2]);
    const meridian = ampmMatch[3].toUpperCase();
    if (meridian === "PM" && hour < 12) hour += 12;
    if (meridian === "AM" && hour === 12) hour = 0;
  } else {
    const parts = trimmed.split(":");
    if (parts.length >= 2) {
      hour = Number(parts[0]);
      minute = Number(parts[1]);
    } else {
      return null;
    }
  }

  const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

export function getMatchroomWindow(input: {
  scheduledDate?: string;
  scheduledTime?: string;
  durationMinutes?: number | null;
}): MatchroomTimeWindow | null {
  const start = parseScheduledDateTime(input.scheduledDate, input.scheduledTime);
  const duration = Number(input.durationMinutes);
  if (!start || !Number.isFinite(duration) || duration <= 0) return null;
  const startMs = start.getTime();
  return { startMs, endMs: startMs + duration * 60 * 1000 };
}

export function doWindowsOverlap(a: MatchroomTimeWindow, b: MatchroomTimeWindow) {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

export function formatTimeRange(window: MatchroomTimeWindow) {
  const start = new Date(window.startMs);
  const end = new Date(window.endMs);
  const time = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  const date = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${time(start)} – ${time(end)} on ${date}`;
}

