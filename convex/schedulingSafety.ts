/**
 * Convex executes `runAt` timestamps in the past immediately. Always move an
 * overdue one-shot job a small distance into the future so a stale migration
 * or clock boundary cannot create a maximum-throughput scheduler chain.
 *
 * This delay is only a backstop. Any callback that schedules itself must also
 * prove progress, terminate, or persist a future deadline before doing so.
 */
export const MIN_SCHEDULE_DELAY_MS = 1_000;

export function getSafeScheduleAt(dueAt: unknown, now = Date.now()): number | undefined {
  const timestamp = Number(dueAt || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return undefined;
  return timestamp > now ? timestamp : now + MIN_SCHEDULE_DELAY_MS;
}
