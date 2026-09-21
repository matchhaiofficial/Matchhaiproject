import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type ReadCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export async function isEitherUserBlocked(
  ctx: ReadCtx,
  firstUserId: Id<"users">,
  secondUserId: Id<"users">,
) {
  if (String(firstUserId) === String(secondUserId)) return false;

  const firstBlock = await ctx.db
    .query("userBlocks")
    .withIndex("by_userId_and_blockedUserId", (q) =>
      q.eq("userId", firstUserId).eq("blockedUserId", secondUserId),
    )
    .unique();
  if (firstBlock) return true;

  const reverseBlock = await ctx.db
    .query("userBlocks")
    .withIndex("by_userId_and_blockedUserId", (q) =>
      q.eq("userId", secondUserId).eq("blockedUserId", firstUserId),
    )
    .unique();
  return Boolean(reverseBlock);
}

export async function assertUsersCanShareMatchroom(
  ctx: ReadCtx,
  joiningUserId: Id<"users">,
  participantUserIds: Id<"users">[],
) {
  for (const participantUserId of participantUserIds) {
    if (await isEitherUserBlocked(ctx, joiningUserId, participantUserId)) {
      throw new Error("You cannot join this matchroom because you or another participant has blocked the other account.");
    }
  }
}

export async function ensureUserBlock(
  ctx: Pick<MutationCtx, "db">,
  userId: Id<"users">,
  blockedUserId: Id<"users">,
) {
  if (String(userId) === String(blockedUserId)) {
    throw new Error("You cannot block your own account.");
  }
  const existing = await ctx.db
    .query("userBlocks")
    .withIndex("by_userId_and_blockedUserId", (q) =>
      q.eq("userId", userId).eq("blockedUserId", blockedUserId),
    )
    .unique();

  const [forwardFriendship, reverseFriendship] = await Promise.all([
    ctx.db.query("friendships").withIndex("by_userId_and_friendId", (q) =>
      q.eq("userId", userId).eq("friendId", blockedUserId),
    ).unique(),
    ctx.db.query("friendships").withIndex("by_userId_and_friendId", (q) =>
      q.eq("userId", blockedUserId).eq("friendId", userId),
    ).unique(),
  ]);
  if (forwardFriendship) await ctx.db.delete(forwardFriendship._id);
  if (reverseFriendship) await ctx.db.delete(reverseFriendship._id);
  if (existing) return existing._id;

  return await ctx.db.insert("userBlocks", {
    userId,
    blockedUserId,
    createdAt: Date.now(),
  });
}
