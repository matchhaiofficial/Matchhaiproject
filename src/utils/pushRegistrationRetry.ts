const PUSH_REGISTRATION_RETRY_DELAYS_MS = [
  5_000,
  30_000,
  2 * 60_000,
  10 * 60_000,
] as const;

export function getPushRegistrationRetryDelayMs(attempt: number) {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  return PUSH_REGISTRATION_RETRY_DELAYS_MS[
    Math.min(safeAttempt, PUSH_REGISTRATION_RETRY_DELAYS_MS.length - 1)
  ];
}
