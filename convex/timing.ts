export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

export const MATCHROOM_MIN_LEAD_MS = 3 * DAY_MS;
export const WALKIN_MIN_LEAD_MS = DAY_MS;
export const MATCHROOM_MAX_ADVANCE_MS = 62 * DAY_MS;
export const COUNTER_OFFER_TIME_WINDOW_MS = 2 * HOUR_MS;
export const MATCHROOM_LOCK_BEFORE_START_MS = DAY_MS;
// When a permitted leave (i.e. before lock) happens within this window of the
// lock time, alert captains/host + the zone admin to find an urgent replacement.
export const URGENT_REPLACEMENT_WINDOW_MS = HOUR_MS;
export const PAYMENT_INTENT_TTL_MS = 15 * MINUTE_MS;
export const EASYPAY_CHECKOUT_TTL_MS = 15 * MINUTE_MS;
export const JOIN_REQUEST_TTL_MS = DAY_MS;
export const INVITE_TTL_MS = DAY_MS;
export const BROADCAST_ZONE_RESPONSE_WINDOW_MS = 12 * HOUR_MS;
export const BROADCAST_OFFER_RESPONSE_WINDOW_MS = 2 * HOUR_MS;
export const BROADCAST_COUNTER_RESPONSE_WINDOW_MS = BROADCAST_OFFER_RESPONSE_WINDOW_MS;
export const DIRECT_ZONE_COUNTER_RESPONSE_WINDOW_MS = 2 * HOUR_MS;
export const RESULT_CAPTAIN_VERIFICATION_MS = 2 * HOUR_MS;
export const RESULT_PARTICIPANT_VOTE_MS = 12 * HOUR_MS;
export const LIFECYCLE_CRON_INTERVAL_MS = 2 * MINUTE_MS;

export function getMatchroomLockAt(scheduledStartAt?: number | null) {
  const startAt = Number(scheduledStartAt || 0);
  if (!Number.isFinite(startAt) || startAt <= 0) return null;
  return startAt - MATCHROOM_LOCK_BEFORE_START_MS;
}

export function capExpiryAtLockTime(
  nowMs: number,
  desiredExpiryMs: number,
  scheduledStartAt?: number | null,
) {
  const lockAt = getMatchroomLockAt(scheduledStartAt);
  const capped = lockAt ? Math.min(desiredExpiryMs, lockAt) : desiredExpiryMs;
  return capped > nowMs ? capped : null;
}

export function validateMatchroomScheduleWindow(
  scheduledStartAt?: number | null,
  nowMs = Date.now(),
) {
  const startAt = Number(scheduledStartAt || 0);
  if (!Number.isFinite(startAt) || startAt <= 0) {
    return { ok: false as const, code: "missing_start_time", message: "Scheduled date/time is required." };
  }
  if (startAt - nowMs < MATCHROOM_MIN_LEAD_MS) {
    return {
      ok: false as const,
      code: "too_soon",
      message: "Matchrooms must be scheduled at least 3 days in advance.",
    };
  }
  if (startAt - nowMs > MATCHROOM_MAX_ADVANCE_MS) {
    return {
      ok: false as const,
      code: "too_far",
      message: "Matchrooms can be scheduled up to 2 months in advance.",
    };
  }
  return { ok: true as const, code: "valid", message: "Valid schedule." };
}

// Walk-in matchrooms (zone-admin, in-person) allow shorter notice than player
// matchrooms but must not be same-day: the scheduled calendar day has to be at
// least the next day. Upper bound matches the standard 2-month window.
export function validateWalkInScheduleWindow(
  scheduledStartAt?: number | null,
  nowMs = Date.now(),
) {
  const startAt = Number(scheduledStartAt || 0);
  if (!Number.isFinite(startAt) || startAt <= 0) {
    return { ok: false as const, code: "missing_start_time", message: "Scheduled date/time is required." };
  }
  const startDay = new Date(startAt);
  startDay.setHours(0, 0, 0, 0);
  const today = new Date(nowMs);
  today.setHours(0, 0, 0, 0);
  if (startDay.getTime() - today.getTime() < DAY_MS) {
    return {
      ok: false as const,
      code: "too_soon",
      message: "Walk-in matchrooms must be scheduled at least 1 day in advance.",
    };
  }
  if (startAt - nowMs > MATCHROOM_MAX_ADVANCE_MS) {
    return {
      ok: false as const,
      code: "too_far",
      message: "Walk-in matchrooms can be scheduled up to 2 months in advance.",
    };
  }
  return { ok: true as const, code: "valid", message: "Valid schedule." };
}
