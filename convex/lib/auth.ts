import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export type UserRole = "player" | "zoneAdmin" | "superAdmin";
export type AuthedUser = Doc<"users"> & { uid: string };

export function normalizeRole(
  role?: string | null,
  accountType?: string | null,
  email?: string | null
): UserRole {
  const roleRaw = (role ?? "").toLowerCase().trim();
  const accountRaw = (accountType ?? "").toLowerCase().trim();
  const emailLower = (email ?? "").toLowerCase().trim();

  if (emailLower === "admin@matchhai.com") return "superAdmin";
  if (roleRaw === "super-admin" || roleRaw === "superadmin" || roleRaw === "super_admin") {
    return "superAdmin";
  }
  if (accountRaw === "super-admin" || accountRaw === "superadmin" || accountRaw === "super_admin") {
    return "superAdmin";
  }
  if (
    accountRaw === "zone" ||
    accountRaw === "zone-admin" ||
    accountRaw === "zoneadmin" ||
    roleRaw === "zone" ||
    roleRaw === "zone-admin" ||
    roleRaw === "zoneadmin"
  ) {
    return "zoneAdmin";
  }
  return "player";
}

export function getUserRole(user: Doc<"users">): UserRole {
  return normalizeRole(user.role ?? null, user.accountType ?? null, user.email ?? null);
}

export async function getUserByUid(ctx: Ctx, uid: string): Promise<Doc<"users"> | null> {
  const byUid = await ctx.db
    .query("users")
    .withIndex("by_uid", (q) => q.eq("uid", uid))
    .unique();
  if (byUid) return byUid;

  const normalizedId = ctx.db.normalizeId("users", uid);
  if (normalizedId) {
    return await ctx.db.get(normalizedId);
  }
  return null;
}

export async function getUserByIdentity(
  ctx: Ctx,
  identity: NonNullable<Awaited<ReturnType<Ctx["auth"]["getUserIdentity"]>>>
): Promise<Doc<"users"> | null> {
  const bySubject = await getUserByUid(ctx, identity.subject);
  if (bySubject) return bySubject;

  const email = identity.email?.trim().toLowerCase();
  if (email) {
    const byEmail = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (byEmail) return byEmail;
  }

  return null;
}

export async function requireUser(ctx: Ctx): Promise<{
  identity: NonNullable<Awaited<ReturnType<Ctx["auth"]["getUserIdentity"]>>>;
  user: AuthedUser;
  role: UserRole;
}> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Not authenticated");
  }

  const user = await getUserByIdentity(ctx, identity);
  if (!user) {
    throw new ConvexError("User profile not found");
  }
  if (!user.uid) {
    if ("patch" in ctx.db) {
      await (ctx as MutationCtx).db.patch(user._id, {
        uid: identity.subject,
        updatedAt: Date.now(),
      });
    }
    const patchedUser = { ...user, uid: identity.subject } as AuthedUser;
    return {
      identity,
      user: patchedUser,
      role: getUserRole(patchedUser),
    };
  }

  const userWithUid = user as AuthedUser;
  return { identity, user: userWithUid, role: getUserRole(userWithUid) };
}

export function requireRole(role: UserRole, allowed: UserRole[]): void {
  if (!allowed.includes(role)) {
    throw new ConvexError("Not authorized");
  }
}
