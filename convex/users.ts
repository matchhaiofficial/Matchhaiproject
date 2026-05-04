import { query, mutation, action, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { canViewerAccessPublicUser, isUserHiddenFromPublic } from "./userVisibility";

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

// ============================================
// QUERIES
// ============================================

// Get user by ID
export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// Get user by ID if the target is publicly visible to the viewer
export const getPublicById = query({
  args: {
    userId: v.id("users"),
    viewerUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.userId);
    if (!target) return null;

    const viewer = args.viewerUserId ? await ctx.db.get(args.viewerUserId) : null;
    if (!canViewerAccessPublicUser(viewer, target)) {
      return null;
    }

    return target;
  },
});

// Get user by email
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizeEmail(args.email)))
      .unique();
  },
});

// Get user by username
export const getByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_usernameLower", (q) =>
        q.eq("usernameLower", normalizeUsername(args.username))
      )
      .unique();
  },
});

// Get user by phone
export const getByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    const normalized = normalizePhone(args.phone);
    return await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", normalized))
      .unique();
  },
});

// Get user by Steam ID
export const getBySteamId = query({
  args: { steamId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_steamId", (q) => q.eq("steamId", args.steamId))
      .unique();
  },
});

// Get user by PSN Account ID
export const getByPsnAccountId = query({
  args: { psnAccountId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_psnAccountId", (q) => q.eq("psnAccountId", args.psnAccountId))
      .unique();
  },
});

// Get user by Better Auth ID
export const getByAuthId = query({
  args: { authId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .unique();
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
  }> => {
    const email = normalizeEmail(args.email);
    const phone = normalizePhone(args.phone);
    const username = args.username ? String(args.username).trim() : "";
    const usernameLower = username ? normalizeUsername(username) : "";

    if (!email) throw new Error("Email is required.");
    if (!phone) throw new Error("Phone number is required.");
    if (args.accountType === "player" && !username) {
      throw new Error("Username is required.");
    }

    const [emailAvailable, phoneAvailable, usernameAvailable] = await Promise.all([
      ctx.runQuery(api.users.isEmailAvailable, { email }),
      ctx.runQuery(api.users.isPhoneAvailable, { phone }),
      username
        ? ctx.runQuery(api.users.isUsernameAvailable, { username })
        : Promise.resolve(true),
    ]);

    if (!emailAvailable) throw new Error("This email is already registered.");
    if (!phoneAvailable) throw new Error("This phone number is already registered.");
    if (!usernameAvailable) throw new Error("This username is already in use.");

    const validation: any = await ctx.runAction(api.externalApis.validatePhoneNumber, {
      phone,
      countryCode: "PK",
    });

    if (!validation.valid) {
      throw new Error("Please enter a valid phone number.");
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

// Get skill scores for multiple users (by user IDs)
export const getSkillScores = query({
  args: {
    userIds: v.array(v.id("users")),
    game: v.string(),
  },
  handler: async (ctx, args) => {
    const results: Record<string, { rating: number; tier: string; wins: number; losses: number } | null> = {};

    await Promise.all(
      args.userIds.map(async (userId) => {
        const user = await ctx.db.get(userId);
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
    city: v.optional(v.string()),
    ageRange: v.optional(v.string()),
    accountType: v.union(v.literal("player"), v.literal("zone")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const email = normalizeEmail(args.email);
    const normalizedPhone = args.phone ? normalizePhone(args.phone) : undefined;

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
      authId: args.authId,
      email,
      fullName: args.fullName || "User",
      username,
      usernameLower,
      phone: normalizedPhone,
      phoneValidated: args.phoneValidated ?? false,
      phoneValidationProvider: args.phoneValidationProvider,
      phoneValidationCheckedAt: args.phoneValidationCheckedAt,
      accountType: args.accountType,
      isOnline: true,
      onboardingCompleted: false,
      onboardingStep: 1,
      createdAt: now,
      updatedAt: now,
    };

    // Only include city and ageRange if provided
    if (args.city) insertData.city = args.city;
    if (args.ageRange) insertData.ageRange = args.ageRange;

    const userId = await ctx.db.insert("users", insertData as any);

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
    const user = await ctx.db.get(userId);
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
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
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

    await ctx.db.patch(userId, updateData);
    return true;
  },
});

const EXTERNAL_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

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

    if (refreshed.length > 0) {
      updates.lastExternalSyncAt = now;
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
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const currentScores = user.skillScores || {};
    const updatedScores = {
      ...currentScores,
      [args.game]: args.skillScore,
    };

    await ctx.db.patch(args.userId, {
      skillScores: updatedScores,
      updatedAt: Date.now(),
    });

    return true;
  },
});

// Batch update skill scores for multiple users after a match result
export const applyMatchSkillUpdates = mutation({
  args: {
    updates: v.array(
      v.object({
        userId: v.id("users"),
        game: v.string(),
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
      })
    ),
    matchroomId: v.optional(v.id("matchrooms")),
  },
  handler: async (ctx, args) => {
    // Apply each user's skill update
    for (const update of args.updates) {
      const user = await ctx.db.get(update.userId);
      if (!user) continue;

      const currentScores = (user.skillScores || {}) as Record<string, unknown>;
      const updatedScores = {
        ...currentScores,
        [update.game]: update.skillScore,
      };

      await ctx.db.patch(update.userId, {
        skillScores: updatedScores,
        updatedAt: Date.now(),
      });
    }

    // Mark match as processed if matchroomId provided
    if (args.matchroomId) {
      const match = await ctx.db.get(args.matchroomId);
      if (match) {
        await ctx.db.patch(args.matchroomId, {
          updatedAt: Date.now(),
        });
      }
    }

    return true;
  },
});

// Mark onboarding as completed
export const completeOnboarding = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
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
    await ctx.db.patch(args.userId, {
      isOnline: args.isOnline,
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const touchPresence = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) return;
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q: any) => q.eq("authId", userId.subject))
      .unique();
    if (!user) return;
    const now = Date.now();
    await ctx.db.patch(user._id, { lastActiveAt: now, isOnline: true });
  },
});

export const goOffline = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) return;
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q: any) => q.eq("authId", userId.subject))
      .unique();
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
      .map((u) => ({ ...u, id: u._id }));
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
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(args.userId, {
      ...args.updates,
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
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(args.userId, {
      ...args.updates,
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
