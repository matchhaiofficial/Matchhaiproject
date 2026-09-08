import { Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { isAccountSuspensionActive } from "./accountStatusPolicy";

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

export async function getStrictAuthenticatedUserId(ctx: any): Promise<Id<"users">> {
  let authUser: any = null;
  try {
    authUser = await authComponent.getAuthUser(ctx);
  } catch {
    authUser = null;
  }
  const identity = await ctx.auth.getUserIdentity();
  const authRecordId = typeof authUser?._id === "string" ? authUser._id : null;
  const linkedAppUserId = typeof authUser?.userId === "string" ? authUser.userId : null;
  const candidates = [
    linkedAppUserId,
    authRecordId,
    identity?.subject,
    identity?.tokenIdentifier,
    identity?.tokenIdentifier?.includes("|") ? identity.tokenIdentifier.split("|").pop() : null,
  ];

  for (const candidate of Array.from(new Set(candidates.filter(Boolean).map(String)))) {
    const user = await resolveUserByAnyId(ctx, candidate);
    if (!user) continue;
    if (isAccountSuspensionActive(user)) throw new Error("Account suspended");
    return user._id;
  }

  if (!authUser && !identity) {
    throw new Error("Unauthenticated");
  }
  throw new Error("User profile not found");
}
