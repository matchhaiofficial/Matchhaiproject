import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export const PRESENCE_TIMEOUT_MS = 2 * 60 * 1000;
export const PRESENCE_WRITE_THROTTLE_MS = 30 * 1000;

export function isRecentlyPresent(
  user: { isOnline?: boolean | null; lastActiveAt?: number | null } | null | undefined,
  now: number = Date.now(),
) {
  return !!(user?.isOnline && user.lastActiveAt && now - user.lastActiveAt < PRESENCE_TIMEOUT_MS);
}

export async function markUserPresent(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  now: number = Date.now(),
) {
  const current = await ctx.db.get(userId);
  if (
    current?.isOnline
    && typeof current.lastActiveAt === "number"
    && now - current.lastActiveAt < PRESENCE_WRITE_THROTTLE_MS
  ) {
    return false;
  }
  await ctx.db.patch(userId, { lastActiveAt: now, isOnline: true });
  return true;
}
