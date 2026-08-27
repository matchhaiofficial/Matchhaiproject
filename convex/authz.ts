import { Id } from "./_generated/dataModel";
import { authComponent } from "./auth";
import { isAuthorizedSuperAdmin } from "./superAdminAccess";

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
  );
}

// Delegates to the centralized resolver (./superAdminAccess) so this identity
// gate authorizes identically to the session-token gate in convex/admin.ts,
// including the SUPER_ADMIN_ALLOWLIST_JSON path it previously ignored.
export function isSuperAdminProfile(profile: any, email?: string | null) {
  return isAuthorizedSuperAdmin(profile, email);
}

export async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  let authUser: Awaited<ReturnType<typeof authComponent.getAuthUser>> | null = null;
  try {
    authUser = await authComponent.getAuthUser(ctx);
  } catch {
    authUser = null;
  }

  // Build normalized candidates. tokenIdentifier is typically "https://issuer|shortId";
  // also extract the shortId suffix so stored authIds in either form can be matched.
  const rawIdentityFields: Array<string | null | undefined> = [
    identity?.tokenIdentifier,
    identity?.subject,
    authUser?.userId,
    (authUser as any)?.id,
    authUser?._id,
  ];
  for (const raw of [identity?.tokenIdentifier, identity?.subject]) {
    if (raw && raw.includes("|")) rawIdentityFields.push(raw.split("|").pop());
  }
  const candidateAuthIds = uniqueStrings(rawIdentityFields);

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

// Privacy-safe projection of PSN stats for public profiles. Only exposes the
// public online handle and per-game trophy progress — never the raw provider
// payload (avatar/profile URLs, trophy tier blobs, sync timestamps, etc.).
function publicPsnStats(psnStats: any) {
  if (!psnStats || typeof psnStats !== "object") return null;
  const pickProgress = (game: any) =>
    game && typeof game.progress === "number" ? { progress: game.progress } : undefined;
  return {
    psnOnlineId: psnStats.psnOnlineId ?? null,
    tekken8: pickProgress(psnStats.tekken8),
    fc: pickProgress(psnStats.fc),
  };
}

export function getPublicAreas(user: any): string[] {
  if (user?.hideAreasPublicly) return [];
  return Array.isArray(user?.areasPreferred) ? user.areasPreferred : [];
}

export function getPublicPlatformValue(user: any, field: string): any {
  if (user?.hidePlatformsPublicly) return null;
  return user?.[field] ?? null;
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
    areasPreferred: getPublicAreas(user),
    primaryGames: Array.isArray(user.primaryGames) ? user.primaryGames : [],
    skillScores: user.skillScores || {},
    isOnline: user.isOnline,
    lastActiveAt: user.lastActiveAt,
    trustScore: typeof user.trustScore === "number" ? user.trustScore : undefined,

    // Privacy preferences (so public viewers honor the owner's choices).
    hideAreasPublicly: !!user.hideAreasPublicly,
    hidePlatformsPublicly: !!user.hidePlatformsPublicly,

    // Game participation + display details (non-sensitive).
    playsCs2: !!user.playsCs2,
    playsCs16: !!user.playsCs16,
    playsValorant: !!user.playsValorant,
    playsFc: !!user.playsFc,
    playsTekken: !!user.playsTekken,
    playsFutsal: !!user.playsFutsal,
    playsIndoorCricket: !!user.playsIndoorCricket,
    playsPadel: !!user.playsPadel,
    playsPickleball: !!user.playsPickleball,
    cs2Role: user.cs2Role ?? null,
    cs16Role: user.cs16Role ?? null,
    valorantRole: user.valorantRole ?? null,
    valorantAgent: user.valorantAgent ?? null,
    fcTeam: user.fcTeam,
    fcFormation: user.fcFormation ?? null,
    tekkenFavorites: Array.isArray(user.tekkenFavorites) ? user.tekkenFavorites : [],
    futsalPosition: user.futsalPosition ?? null,
    indoorCricketRole: user.indoorCricketRole ?? null,
    indoorCricketBattingStyle: user.indoorCricketBattingStyle ?? null,
    indoorCricketBowlingStyle: user.indoorCricketBowlingStyle ?? null,
    padelRole: user.padelRole ?? null,
    pickleballRole: user.pickleballRole ?? null,

    // Verified external-platform identifiers and display values. Every value is
    // removed server-side when the owner enables platform privacy; clients never
    // receive hidden values and therefore cannot bypass the preference.
    steamId: getPublicPlatformValue(user, "steamId"),
    steamProfileUrl: getPublicPlatformValue(user, "steamProfileUrl"),
    steamPersonaName: getPublicPlatformValue(user, "steamPersonaName"),
    steamCs2Hours: getPublicPlatformValue(user, "steamCs2Hours"),
    steamTekken8Hours: getPublicPlatformValue(user, "steamTekken8Hours"),
    steamFc26Hours: getPublicPlatformValue(user, "steamFc26Hours"),
    faceitId: getPublicPlatformValue(user, "faceitId"),
    faceitProfileUrl: getPublicPlatformValue(user, "faceitProfileUrl"),
    faceitNickname: getPublicPlatformValue(user, "faceitNickname"),
    faceitGame: getPublicPlatformValue(user, "faceitGame"),
    faceitElo: getPublicPlatformValue(user, "faceitElo"),
    faceitSkillLevel: getPublicPlatformValue(user, "faceitSkillLevel"),
    psnAccountId: getPublicPlatformValue(user, "psnAccountId"),
    psnOnlineId: getPublicPlatformValue(user, "psnOnlineId"),
    psnStats: user.hidePlatformsPublicly ? null : publicPsnStats(user.psnStats),
    xboxGamertag: getPublicPlatformValue(user, "xboxGamertag"),
  };
}
