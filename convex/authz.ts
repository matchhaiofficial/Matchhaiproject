import { Id } from "./_generated/dataModel";
import { authComponent } from "./auth";

function normalizeEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
  );
}

export function isSuperAdminProfile(profile: any, email?: string | null) {
  const role = String(profile?.role || "").trim();
  const allowlist = uniqueStrings([
    process.env.SUPER_ADMIN_EMAIL,
    process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL,
    process.env.SUPER_ADMIN_EMAIL_JUNAID,
    process.env.SUPER_ADMIN_EMAIL_EHTESHAN,
    process.env.SUPER_ADMIN_EMAIL_ZEERAK,
    process.env.SUPER_ADMIN_EMAIL_MUBEEN,
    process.env.SUPER_ADMIN_EMAIL_SAAD,
    process.env.SUPER_ADMIN_EMAIL_OVAIS,
  ]).map(normalizeEmail);
  const normalizedEmail = normalizeEmail(email || profile?.email);
  return (
    role === "super_admin" ||
    role === "super-admin" ||
    (!!normalizedEmail && allowlist.includes(normalizedEmail))
  );
}

export async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  let authUser: Awaited<ReturnType<typeof authComponent.getAuthUser>> | null = null;
  try {
    authUser = await authComponent.getAuthUser(ctx);
  } catch {
    authUser = null;
  }

  const candidateAuthIds = uniqueStrings([
    identity?.tokenIdentifier,
    identity?.subject,
    authUser?.userId,
    (authUser as any)?.id,
    authUser?._id,
  ]);

  for (const authId of candidateAuthIds) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q: any) => q.eq("authId", authId))
      .unique();
    if (user) {
      return { user, identity, authUser, candidateAuthIds };
    }
  }

  return { user: null, identity, authUser, candidateAuthIds };
}

export async function requireCurrentUser(ctx: any) {
  const actor = await getCurrentUser(ctx);
  if (!actor.identity && !actor.authUser) {
    throw new Error("Unauthenticated");
  }
  if (!actor.user) {
    throw new Error("User profile not found");
  }
  return actor;
}

export async function requireSelf(ctx: any, userId: Id<"users">) {
  const actor = await requireCurrentUser(ctx);
  if (String(actor.user._id) !== String(userId)) {
    throw new Error("Not authorized");
  }
  return actor;
}

export async function requireSelfOrSuperAdmin(ctx: any, userId: Id<"users">) {
  const actor = await requireCurrentUser(ctx);
  if (String(actor.user._id) === String(userId)) return actor;
  if (isSuperAdminProfile(actor.user, actor.authUser?.email || actor.identity?.email)) return actor;
  throw new Error("Not authorized");
}

export async function requireSuperAdmin(ctx: any) {
  const actor = await requireCurrentUser(ctx);
  if (!isSuperAdminProfile(actor.user, actor.authUser?.email || actor.identity?.email)) {
    throw new Error("Super admin access required");
  }
  return actor;
}

export async function requireOwnedZone(ctx: any, zoneId: Id<"zones">) {
  const actor = await requireCurrentUser(ctx);
  const zone = await ctx.db.get(zoneId);
  if (!zone || String(zone.ownerUid || "") !== String(actor.user._id)) {
    throw new Error("Not authorized for this zone");
  }
  return { ...actor, zone };
}

export async function getOwnedZoneForCurrentUser(ctx: any) {
  const actor = await requireCurrentUser(ctx);
  const zone = await ctx.db
    .query("zones")
    .withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", actor.user._id))
    .unique();
  return { ...actor, zone };
}

export function publicUser(user: any) {
  if (!user) return null;
  return {
    _id: user._id,
    uid: String(user._id),
    username: user.username,
    fullName: user.fullName,
    photoURL: user.photoURL,
    bio: user.bio,
    accountType: user.accountType,
    city: user.city,
    areasPreferred: Array.isArray(user.areasPreferred) ? user.areasPreferred : [],
    primaryGames: Array.isArray(user.primaryGames) ? user.primaryGames : [],
    skillScores: user.skillScores || {},
    isOnline: user.isOnline,
    lastActiveAt: user.lastActiveAt,
    playsCs2: !!user.playsCs2,
    playsCs16: !!user.playsCs16,
    playsValorant: !!user.playsValorant,
    playsFc: !!user.playsFc,
    playsTekken: !!user.playsTekken,
    fcTeam: user.fcTeam,
    tekkenFavorites: Array.isArray(user.tekkenFavorites) ? user.tekkenFavorites : [],
    faceitElo: user.faceitElo,
    faceitSkillLevel: user.faceitSkillLevel,
  };
}
