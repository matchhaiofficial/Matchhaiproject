/**
 * Typed domain-event loggers + counters/markers for MatchHai.
 *
 * Every logger funnels through the monitoring core (captureMessage /
 * addBreadcrumb) and runs its payload through the strict allowlist redactor
 * (`pickAllowed`), so only ids / enums / counts / timings are ever forwarded.
 * Callers pass ids and enums only — NEVER PII.
 *
 * Failure-rate / count style instrumentation is exposed via the `Counters`
 * object and the lower-level `incr` / `markSlowScreen` helpers, which also feed
 * the existing perf instrumentation (`recordCountMetric`) so they show up in
 * the local perf event buffer too.
 */

import { recordCountMetric } from "../../utils/perfInstrumentation";
import { addBreadcrumb, captureMessage } from "./index";
import { pickAllowed } from "./redact";
import type { MonitorLevel } from "./types";

/** Stable event-name catalogue (keeps strings consistent across the app). */
export const MonitoringEvent = {
  BookingIntentCreated: "booking.intent_created",
  BookingIntentFailed: "booking.intent_failed",
  PaymentConfirmation: "payment.confirmation",
  PaymentConfirmationFailed: "payment.confirmation_failed",
  MatchroomLock: "matchroom.lock",
  MatchroomExpiry: "matchroom.expiry",
  MatchroomCreationFailed: "matchroom.creation_failed",
  ResultVerification: "result.verification",
  ResultVerificationFailed: "result.verification_failed",
  NotificationFailure: "notification.send_failed",
  ApiCallFailed: "api.call_failed",
  SlowScreen: "perf.slow_screen",
} as const;

export type MonitoringEventName =
  (typeof MonitoringEvent)[keyof typeof MonitoringEvent];

/** Counter keys for failure-rate / volume tracking. */
export const Counter = {
  ApiCallFailed: "api_call_failed",
  SlowScreen: "slow_screen",
  PaymentFailure: "payment_failure",
  BookingFailure: "booking_failure",
  MatchroomCreationFailure: "matchroom_creation_failure",
  BookingIntentFailure: "booking_intent_failure",
  PaymentConfirmationFailure: "payment_confirmation_failure",
  RoomLock: "room_lock",
  RoomExpiry: "room_expiry",
  ResultVerificationFailure: "result_verification_failure",
  NotificationSendFailure: "notification_send_failure",
} as const;

export type CounterKey = (typeof Counter)[keyof typeof Counter];

// In-memory monotonic counters (process lifetime). Useful for ratio calcs and
// quick assertions in tests; also mirrored into perf metrics.
const counters: Record<string, number> = {};

/** Increment a named counter and emit a breadcrumb + perf metric. */
export function incr(key: CounterKey | string, by = 1, props?: Record<string, unknown>): number {
  counters[key] = (counters[key] ?? 0) + by;
  const safe = pickAllowed(props);
  try {
    recordCountMetric(`monitor.${key}`, counters[key], safe);
  } catch {
    /* perf is dev-only / best effort */
  }
  addBreadcrumb({
    category: "counter",
    message: key,
    level: "info",
    data: { ...safe, count: counters[key] },
  });
  return counters[key];
}

/** Read a counter's current value (0 if never incremented). */
export function getCounter(key: CounterKey | string): number {
  return counters[key] ?? 0;
}

/** Reset all counters (tests). */
export function __resetCounters(): void {
  for (const k of Object.keys(counters)) delete counters[k];
}

/**
 * Generic event logger. Emits a breadcrumb and a captureMessage with an
 * allowlist-redacted payload. `props` must contain only ids/enums.
 */
export function logEvent(
  name: string,
  props?: Record<string, unknown>,
  level: MonitorLevel = "info",
): void {
  const safe = pickAllowed(props);
  addBreadcrumb({ category: "event", message: name, level, data: safe });
  captureMessage(name, level, { event: name, ...safe });
}

// ---------------------------------------------------------------------------
// Typed domain event loggers (ids / enums only)
// ---------------------------------------------------------------------------

export function logBookingIntentCreated(props: {
  bookingIntentId?: string;
  userId?: string;
  venueId?: string;
  slotId?: string;
  amount?: number;
  currency?: string;
}): void {
  logEvent(MonitoringEvent.BookingIntentCreated, props, "info");
}

export function logBookingIntentFailed(props: {
  userId?: string;
  venueId?: string;
  reason?: string;
  code?: string;
}): void {
  incr(Counter.BookingIntentFailure, 1, props);
  incr(Counter.BookingFailure, 1, props);
  logEvent(MonitoringEvent.BookingIntentFailed, props, "error");
}

export function logPaymentConfirmation(props: {
  paymentId?: string;
  transactionId?: string;
  bookingId?: string;
  userId?: string;
  provider?: string;
  status?: string;
  amount?: number;
  currency?: string;
}): void {
  logEvent(MonitoringEvent.PaymentConfirmation, props, "info");
}

export function logPaymentConfirmationFailed(props: {
  paymentId?: string;
  transactionId?: string;
  userId?: string;
  provider?: string;
  reason?: string;
  code?: string;
}): void {
  incr(Counter.PaymentConfirmationFailure, 1, props);
  incr(Counter.PaymentFailure, 1, props);
  logEvent(MonitoringEvent.PaymentConfirmationFailed, props, "error");
}

export function logMatchroomLock(props: {
  matchroomId?: string;
  matchId?: string;
  state?: string;
  locked?: boolean;
}): void {
  incr(Counter.RoomLock, 1, props);
  logEvent(MonitoringEvent.MatchroomLock, props, "info");
}

export function logMatchroomExpiry(props: {
  matchroomId?: string;
  matchId?: string;
  reason?: string;
  expired?: boolean;
}): void {
  incr(Counter.RoomExpiry, 1, props);
  logEvent(MonitoringEvent.MatchroomExpiry, props, "info");
}

export function logMatchroomCreationFailed(props: {
  userId?: string;
  gameId?: string;
  reason?: string;
  code?: string;
}): void {
  incr(Counter.MatchroomCreationFailure, 1, props);
  logEvent(MonitoringEvent.MatchroomCreationFailed, props, "error");
}

export function logResultVerification(props: {
  resultId?: string;
  matchId?: string;
  matchroomId?: string;
  outcome?: string;
  verified?: boolean;
}): void {
  logEvent(MonitoringEvent.ResultVerification, props, "info");
}

export function logResultVerificationFailed(props: {
  resultId?: string;
  matchId?: string;
  reason?: string;
  code?: string;
}): void {
  incr(Counter.ResultVerificationFailure, 1, props);
  logEvent(MonitoringEvent.ResultVerificationFailed, props, "error");
}

export function logNotificationFailure(props: {
  notificationId?: string;
  userId?: string;
  type?: string;
  reason?: string;
  code?: string;
}): void {
  incr(Counter.NotificationSendFailure, 1, props);
  logEvent(MonitoringEvent.NotificationFailure, props, "error");
}

// ---------------------------------------------------------------------------
// Cross-cutting markers
// ---------------------------------------------------------------------------

/** Record a failed API call (counter + event). */
export function logApiFailure(props: {
  endpoint?: string;
  method?: string;
  statusCode?: number;
  code?: string;
  reason?: string;
  durationMs?: number;
}): void {
  incr(Counter.ApiCallFailed, 1, props);
  logEvent(MonitoringEvent.ApiCallFailed, props, "warning");
}

/** Mark a screen as slow when its load exceeds a threshold. */
export function markSlowScreen(props: {
  screen?: string;
  route?: string;
  durationMs?: number;
  thresholdMs?: number;
}): void {
  incr(Counter.SlowScreen, 1, props);
  logEvent(MonitoringEvent.SlowScreen, props, "warning");
}

/** Aggregate failure-rate helpers built on the live counters. */
export const Counters = {
  incr,
  get: getCounter,
  all(): Readonly<Record<string, number>> {
    return { ...counters };
  },
  /** payment failures / (payment failures + confirmations-ish denominator). */
  ratio(numerator: CounterKey | string, denominatorTotal: number): number {
    if (denominatorTotal <= 0) return 0;
    return getCounter(numerator) / denominatorTotal;
  },
};
