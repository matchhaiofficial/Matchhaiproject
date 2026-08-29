import { query, mutation, action, internalQuery, internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { api, components, internal } from "./_generated/api";
import { authComponent } from "./auth";
import { canViewerAccessPublicUser, isUserHiddenFromPublic } from "./userVisibility";
import { getCurrentUser, publicUser, requireCurrentUser, requireSelf, requireSelfOrSuperAdmin } from "./authz";
import { markUserPresent } from "./presence";

// ============================================
// RATING / PROFILE SECURITY HELPERS
// ============================================

/**
 * Ensures the authenticated caller owns `userId`. Returns the caller's user doc.
 * Used to lock self-only profile/skill mutations so no client can write another
 * user's record. Direct service calls carry the signed-in token via the shared
 * client proxy (see src/lib/convex.ts), so legitimate self-updates still work.
 */
async function requireProfileOwner(ctx: any, userId: Id<"users">) {
  return (await requireSelf(ctx, userId)).user;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

// Server-side 0-100 tier mapping (kept consistent with the client UI helper so
// display behavior is unchanged). The dynamic 1000-based `elo` is the internal
// source of truth and is NEVER writable through these client mutations.
function tierFromRating(rating: number): string {
  if (rating <= 30) return "Beginner";
  if (rating <= 50) return "Casual";
  if (rating <= 70) return "Intermediate";
  if (rating <= 85) return "Advanced";
  if (rating <= 95) return "Pro";
  return "Elite";
}

// Fields a client may never set through the generic profile mutations
// (privilege escalation / trust manipulation guards).
const PROTECTED_USER_FIELDS = new Set<string>([
  "role",
  "authId",
  "kycStatus",
  "kycVerified",
  "kycVerifiedAt",
  "isBanned",
  "banned",
  "isSuspended",
  "suspended",
  "trustScore",
  "_id",
  "_creationTime",
]);

function stripProtectedUserFields(updates: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(updates || {})) {
    if (PROTECTED_USER_FIELDS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Sanitize a single incoming skill-score object from a client:
 * - clamp `rating` to 0-100 and recompute `tier` server-side,
 * - preserve the server-managed `elo`, wins/losses/matchesPlayed and
 *   lastMatchDate from the existing record (so a self re-assessment can never
 *   wipe match-earned ELO/stats nor forge an arbitrary `elo`),
 * - keep client-provided calibration metadata (initialSource/initialRating).
 */
function sanitizeIncomingSkillScore(incoming: any, existing: any): any {
  const rating = clampNumber(Number(incoming?.rating ?? existing?.rating ?? 0), 0, 100);
  return {
    rating,
    tier: tierFromRating(rating),
    // elo is server-only: always inherit the existing value, never the client's.
    ...(existing?.elo !== undefined ? { elo: existing.elo } : {}),
    matchesPlayed: Number(existing?.matchesPlayed ?? incoming?.matchesPlayed ?? 0),
    wins: Number(existing?.wins ?? incoming?.wins ?? 0),
    losses: Number(existing?.losses ?? incoming?.losses ?? 0),
    initialSource: incoming?.initialSource ?? existing?.initialSource,
    initialRating:
      incoming?.initialRating !== undefined
        ? clampNumber(Number(incoming.initialRating), 0, 100)
        : existing?.initialRating,
    lastMatchDate: existing?.lastMatchDate ?? incoming?.lastMatchDate ?? null,
    lastUpdated: Date.now(),
  };
}

function sanitizeSkillScoresUpdate(
  existingScores: Record<string, any> | undefined,
  incomingScores: Record<string, any> | undefined,
): Record<string, any> {
  const base = (existingScores || {}) as Record<string, any>;
  if (!incomingScores || typeof incomingScores !== "object") return base;
  const merged: Record<string, any> = { ...base };
  for (const [game, score] of Object.entries(incomingScores)) {
    merged[game] = sanitizeIncomingSkillScore(score, base[game]);
  }
  return merged;
}

function hasSkillMatchHistory(score: any): boolean {
  return Number(score?.matchesPlayed || 0) > 0 || Boolean(score?.lastMatchDate);
}

function buildExternalCalibratedSkillScore(
  game: "cs2" | "fc26" | "tekken8",
  profile: Record<string, any>,
  existing: any,
  now: number,
) {
  if (hasSkillMatchHistory(existing)) return null;

  let rating: number | null = null;
  let initialSource: string | null = null;

  if (game === "cs2" && typeof profile.faceitSkillLevel === "number" && profile.faceitSkillLevel > 0) {
    const level = profile.faceitSkillLevel;
    if (level <= 3) rating = 25;
    else if (level <= 6) rating = 50;
    else if (level <= 8) rating = 75;
    else rating = 90;
    initialSource = "faceit";

    const steamHours = Number(profile.steamCs2Hours || 0);
    if (steamHours > 3000) rating += 10;
    else if (steamHours > 1000) rating += 5;
  }

  if (game === "fc26") {
    const psnProgress = profile.psnStats?.fc?.progress;
    if (typeof psnProgress === "number") {
      rating = 20 + psnProgress * 0.6;
      initialSource = "psn";
    }
    const steamHours = Number(profile.steamFc26Hours || 0);
    if (steamHours > 500) {
      rating = Math.max(rating ?? 0, 70);
      initialSource = initialSource || "steam";
    } else if (steamHours > 200) {
      rating = Math.max(rating ?? 0, 50);
      initialSource = initialSource || "steam";
    }
  }

  if (game === "tekken8") {
    const psnProgress = profile.psnStats?.tekken8?.progress;
    if (typeof psnProgress === "number") {
      rating = 20 + psnProgress * 0.6;
      initialSource = "psn";
    }
  }

  if (rating === null || !initialSource) return null;

  const normalizedRating = clampNumber(rating, 0, 100);
  return {
    ...(existing || {}),
    rating: normalizedRating,
    tier: tierFromRating(normalizedRating),
    matchesPlayed: Number(existing?.matchesPlayed || 0),
    wins: Number(existing?.wins || 0),
    losses: Number(existing?.losses || 0),
    initialSource,
    initialRating: normalizedRating,
    lastMatchDate: existing?.lastMatchDate ?? null,
    lastUpdated: now,
  };
}

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function normalizePhone(phone: string) {
  const trimmed = String(phone || "").trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.startsWith("00")) {
    return `+${digits.slice(2)}`;
  }
  if (digits.startsWith("92")) {
    return `+${digits}`;
  }
  if (digits.startsWith("0")) {
    return `+92${digits.slice(1)}`;
  }
  return `+${digits}`;
}

function normalizeUsername(username: string) {
  return String(username || "").trim().toLowerCase();
}

async function sha256(value: string) {
  const input = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================
// QUERIES
// ============================================

// Get user by ID
export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<any> => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    const actor = await getCurrentUser(ctx);
    if (actor.user && String(actor.user._id) === String(user._id)) return user;
    return publicUser(user);
  },
});

// Get user by ID if the target is publicly visible to the viewer
export const getPublicById = query({
  args: {
    userId: v.id("users"),
    viewerUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args): Promise<any> => {
    const target = await ctx.db.get(args.userId);
    if (!target) return null;

    const actor = await getCurrentUser(ctx);
    const viewer = actor.user || null;
    if (!canViewerAccessPublicUser(viewer, target)) {
      return null;
    }

    if (viewer && String(viewer._id) === String(target._id)) return target;
    return publicUser(target);
  },
});

// Get user by email
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args): Promise<any> => {
    const actor = await getCurrentUser(ctx);
    if (!actor.user) return null;
    if (normalizeEmail(actor.user.email) !== normalizeEmail(args.email)) return null;
    return actor.user;
  },
});

// Get user by username
export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args): Promise<any> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_usernameLower", (q) =>
        q.eq("usernameLower", normalizeUsername(args.username))
      )
      .unique();
    if (!user) return null;
    // Super Admin / hidden accounts are not exposed via public username lookup.
    const actor = await getCurrentUser(ctx);
    if (!canViewerAccessPublicUser(actor.user || null, user)) return null;
    if (actor.user && String(actor.user._id) === String(user._id)) return user;
    return publicUser(user);
  },
});

// Get user by Steam ID
export const getBySteamId = query({
  args: { steamId: v.string() },
  handler: async (ctx, args): Promise<any> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_steamId", (q) => q.eq("steamId", args.steamId))
      .unique();
    if (user?.hidePlatformsPublicly) return null;
    return publicUser(user);
  },
});

// Get user by PSN Account ID
export const getByPsnAccountId = query({
  args: { psnAccountId: v.string() },
  handler: async (ctx, args): Promise<any> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_psnAccountId", (q) => q.eq("psnAccountId", args.psnAccountId))
      .unique();
    if (user?.hidePlatformsPublicly) return null;
    return publicUser(user);
  },
});

// Get user by Better Auth ID
export const getByAuthId = query({
  args: { authId: v.string() },
  handler: async (ctx, args): Promise<any> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();
    if (!user) return null;
    const actor = await getCurrentUser(ctx);
    if (actor.user && String(actor.user._id) === String(user._id)) return user;
    if (actor.candidateAuthIds.includes(args.authId)) return user;
    return publicUser(user);
  },
});

export const getCurrentRegistrationState = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireCurrentUser(ctx);
    return {
      userId: user._id,
      onboardingStep: user.onboardingStep ?? 0,
      onboardingCompleted: user.onboardingCompleted ?? false,
    };
  },
});

// ============================================
// AVAILABILITY CHECKS
// ============================================

export const isUsernameAvailable = query({
  args: { username: v.string(), excludeUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const trimmed = normalizeUsername(args.username);
    if (!trimmed) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_usernameLower", (q) => q.eq("usernameLower", trimmed))
      .unique();

    if (!existing) return true;
    if (args.excludeUserId && existing._id === args.excludeUserId) return true;
    return false;
  },
});

export const isEmailAvailable = query({
  args: { email: v.string(), excludeUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const trimmed = normalizeEmail(args.email);
    if (!trimmed) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", trimmed))
      .unique();

    if (!existing) return true;
    if (args.excludeUserId && existing._id === args.excludeUserId) return true;
    return false;
  },
});

export const isPhoneAvailable = query({
  args: { phone: v.string(), excludeUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const normalized = normalizePhone(args.phone);
    if (!normalized) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", normalized))
      .unique();

    if (!existing) return true;
    if (args.excludeUserId && existing._id === args.excludeUserId) return true;
    return false;
  },
});

export const validateRegistrationIdentity = action({
  args: {
    email: v.string(),
    phone: v.string(),
    username: v.optional(v.union(v.string(), v.null())),
    accountType: v.union(v.literal("player"), v.literal("zone")),
  },
  handler: async (ctx, args): Promise<{
    email: string;
    phone: string;
    username: string | null;
    usernameLower: string | null;
    phoneValidated: true;
    phoneValidationProvider: string;
    phoneValidationCheckedAt: number;
    phoneType: string | null;
    phoneOtpVerified?: boolean;
    phoneOtpVerifiedAt?: number;
    phoneNumberMasked?: string;
    phoneNumberHash?: string;
  }> => {
    const rejectRegistration = (code: string, message: string): never => {
      throw new ConvexError({ code, message });
    };
    const email = normalizeEmail(args.email);
    const phone = normalizePhone(args.phone);
    const username = args.username ? String(args.username).trim() : "";
    const usernameLower = username ? normalizeUsername(username) : "";

    if (!email) rejectRegistration("EMAIL_REQUIRED", "Email is required.");
    if (!phone) rejectRegistration("PHONE_REQUIRED", "Phone number is required.");
    if (args.accountType === "player" && !username) {
      rejectRegistration("USERNAME_REQUIRED", "Username is required.");
    }

    const [emailAvailable, phoneAvailable, usernameAvailable] = await Promise.all([
      ctx.runQuery(api.users.isEmailAvailable, { email }),
      ctx.runQuery(api.users.isPhoneAvailable, { phone }),
      username
        ? ctx.runQuery(api.users.isUsernameAvailable, { username })
        : Promise.resolve(true),
    ]);

    if (!emailAvailable) rejectRegistration("EMAIL_ALREADY_REGISTERED", "This email is already registered.");
    if (!phoneAvailable) rejectRegistration("PHONE_ALREADY_REGISTERED", "This phone number is already registered.");
    if (!usernameAvailable) rejectRegistration("USERNAME_ALREADY_REGISTERED", "This username is already in use.");

    let phoneOtpVerified = false;
    let phoneOtpVerifiedAt: number | undefined;
    let phoneNumberMasked: string | undefined;
    let phoneNumberHash: string | undefined;
    if (args.accountType === "player") {
      const phoneHash = await sha256(phone);
      const skipOtp = String(process.env.SKIP_PHONE_OTP || "").trim() === "1";

      if (skipOtp) {
        phoneOtpVerified = true;
        phoneOtpVerifiedAt = Date.now();
        phoneNumberMasked = phone;
        phoneNumberHash = phoneHash;
      } else {
        const verified: {
          phoneMasked: string;
          updatedAt: number;
        } | null = await ctx.runQuery(internal.phoneOtp.getRecentVerified, {
          phoneHash,
          since: Date.now() - 24 * 60 * 60 * 1000,
        });

        if (!verified) {
          return rejectRegistration("PHONE_VERIFICATION_REQUIRED", "Please verify your phone number again before creating your account.");
        }
        phoneOtpVerified = true;
        phoneOtpVerifiedAt = verified.updatedAt;
        phoneNumberMasked = verified.phoneMasked;
        phoneNumberHash = phoneHash;
      }
    }

    let validation: any;
    try {
      validation = await ctx.runAction(api.externalApis.validatePhoneNumber, {
        phone,
        countryCode: "PK",
      });
    } catch {
      rejectRegistration(
        "PHONE_VALIDATION_UNAVAILABLE",
        "Phone validation is temporarily unavailable. Please try again shortly.",
      );
    }

    if (!validation.valid) {
      rejectRegistration("INVALID_PHONE", "Please enter a valid phone number.");
    }

    return {
      email,
      phone: validation.formats?.E164 || phone,
      username: username || null,
      usernameLower: usernameLower || null,
      phoneValidated: true,
      phoneValidationProvider: "antideo",
      phoneValidationCheckedAt: Date.now(),
      phoneType: validation.type || null,
      ...(phoneOtpVerified
        ? {
            phoneOtpVerified,
            phoneOtpVerifiedAt,
            phoneNumberMasked,
            phoneNumberHash,
          }
        : {}),
    };
  },
});

export const isSteamIdAvailable = query({
  args: { steamId: v.string(), excludeUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (!args.steamId) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_steamId", (q) => q.eq("steamId", args.steamId))
      .unique();

    if (!existing) return true;
    if (args.excludeUserId && existing._id === args.excludeUserId) return true;
    return false;
  },
});

export const isPsnAccountIdAvailable = query({
  args: { psnAccountId: v.string(), excludeUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (!args.psnAccountId) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_psnAccountId", (q) => q.eq("psnAccountId", args.psnAccountId))
      .unique();

    if (!existing) return true;
    if (args.excludeUserId && existing._id === args.excludeUserId) return true;
    return false;
  },
});

export const isFaceitIdAvailable = query({
  args: { faceitId: v.string(), excludeUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (!args.faceitId) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_faceitId", (q) => q.eq("faceitId", args.faceitId))
      .unique();

    if (!existing) return true;
    if (args.excludeUserId && existing._id === args.excludeUserId) return true;
    return false;
  },
});

export const isEaIdAvailable = query({
  args: { eaId: v.string(), excludeUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (!args.eaId) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_eaId", (q) => q.eq("eaId", args.eaId))
      .unique();

    if (!existing) return true;
    if (args.excludeUserId && existing._id === args.excludeUserId) return true;
    return false;
  },
});

export const isXboxGamertagAvailable = query({
  args: { xboxGamertag: v.string(), excludeUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    if (!args.xboxGamertag) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_xboxGamertag", (q) => q.eq("xboxGamertag", args.xboxGamertag))
      .unique();

    if (!existing) return true;
    if (args.excludeUserId && existing._id === args.excludeUserId) return true;
    return false;
  },
});

async function resolveSkillScoreUser(ctx: any, rawUserId: string) {
  const userId = rawUserId.trim();
  if (!userId) return null;

  try {
    const directUser = await ctx.db.get(userId as Id<"users">);
    if (directUser) return directUser;
  } catch {}

  return await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", userId))
    .unique();
}

export const getSkillScores = query({
  args: {
    userIds: v.array(v.string()),
    game: v.string(),
  },
  handler: async (ctx, args) => {
    const results: Record<string, { rating: number; tier: string; wins: number; losses: number } | null> = {};

    await Promise.all(
      args.userIds.map(async (rawUserId) => {
        const userId = rawUserId.trim();
        if (!userId) return;
        const user = await resolveSkillScoreUser(ctx, userId);
        if (user && user.skillScores) {
          const scores = user.skillScores as Record<string, { rating: number; tier: string; matchesPlayed: number; wins: number; losses: number; lastUpdated: number } | undefined>;
          const gameScore = scores[args.game];
          if (gameScore) {
            results[userId] = {
              rating: gameScore.rating,
              tier: gameScore.tier,
              wins: gameScore.wins,
              losses: gameScore.losses,
            };
          } else {
            results[userId] = null;
          }
        } else {
          results[userId] = null;
        }
      })
    );

    return results;
  },
});

// Get list of users by IDs with basic profile info
export const getMany = query({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const users = await Promise.all(
      args.userIds.map(async (id) => {
        const user = await ctx.db.get(id);
        if (!user) return null;
        return {
          _id: user._id,
          uid: user._id, // alias for compatibility
          username: user.username,
          fullName: user.fullName,
          photoURL: user.photoURL,
          isOnline: user.isOnline,
          skillScores: user.skillScores,
        };
      })
    );
    return users.filter((u) => u !== null);
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create a new user (called after auth signup)
export const create = mutation({
  args: {
    authId: v.optional(v.string()),
    email: v.string(),
    fullName: v.union(v.string(), v.null()),
    username: v.union(v.string(), v.null()),
    usernameLower: v.union(v.string(), v.null()),
    phone: v.union(v.string(), v.null()),
    phoneValidated: v.optional(v.boolean()),
    phoneValidationProvider: v.optional(v.string()),
    phoneValidationCheckedAt: v.optional(v.number()),
    phoneOtpVerified: v.optional(v.boolean()),
    phoneOtpVerifiedAt: v.optional(v.number()),
    phoneNumberMasked: v.optional(v.string()),
    phoneNumberHash: v.optional(v.string()),
    city: v.optional(v.string()),
    ageRange: v.optional(v.string()),
    accountType: v.union(v.literal("player"), v.literal("zone")),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const now = Date.now();

    const email = normalizeEmail(args.email);
    const normalizedPhone = args.phone ? normalizePhone(args.phone) : undefined;
    const authUser = await authComponent.getAuthUser(ctx);
    const requestedAuthId = String(args.authId || "").trim();
    const candidateAuthIds = [
      authUser?.userId,
      (authUser as any)?.id,
      authUser?._id,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    if (
      !authUser
      || !requestedAuthId
      || !candidateAuthIds.includes(requestedAuthId)
      || normalizeEmail(authUser.email) !== email
    ) {
      throw new Error("Authenticated account does not match profile creation request.");
    }

    let verifiedPhoneHash: string | undefined;
    let verifiedPhone: { phoneMasked: string; updatedAt: number } | null = null;
    if (normalizedPhone && args.accountType === "player") {
      verifiedPhoneHash = await sha256(normalizedPhone);
      if (String(process.env.SKIP_PHONE_OTP || "").trim() === "1") {
        verifiedPhone = { phoneMasked: normalizedPhone, updatedAt: now };
      } else {
        verifiedPhone = await ctx.runQuery(internal.phoneOtp.getRecentVerified, {
          phoneHash: verifiedPhoneHash,
          since: now - 24 * 60 * 60 * 1000,
        });
      }
      if (!verifiedPhone) {
        throw new Error("Please verify this phone number again before creating your profile.");
      }
    }

    // Generate username if not provided
    const username = args.username || `user_${Date.now()}`;
    const usernameLower = args.usernameLower || normalizeUsername(username);

    const [existingEmail, existingPhone, existingUsername] = await Promise.all([
      ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique(),
      normalizedPhone
        ? ctx.db
            .query("users")
            .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
            .unique()
        : Promise.resolve(null),
      usernameLower
        ? ctx.db
            .query("users")
            .withIndex("by_usernameLower", (q) => q.eq("usernameLower", usernameLower))
            .unique()
        : Promise.resolve(null),
    ]);

    if (existingEmail) throw new Error("This email is already registered.");
    if (existingPhone) throw new Error("This phone number is already registered.");
    if (existingUsername) throw new Error("This username is already in use.");

    const insertData: Record<string, unknown> = {
      authId: requestedAuthId,
      email,
      fullName: args.fullName || "User",
      username,
      usernameLower,
      phone: normalizedPhone,
      phoneValidated: args.phoneValidated ?? false,
      phoneValidationProvider: args.phoneValidationProvider,
      phoneValidationCheckedAt: args.phoneValidationCheckedAt,
      phoneOtpVerified: Boolean(verifiedPhone),
      phoneOtpVerifiedAt: verifiedPhone?.updatedAt,
      phoneNumberMasked: verifiedPhone?.phoneMasked,
      phoneNumberHash: verifiedPhoneHash,
      accountType: args.accountType,
      isOnline: true,
      lastActiveAt: now,
      onboardingCompleted: false,
      onboardingStep: 1,
      kycVerificationStatus: "not_started",
      createdAt: now,
      updatedAt: now,
    };

    // Only include city and ageRange if provided
    if (args.city) insertData.city = args.city;
    if (args.ageRange) insertData.ageRange = args.ageRange;

    const userId = await ctx.db.insert("users", insertData as any);

    if (verifiedPhone && normalizedPhone) {
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", operator: "eq", value: requestedAuthId }],
          update: {
            phoneNumber: normalizedPhone,
            phoneNumberVerified: true,
            updatedAt: now,
          },
        },
      });
    }

    return userId;
  },
});

// Update user profile
export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    fullName: v.optional(v.string()),
    username: v.optional(v.string()),
    bio: v.optional(v.string()),
    photoURL: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    const now = Date.now();
    const user = await requireProfileOwner(ctx, userId);
    if (!user) throw new Error("User not found");

    const updateData: Record<string, unknown> = { updatedAt: now };

    if (updates.fullName !== undefined) {
      updateData.fullName = updates.fullName;
    }
    if (updates.username !== undefined) {
      const nextUsername = String(updates.username).trim();
      const nextUsernameLower = normalizeUsername(nextUsername);
      const existing = await ctx.db
        .query("users")
        .withIndex("by_usernameLower", (q) => q.eq("usernameLower", nextUsernameLower))
        .unique();

      if (existing && existing._id !== userId) {
        throw new Error("This username is already in use.");
      }

      updateData.username = nextUsername;
      updateData.usernameLower = nextUsernameLower;
    }
    if (updates.bio !== undefined) {
      updateData.bio = updates.bio;
    }
    if (updates.photoURL !== undefined) {
      updateData.photoURL = updates.photoURL;
    }

    await ctx.db.patch(userId, updateData);
    return true;
  },
});

// Update platform links (Steam, FACEIT, PSN)
export const updatePlatformLinks = mutation({
  args: {
    userId: v.id("users"),
    steamId: v.optional(v.string()),
    steamStats: v.optional(v.any()),
    steamPersonaName: v.optional(v.union(v.string(), v.null())),
    steamCs2Hours: v.optional(v.union(v.number(), v.null())),
    steamLastSyncedAt: v.optional(v.number()),
    faceitId: v.optional(v.string()),
    faceitStats: v.optional(v.any()),
    faceitElo: v.optional(v.union(v.number(), v.null())),
    faceitSkillLevel: v.optional(v.union(v.number(), v.null())),
    faceitNickname: v.optional(v.union(v.string(), v.null())),
    faceitGame: v.optional(v.union(v.string(), v.null())),
    faceitLastSyncedAt: v.optional(v.number()),
    psnAccountId: v.optional(v.string()),
    psnOnlineId: v.optional(v.string()),
    psnStats: v.optional(v.any()),
    lastExternalSyncAt: v.optional(v.number()),
    psnLastSyncedAt: v.optional(v.number()),
    skillScores: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    const user = await requireProfileOwner(ctx, userId);
    const now = Date.now();

    const updateData: Record<string, unknown> = { updatedAt: now };

    if (updates.steamId !== undefined) updateData.steamId = updates.steamId;
    if (updates.steamStats !== undefined) updateData.steamStats = updates.steamStats;
    if (updates.steamPersonaName !== undefined) updateData.steamPersonaName = updates.steamPersonaName;
    if (updates.steamCs2Hours !== undefined) updateData.steamCs2Hours = updates.steamCs2Hours;
    if (updates.steamLastSyncedAt !== undefined) updateData.steamLastSyncedAt = updates.steamLastSyncedAt;
    if (updates.faceitId !== undefined) updateData.faceitId = updates.faceitId;
    if (updates.faceitStats !== undefined) updateData.faceitStats = updates.faceitStats;
    if (updates.faceitElo !== undefined) updateData.faceitElo = updates.faceitElo;
    if (updates.faceitSkillLevel !== undefined) updateData.faceitSkillLevel = updates.faceitSkillLevel;
    if (updates.faceitNickname !== undefined) updateData.faceitNickname = updates.faceitNickname;
    if (updates.faceitGame !== undefined) updateData.faceitGame = updates.faceitGame;
    if (updates.faceitLastSyncedAt !== undefined) updateData.faceitLastSyncedAt = updates.faceitLastSyncedAt;
    if (updates.psnAccountId !== undefined) updateData.psnAccountId = updates.psnAccountId;
    if (updates.psnOnlineId !== undefined) updateData.psnOnlineId = updates.psnOnlineId;
    if (updates.psnStats !== undefined) updateData.psnStats = updates.psnStats;
    if (updates.lastExternalSyncAt !== undefined) updateData.lastExternalSyncAt = updates.lastExternalSyncAt;
    if (updates.psnLastSyncedAt !== undefined) updateData.psnLastSyncedAt = updates.psnLastSyncedAt;
    if (updates.skillScores !== undefined) {
      updateData.skillScores = sanitizeSkillScoresUpdate(
        (user.skillScores || {}) as Record<string, any>,
        updates.skillScores as Record<string, any>,
      );
    }

    await ctx.db.patch(userId, updateData);
    return true;
  },
});

const EXTERNAL_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

// Authorizes an external-stats refresh: owner-only, or super admin. Used by the
// refreshExternalStats action (actions cannot touch ctx.db / auth-derived lookups
// directly, so the check runs as a query).
export const assertCanRefreshStats = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<null> => {
    await requireSelfOrSuperAdmin(ctx, args.userId);
    return null;
  },
});

export const refreshExternalStats = action({
  args: {
    userId: v.id("users"),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    refreshed: string[];
    throttled: boolean;
    errors: Array<{ platform: string; message: string }>;
    updates: Record<string, unknown>;
  }> => {
    // Only the account owner (or a super admin) may trigger an external sync.
    // The previous guard compared the *target* doc id to itself and never checked
    // the caller, so any authenticated viewer could drive external provider calls
    // against another user's linked accounts. Cooldown below still rate-limits.
    await ctx.runQuery(internal.users.assertCanRefreshStats, { userId: args.userId });
    const user = await ctx.runQuery(api.users.getById, { userId: args.userId });
    if (!user) throw new Error("User not found");

    const now = Date.now();
    const lastSync = Number((user as any).lastExternalSyncAt || 0);
    if (!args.force && lastSync && now - lastSync < EXTERNAL_SYNC_COOLDOWN_MS) {
      return {
        refreshed: [],
        throttled: true,
        errors: [],
        updates: {},
      };
    }

    const updates: Record<string, unknown> = {};
    const refreshed: string[] = [];
    const errors: Array<{ platform: string; message: string }> = [];

    const steamLookup = String((user as any).steamProfileUrl || (user as any).steamId || "").trim();
    if (steamLookup) {
      try {
        const steamRes: any = await ctx.runAction(api.externalApis.fetchSteamProfile, {
          url: steamLookup,
        });
        if (steamRes) {
          updates.steamStats = steamRes;
          if (steamRes.personaName !== undefined) updates.steamPersonaName = steamRes.personaName || null;
          if (steamRes.cs2Hours !== undefined) updates.steamCs2Hours = steamRes.cs2Hours ?? null;
          updates.steamLastSyncedAt = now;
          refreshed.push("Steam");
        }
      } catch (error: any) {
        errors.push({ platform: "Steam", message: error?.message || "Steam refresh failed" });
      }
    }

    const faceitLookup = String(
      (user as any).faceitProfileUrl || (user as any).faceitNickname || "",
    ).trim();
    if (faceitLookup) {
      try {
        const faceitRes: any = await ctx.runAction(api.externalApis.fetchFaceitProfile, {
          value: faceitLookup,
          game: (user as any).faceitGame || "cs2",
        });
        if (faceitRes) {
          updates.faceitStats = faceitRes;
          if (faceitRes.faceitId !== undefined) updates.faceitId = faceitRes.faceitId;
          if (faceitRes.elo !== undefined) updates.faceitElo = faceitRes.elo ?? null;
          if (faceitRes.skillLevel !== undefined) updates.faceitSkillLevel = faceitRes.skillLevel ?? null;
          if (faceitRes.nickname !== undefined) updates.faceitNickname = faceitRes.nickname || null;
          if (faceitRes.game !== undefined) updates.faceitGame = faceitRes.game || "cs2";
          updates.faceitLastSyncedAt = now;
          refreshed.push("FACEIT");
        }
      } catch (error: any) {
        errors.push({ platform: "FACEIT", message: error?.message || "FACEIT refresh failed" });
      }
    }

    const psnOnlineId = String(
      (user as any).psnStats?.psnOnlineId || (user as any).psnOnlineId || "",
    ).trim();
    if (psnOnlineId) {
      try {
        const psnRes: any = await ctx.runAction(api.externalApis.verifyPsnProfile, {
          psnOnlineId,
          wantsTekken: !!(user as any).playsTekken,
          wantsFc: !!(user as any).playsFc,
        });
        if (psnRes) {
          updates.psnStats = psnRes;
          if (psnRes.psnAccountId !== undefined) updates.psnAccountId = psnRes.psnAccountId || null;
          if (psnRes.psnOnlineId !== undefined) updates.psnOnlineId = psnRes.psnOnlineId || null;
          updates.psnLastSyncedAt = now;
          refreshed.push("PSN");
        }
      } catch (error: any) {
        errors.push({ platform: "PSN", message: error?.message || "PSN refresh failed" });
      }
    }

    if (refreshed.length > 0) {
      updates.lastExternalSyncAt = now;
      const existingScores = ((user as any).skillScores || {}) as Record<string, any>;
      const profileAfterRefresh = { ...(user as any), ...updates };
      const refreshedSkillScores: Record<string, any> = {};

      if ((user as any).playsCs2) {
        const calibrated = buildExternalCalibratedSkillScore(
          "cs2",
          profileAfterRefresh,
          existingScores.cs2,
          now,
        );
        if (calibrated) refreshedSkillScores.cs2 = calibrated;
      }
      if ((user as any).playsFc) {
        const calibrated = buildExternalCalibratedSkillScore(
          "fc26",
          profileAfterRefresh,
          existingScores.fc26 || existingScores.fc25,
          now,
        );
        if (calibrated) refreshedSkillScores.fc26 = calibrated;
      }
      if ((user as any).playsTekken) {
        const calibrated = buildExternalCalibratedSkillScore(
          "tekken8",
          profileAfterRefresh,
          existingScores.tekken8 || existingScores.tekken,
          now,
        );
        if (calibrated) refreshedSkillScores.tekken8 = calibrated;
      }

      if (Object.keys(refreshedSkillScores).length > 0) {
        updates.skillScores = {
          ...existingScores,
          ...refreshedSkillScores,
        };
      }

      await ctx.runMutation(api.users.updatePlatformLinks, {
        userId: args.userId,
        ...updates,
      });
    }

    return {
      refreshed,
      throttled: false,
      errors,
      updates,
    };
  },
});

// Update skill scores
export const updateSkillScores = mutation({
  args: {
    userId: v.id("users"),
    game: v.union(
      v.literal("cs2"),
      v.literal("cs16"),
      v.literal("valorant"),
      v.literal("tekken"),
      v.literal("tekken8"),
      v.literal("futsal"),
      v.literal("cricket"),
      v.literal("indoor_cricket"),
      v.literal("fc25"),
      v.literal("fc26"),
      v.literal("padel"),
      v.literal("pickleball")
    ),
    skillScore: v.object({
      rating: v.number(),
      tier: v.string(),
      matchesPlayed: v.number(),
      wins: v.number(),
      losses: v.number(),
      initialSource: v.optional(v.string()),
      initialRating: v.optional(v.number()),
      lastMatchDate: v.optional(v.union(v.number(), v.null())),
      lastUpdated: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    // Self-only: a client can never write another user's skill rating.
    const user = await requireProfileOwner(ctx, args.userId);

    const currentScores = (user.skillScores || {}) as Record<string, any>;
    // Server-side validation/clamping; preserves server-managed elo + W/L.
    const sanitized = sanitizeIncomingSkillScore(args.skillScore, currentScores[args.game]);
    const updatedScores = {
      ...currentScores,
      [args.game]: sanitized,
    };

    await ctx.db.patch(args.userId, {
      skillScores: updatedScores,
      updatedAt: Date.now(),
    });

    return true;
  },
});

// NOTE: The former client-callable `applyMatchSkillUpdates` batch mutation was
// removed. It allowed any client to set any user's rating with no auth, no
// validation and no idempotency. Match-result ELO is now computed and applied
// entirely server-side inside convex/matchrooms.ts `finalizeMatchroomResult`
// (see applyRatingsForFinalizedMatch) using convex/ratingEngine.ts, guarded by a
// per-matchroom idempotency marker and recorded in the `ratingHistory` ledger.

// Mark onboarding as completed
export const completeOnboarding = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireProfileOwner(ctx, args.userId);
    await ctx.db.patch(args.userId, {
      onboardingCompleted: true,
      onboardingStep: 4,
      updatedAt: Date.now(),
    });
    return true;
  },
});

// Update online status
export const updateOnlineStatus = mutation({
  args: {
    userId: v.id("users"),
    isOnline: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireProfileOwner(ctx, args.userId);
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      isOnline: args.isOnline,
      ...(args.isOnline ? { lastActiveAt: now } : {}),
      updatedAt: now,
    });
    return true;
  },
});

export const touchPresence = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireCurrentUser(ctx);
    if (!user) return;
    await markUserPresent(ctx, user._id);
  },
});

export const goOffline = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireCurrentUser(ctx);
    if (!user) return;
    await ctx.db.patch(user._id, { isOnline: false });
  },
});

// Save onboarding step 2 - Location & Game Preferences
export const saveOnboardingStep2 = mutation({
  args: {
    userId: v.id("users"),
    areasPreferred: v.array(v.string()),
    playsCs2: v.boolean(),
    cs2Role: v.optional(v.union(v.string(), v.null())),
    playsCs16: v.boolean(),
    cs16Role: v.optional(v.union(v.string(), v.null())),
    playsValorant: v.optional(v.boolean()),
    valorantRole: v.optional(v.union(v.string(), v.null())),
    valorantAgent: v.optional(v.union(v.string(), v.null())),
    playsFc: v.boolean(),
    fcTeam: v.optional(v.union(v.string(), v.null())),
    fcFormation: v.optional(v.union(v.string(), v.null())),
    playsTekken: v.boolean(),
    tekkenFavorites: v.array(v.string()),
    playsFutsal: v.optional(v.boolean()),
    playsIndoorCricket: v.optional(v.boolean()),
    playsPadel: v.optional(v.boolean()),
    playsPickleball: v.optional(v.boolean()),
    futsalPositions: v.optional(v.array(v.string())),
    indoorCricketRole: v.optional(v.union(v.string(), v.null())),
    indoorCricketBowlingStyle: v.optional(v.union(v.string(), v.null())),
    indoorCricketBattingStyle: v.optional(v.union(v.string(), v.null())),
    padelRole: v.optional(v.union(v.string(), v.null())),
    pickleballRole: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const { userId, ...prefs } = args;
    await requireProfileOwner(ctx, userId);

    // Build update object, converting null to undefined for schema compatibility
    const updateData: Record<string, unknown> = {
      areasPreferred: prefs.areasPreferred,
      playsCs2: prefs.playsCs2,
      playsCs16: prefs.playsCs16,
      playsValorant: prefs.playsValorant ?? false,
      playsFc: prefs.playsFc,
      playsTekken: prefs.playsTekken,
      tekkenFavorites: prefs.tekkenFavorites,
      onboardingStep: 2,
      updatedAt: Date.now(),
    };

    // Only include string fields if they have a value (not null)
    if (prefs.cs2Role) updateData.cs2Role = prefs.cs2Role;
    if (prefs.cs16Role) updateData.cs16Role = prefs.cs16Role;
    if (prefs.valorantRole) updateData.valorantRole = prefs.valorantRole;
    if (prefs.valorantAgent) updateData.valorantAgent = prefs.valorantAgent;
    if (prefs.fcTeam) updateData.fcTeam = prefs.fcTeam;
    if (prefs.fcFormation) updateData.fcFormation = prefs.fcFormation;

    // Sports fields
    if (prefs.playsFutsal !== undefined) updateData.playsFutsal = prefs.playsFutsal;
    if (prefs.playsIndoorCricket !== undefined) updateData.playsIndoorCricket = prefs.playsIndoorCricket;
    if (prefs.playsPadel !== undefined) updateData.playsPadel = prefs.playsPadel;
    if (prefs.playsPickleball !== undefined) updateData.playsPickleball = prefs.playsPickleball;

    // Futsal positions
    const futsalPositions = Array.isArray(prefs.futsalPositions)
      ? prefs.futsalPositions.filter(Boolean)
      : [];
    if (futsalPositions.length > 0) {
      updateData.futsalPositions = futsalPositions;
      updateData.futsalPosition = futsalPositions[0];
    }

    // Only include role fields if they have a value
    if (prefs.indoorCricketRole) updateData.indoorCricketRole = prefs.indoorCricketRole;
    if (prefs.indoorCricketBowlingStyle) updateData.indoorCricketBowlingStyle = prefs.indoorCricketBowlingStyle;
    if (prefs.indoorCricketBattingStyle) updateData.indoorCricketBattingStyle = prefs.indoorCricketBattingStyle;
    if (prefs.padelRole) updateData.padelRole = prefs.padelRole;
    if (prefs.pickleballRole) updateData.pickleballRole = prefs.pickleballRole;

    await ctx.db.patch(userId, updateData as any);

    return true;
  },
});

// Save onboarding step 3 - Platform profile links
export const saveOnboardingStep3 = mutation({
  args: {
    userId: v.id("users"),
    steamProfileUrl: v.optional(v.union(v.string(), v.null())),
    faceitProfileUrl: v.optional(v.union(v.string(), v.null())),
    eaProfileUrl: v.optional(v.union(v.string(), v.null())),
    xboxGamertag: v.optional(v.union(v.string(), v.null())),
    psnOnlineId: v.optional(v.union(v.string(), v.null())),
    steamProfile: v.optional(v.any()),
    faceitProfile: v.optional(v.any()),
    psnProfile: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { userId, steamProfile, faceitProfile, psnProfile, ...urls } = args;
    await requireProfileOwner(ctx, userId);

    const updateData: Record<string, unknown> = {
      onboardingStep: 3,
      updatedAt: Date.now(),
    };

    // Only include URL fields if they have a value (not null/empty)
    if (urls.steamProfileUrl) updateData.steamProfileUrl = urls.steamProfileUrl;
    if (urls.faceitProfileUrl) updateData.faceitProfileUrl = urls.faceitProfileUrl;
    if (urls.eaProfileUrl) updateData.eaProfileUrl = urls.eaProfileUrl;
    if (urls.xboxGamertag) updateData.xboxGamertag = urls.xboxGamertag;
    if (urls.psnOnlineId) updateData.psnOnlineId = urls.psnOnlineId;

    // Flatten Steam profile
    if (steamProfile) {
      if (steamProfile.steamId) updateData.steamId = steamProfile.steamId;
      if (steamProfile.personaName) updateData.steamPersonaName = steamProfile.personaName;
      if (steamProfile.cs2Hours != null) updateData.steamCs2Hours = steamProfile.cs2Hours;
      updateData.steamStats = steamProfile;
    }

    // Flatten FACEIT profile
    if (faceitProfile) {
      if (faceitProfile.faceitId) updateData.faceitId = faceitProfile.faceitId;
      if (faceitProfile.nickname) updateData.faceitNickname = faceitProfile.nickname;
      if (faceitProfile.game) updateData.faceitGame = faceitProfile.game;
      if (faceitProfile.elo != null) updateData.faceitElo = faceitProfile.elo;
      if (faceitProfile.skillLevel != null) updateData.faceitSkillLevel = faceitProfile.skillLevel;
      updateData.faceitStats = faceitProfile;
    }

    // Flatten PSN profile
    if (psnProfile) {
      if (psnProfile.psnAccountId) updateData.psnAccountId = psnProfile.psnAccountId;
      if (psnProfile.psnOnlineId) updateData.psnOnlineId = psnProfile.psnOnlineId;
      updateData.psnStats = psnProfile;
    }

    await ctx.db.patch(userId, updateData as any);

    return true;
  },
});

// List players (users with accountType === "player")
export const listPlayers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_accountType", (q) => q.eq("accountType", "player"))
      .take(args.limit || 200);

    return users
      .filter((user) => !isUserHiddenFromPublic(user))
      .map((u) => ({ ...publicUser(u), id: u._id }));
  },
});

// ============================================
// INTERNAL QUERIES/MUTATIONS
// ============================================

// Update game preferences and skill scores (used by game-details page)
export const updateGamePreferences = mutation({
  args: {
    userId: v.id("users"),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    // Self-only + privilege-field denylist + skill-score sanitization.
    const user = await requireProfileOwner(ctx, args.userId);

    const safeUpdates = stripProtectedUserFields(args.updates || {});
    if (safeUpdates.skillScores !== undefined) {
      safeUpdates.skillScores = sanitizeSkillScoresUpdate(
        (user.skillScores || {}) as Record<string, any>,
        safeUpdates.skillScores,
      );
    }

    await ctx.db.patch(args.userId, {
      ...safeUpdates,
      updatedAt: Date.now(),
    });

    return true;
  },
});

// Update full profile fields (used by edit profile page)
export const updateFullProfile = mutation({
  args: {
    userId: v.id("users"),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    // Self-only + privilege-field denylist + skill-score sanitization.
    const user = await requireProfileOwner(ctx, args.userId);

    const safeUpdates = stripProtectedUserFields(args.updates || {});
    if (safeUpdates.skillScores !== undefined) {
      safeUpdates.skillScores = sanitizeSkillScoresUpdate(
        (user.skillScores || {}) as Record<string, any>,
        safeUpdates.skillScores,
      );
    }

    await ctx.db.patch(args.userId, {
      ...safeUpdates,
      updatedAt: Date.now(),
    });

    return true;
  },
});

export const internalGetByAuthId = internalQuery({
  args: { authId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();
  },
});

// Clears the forced-password-change flag for the SIGNED-IN user only. Call this
// after the auth provider (Better Auth changePassword / reset) has actually
// changed the password — it does not change the password itself, only lifts the
// in-app gate. Self-only: a caller can never clear another user's flag.
export const completeForcedPasswordChange = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireCurrentUser(ctx);
    if (!user) throw new Error("User profile not found");
    const now = Date.now();
    await ctx.db.patch(user._id, {
      mustChangePassword: false,
      passwordChangedAt: now,
      updatedAt: now,
    });
    return { ok: true };
  },
});
