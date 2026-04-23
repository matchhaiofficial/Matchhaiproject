import { Id } from "./_generated/dataModel";
import { authComponent } from "./auth";

export async function resolveUserByAnyId(ctx: any, value?: string | null) {
  if (!value) return null;

  try {
    const directUser = await ctx.db.get(value as Id<"users">);
    if (directUser) {
      return directUser;
    }
  } catch {
    // Not a Convex document id; fall through to auth id lookup.
  }

  return await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", value))
    .unique();
}

function getAuthUserKeys(authUser: any) {
  if (!authUser || typeof authUser !== "object") return [];
  return Object.keys(authUser).sort();
}

export async function getStrictAuthenticatedUserId(ctx: any): Promise<Id<"users">> {
  const authUser = await authComponent.getAuthUser(ctx);
  const authRecordId = typeof authUser?._id === "string" ? authUser._id : null;
  const linkedAppUserId = typeof authUser?.userId === "string" ? authUser.userId : null;
  console.info("[ChatAuth] getAuthUser result", {
    hasAuthUser: Boolean(authUser),
    authRecordId,
    linkedAppUserId,
    keys: getAuthUserKeys(authUser),
  });

  if (linkedAppUserId) {
    const directUser = await resolveUserByAnyId(ctx, linkedAppUserId);
    if (directUser) {
      console.info("[ChatAuth] Resolved authenticated user via linked app user id", {
        authRecordId,
        linkedAppUserId,
        userId: directUser._id,
      });
      return directUser._id;
    }
  }

  if (!authRecordId) {
    console.warn("[ChatAuth] Missing authenticated user in Convex context");
    throw new Error("Unauthenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", authRecordId))
    .unique();

  if (!user) {
    console.warn("[ChatAuth] Auth user has no matching profile", {
      authRecordId,
      linkedAppUserId,
    });
    throw new Error("User profile not found");
  }

  console.info("[ChatAuth] Resolved authenticated user profile", {
    authRecordId,
    linkedAppUserId,
    userId: user._id,
  });

  return user._id;
}
