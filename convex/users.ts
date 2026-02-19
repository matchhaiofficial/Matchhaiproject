import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getUserByIdentity, requireUser } from "./lib/auth";

type ServerResponse =
  | { ok: true; message?: string; [key: string]: any }
  | { ok: false; message: string; [key: string]: any };

const DAY_MS = 24 * 60 * 60 * 1000;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

const DEV_WALLET_TOPUP_ENABLED =
  (process.env.DEV_WALLET_TOPUP_ENABLED || "").toLowerCase() === "true";

function normalizePhone(raw?: string | null): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function normalizeEmail(raw?: string | null): string | null {
  const trimmed = (raw ?? "").trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeUsername(raw?: string | null): { username: string | null; usernameLower: string | null } {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { username: null, usernameLower: null };
  }
  return { username: trimmed, usernameLower: trimmed.toLowerCase() };
}

function displayNameFromEmail(email?: string | null): string | null {
  if (!email) return null;
  const handle = email.split("@")[0]?.trim();
  if (!handle) return null;
  const cleaned = handle.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return handle;
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type Ctx = MutationCtx | QueryCtx;

async function assertUniqueByIndex(
  ctx: Ctx,
  indexName: string,
  field: string,
  value: string,
  excludeUid?: string | null,
  errorMessage?: string
) {
  const existing = await ctx.db
    .query("users")
    .withIndex(indexName as any, (q) => q.eq(field as any, value))
    .unique();

  if (existing && (!excludeUid || existing.uid !== excludeUid)) {
    throw new ConvexError(errorMessage || "Value already in use.");
  }
}

async function getFriendEdge(ctx: Ctx, userId: string, friendId: string) {
  return await ctx.db
    .query("userFriends")
    .withIndex("by_userId_friendId", (q) => q.eq("userId", userId).eq("friendId", friendId))
    .unique();
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await getUserByIdentity(ctx, identity);
  },
});

export const listPlayers = query({
  args: {
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 200);
    const search = String(args.search ?? "").trim();

    if (search) {
      const searchResults = await ctx.db
        .query("users")
        .withSearchIndex("search_displayName", (q) =>
          q.search("displayName", search).eq("accountType", "player"),
        )
        .take(limit);

      if (searchResults.length >= limit) {
        return searchResults;
      }

      const fallbackPool = await ctx.db
        .query("users")
        .withIndex("by_accountType", (q) => q.eq("accountType", "player"))
        .order("desc")
        .take(200);

      const searchLower = search.toLowerCase();
      const fallbackMatches = fallbackPool.filter((user) => {
        const username = String(user.username || "").toLowerCase();
        const displayName = String(user.displayName || "").toLowerCase();
        const fullName = String(user.fullName || "").toLowerCase();
        const email = String(user.email || "").toLowerCase();
        return (
          username.includes(searchLower) ||
          displayName.includes(searchLower) ||
          fullName.includes(searchLower) ||
          email.includes(searchLower)
        );
      });

      const merged = new Map<string, any>();
      searchResults.forEach((user) => merged.set(String(user._id), user));
      fallbackMatches.forEach((user) => merged.set(String(user._id), user));
      return Array.from(merged.values()).slice(0, limit);
    }

    const items = await ctx.db
      .query("users")
      .withIndex("by_accountType", (q) => q.eq("accountType", "player"))
      .order("desc")
      .take(200);

    return items.slice(0, limit);
  },
});

export const upsertCurrentUser = mutation({
  args: {
    accountType: v.optional(v.union(v.string(), v.null())),
    fullName: v.optional(v.union(v.string(), v.null())),
    displayName: v.optional(v.union(v.string(), v.null())),
    username: v.optional(v.union(v.string(), v.null())),
    phone: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    const existing = await getUserByIdentity(ctx, identity);
    const now = Date.now();

    if (existing) {
      const updates: Record<string, any> = { updatedAt: now };
      if (!existing.uid) {
        updates.uid = identity.subject;
      }
      const identityEmail = normalizeEmail(identity.email);
      if (!existing.email && identityEmail) {
        updates.email = identityEmail;
      }

      if (args.fullName !== undefined) {
        updates.fullName = args.fullName ? args.fullName.trim() : null;
      }
      if (args.displayName !== undefined) {
        updates.displayName = args.displayName ? args.displayName.trim() : null;
      } else if (!existing.displayName) {
        const fallback =
          updates.fullName ||
          existing.fullName ||
          identity.name ||
          existing.username ||
          displayNameFromEmail(identityEmail);
        if (fallback) {
          updates.displayName = String(fallback).trim();
        }
      }
      if (args.username !== undefined) {
        const { username, usernameLower } = normalizeUsername(args.username);
        if (username && !USERNAME_REGEX.test(username)) {
          throw new ConvexError("Invalid username.");
        }
        if (usernameLower) {
          await assertUniqueByIndex(ctx, "by_usernameLower", "usernameLower", usernameLower, existing.uid, "Username already taken.");
        }
        updates.username = username;
        updates.usernameLower = usernameLower;
      }
      if (args.phone !== undefined) {
        const normalized = normalizePhone(args.phone);
        if (normalized) {
          await assertUniqueByIndex(ctx, "phone", "phone", normalized, existing.uid, "Phone already in use.");
        }
        updates.phone = normalized;
      }
      if (args.accountType !== undefined) {
        updates.accountType = args.accountType ?? null;
      }

      if (Object.keys(updates).length > 1) {
        await ctx.db.patch(existing._id, updates);
      }
      return { ok: true, userId: existing._id };
    }

    const { username, usernameLower } = normalizeUsername(args.username ?? null);
    if (username && !USERNAME_REGEX.test(username)) {
      throw new ConvexError("Invalid username.");
    }
    if (usernameLower) {
      await assertUniqueByIndex(ctx, "by_usernameLower", "usernameLower", usernameLower, null, "Username already taken.");
    }

    const normalizedPhone = normalizePhone(args.phone ?? null);
    if (normalizedPhone) {
      await assertUniqueByIndex(ctx, "phone", "phone", normalizedPhone, null, "Phone already in use.");
    }

    const email = normalizeEmail(identity.email) ?? undefined;
    const fullName =
      args.fullName ? args.fullName.trim() : identity.name ?? undefined;
    const displayName =
      args.displayName && args.displayName.trim().length > 0
        ? args.displayName.trim()
        : fullName || displayNameFromEmail(email);

    const userId = await ctx.db.insert("users", {
      uid: identity.subject,
      email,
      fullName,
      displayName: displayName || undefined,
      username: username ?? undefined,
      usernameLower: usernameLower ?? undefined,
      phone: normalizedPhone ?? undefined,
      accountType: args.accountType ?? "player",
      isOnline: false,
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true, userId };
  },
});

export const isUsernameAvailable = query({
  args: { username: v.string(), excludeUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { usernameLower } = normalizeUsername(args.username);
    if (!usernameLower) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_usernameLower", (q) => q.eq("usernameLower", usernameLower))
      .unique();

    if (!existing) return true;
    if (args.excludeUid && existing.uid === args.excludeUid) return true;
    return false;
  },
});

export const isEmailAvailable = query({
  args: { email: v.string(), excludeUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();

    if (!existing) return true;
    if (args.excludeUid && existing.uid === args.excludeUid) return true;
    return false;
  },
});

export const isPhoneAvailable = query({
  args: { phone: v.string(), excludeUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const normalized = normalizePhone(args.phone);
    if (!normalized) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("phone", (q) => q.eq("phone", normalized))
      .unique();

    if (!existing) return true;
    if (args.excludeUid && existing.uid === args.excludeUid) return true;
    return false;
  },
});

export const isSteamIdAvailable = query({
  args: { steamId: v.string(), excludeUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const steamId = args.steamId.trim();
    if (!steamId) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_steamId", (q) => q.eq("steamId", steamId))
      .unique();

    if (!existing) return true;
    if (args.excludeUid && existing.uid === args.excludeUid) return true;
    return false;
  },
});

export const isFaceitIdAvailable = query({
  args: { faceitId: v.string(), excludeUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const faceitId = args.faceitId.trim();
    if (!faceitId) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_faceitId", (q) => q.eq("faceitId", faceitId))
      .unique();

    if (!existing) return true;
    if (args.excludeUid && existing.uid === args.excludeUid) return true;
    return false;
  },
});

export const isPsnIdAvailable = query({
  args: { psnAccountId: v.string(), excludeUid: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const psnAccountId = args.psnAccountId.trim();
    if (!psnAccountId) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_psnAccountId", (q) => q.eq("psnAccountId", psnAccountId))
      .unique();

    if (!existing) return true;
    if (args.excludeUid && existing.uid === args.excludeUid) return true;
    return false;
  },
});

export const updateProfile = mutation({
  args: {
    fullName: v.optional(v.union(v.string(), v.null())),
    displayName: v.optional(v.union(v.string(), v.null())),
    username: v.optional(v.union(v.string(), v.null())),
    phone: v.optional(v.union(v.string(), v.null())),
    ageRange: v.optional(v.union(v.string(), v.null())),
    pendingEmail: v.optional(v.union(v.string(), v.null())),
    city: v.optional(v.union(v.string(), v.null())),
    areasPreferred: v.optional(v.array(v.string())),
    hideAreasPublicly: v.optional(v.boolean()),
    hidePlatformsPublicly: v.optional(v.boolean()),
    restrictInvitesToFriends: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ServerResponse> => {
    const { user } = await requireUser(ctx);
    const updates: Record<string, any> = { updatedAt: Date.now() };

    if (args.fullName !== undefined) {
      updates.fullName = args.fullName ? args.fullName.trim() : null;
    }
    if (args.displayName !== undefined) {
      updates.displayName = args.displayName ? args.displayName.trim() : null;
    }
    if (args.username !== undefined) {
      const { username, usernameLower } = normalizeUsername(args.username);
      if (username && !USERNAME_REGEX.test(username)) {
        return { ok: false, message: "Invalid username format." };
      }
      if (usernameLower) {
        await assertUniqueByIndex(ctx, "by_usernameLower", "usernameLower", usernameLower, user.uid, "Username already in use.");
      }
      updates.username = username;
      updates.usernameLower = usernameLower;
    }
    if (args.phone !== undefined) {
      const normalized = normalizePhone(args.phone);
      if (normalized) {
        await assertUniqueByIndex(ctx, "phone", "phone", normalized, user.uid, "Phone already in use.");
      }
      updates.phone = normalized;
    }
    if (args.ageRange !== undefined) {
      updates.ageRange = args.ageRange ? args.ageRange.trim() : null;
    }
    if (args.pendingEmail !== undefined) {
      updates.pendingEmail = args.pendingEmail ? args.pendingEmail.trim() : null;
    }
    if (args.city !== undefined) {
      updates.city = args.city ? args.city.trim() : null;
    }
    if (args.areasPreferred !== undefined) {
      if (args.areasPreferred.length > 5) {
        return { ok: false, message: "You can select up to 5 areas." };
      }
      updates.areasPreferred = args.areasPreferred;
    }
    if (args.hideAreasPublicly !== undefined) {
      updates.hideAreasPublicly = args.hideAreasPublicly;
    }
    if (args.hidePlatformsPublicly !== undefined) {
      updates.hidePlatformsPublicly = args.hidePlatformsPublicly;
    }
    if (args.restrictInvitesToFriends !== undefined) {
      updates.restrictInvitesToFriends = args.restrictInvitesToFriends;
    }

    await ctx.db.patch(user._id, updates);
    return { ok: true };
  },
});

export const updateGamePreferences = mutation({
  args: {
    areasPreferred: v.optional(v.array(v.string())),
    playsCs2: v.optional(v.boolean()),
    cs2Role: v.optional(v.union(v.string(), v.null())),
    playsFc: v.optional(v.boolean()),
    fcTeam: v.optional(v.union(v.string(), v.null())),
    fcFormation: v.optional(v.union(v.string(), v.null())),
    playsTekken: v.optional(v.boolean()),
    tekkenFavorites: v.optional(v.array(v.string())),
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
    skillScores: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<ServerResponse> => {
    const { user } = await requireUser(ctx);
    const updates: Record<string, any> = { updatedAt: Date.now() };

    if (args.areasPreferred !== undefined) updates.areasPreferred = args.areasPreferred;
    if (args.playsCs2 !== undefined) updates.playsCs2 = args.playsCs2;
    if (args.cs2Role !== undefined) updates.cs2Role = args.cs2Role ?? null;
    if (args.playsFc !== undefined) updates.playsFc = args.playsFc;
    if (args.fcTeam !== undefined) updates.fcTeam = args.fcTeam ?? null;
    if (args.fcFormation !== undefined) updates.fcFormation = args.fcFormation ?? null;
    if (args.playsTekken !== undefined) updates.playsTekken = args.playsTekken;
    if (args.tekkenFavorites !== undefined) updates.tekkenFavorites = args.tekkenFavorites;
    if (args.playsFutsal !== undefined) updates.playsFutsal = args.playsFutsal;
    if (args.playsIndoorCricket !== undefined) updates.playsIndoorCricket = args.playsIndoorCricket;
    if (args.playsPadel !== undefined) updates.playsPadel = args.playsPadel;
    if (args.playsPickleball !== undefined) updates.playsPickleball = args.playsPickleball;

    if (args.futsalPositions !== undefined) {
      const filtered = args.futsalPositions.filter(Boolean);
      updates.futsalPositions = filtered;
      updates.futsalPosition = filtered[0] ?? null;
    }

    if (args.indoorCricketRole !== undefined) updates.indoorCricketRole = args.indoorCricketRole ?? null;
    if (args.indoorCricketBowlingStyle !== undefined) {
      updates.indoorCricketBowlingStyle = args.indoorCricketBowlingStyle ?? null;
    }
    if (args.indoorCricketBattingStyle !== undefined) {
      updates.indoorCricketBattingStyle = args.indoorCricketBattingStyle ?? null;
    }
    if (args.padelRole !== undefined) updates.padelRole = args.padelRole ?? null;
    if (args.pickleballRole !== undefined) updates.pickleballRole = args.pickleballRole ?? null;
    if (args.skillScores !== undefined) updates.skillScores = args.skillScores ?? null;

    await ctx.db.patch(user._id, updates);
    return { ok: true };
  },
});

export const updatePlatformLinks = mutation({
  args: {
    steamProfileUrl: v.optional(v.union(v.string(), v.null())),
    steamId: v.optional(v.union(v.string(), v.null())),
    steamPersonaName: v.optional(v.union(v.string(), v.null())),
    steamCs2Hours: v.optional(v.union(v.number(), v.null())),
    steamTekken8Hours: v.optional(v.union(v.number(), v.null())),
    steamFc26Hours: v.optional(v.union(v.number(), v.null())),
    steamStats: v.optional(v.union(v.any(), v.null())),
    faceitProfileUrl: v.optional(v.union(v.string(), v.null())),
    faceitId: v.optional(v.union(v.string(), v.null())),
    faceitNickname: v.optional(v.union(v.string(), v.null())),
    faceitGame: v.optional(v.union(v.string(), v.null())),
    faceitElo: v.optional(v.union(v.number(), v.null())),
    faceitSkillLevel: v.optional(v.union(v.number(), v.null())),
    psnOnlineId: v.optional(v.union(v.string(), v.null())),
    psnAccountId: v.optional(v.union(v.string(), v.null())),
    psnStats: v.optional(v.union(v.any(), v.null())),
  },
  handler: async (ctx, args): Promise<ServerResponse> => {
    const { user } = await requireUser(ctx);
    const updates: Record<string, any> = { updatedAt: Date.now() };

    if (args.steamProfileUrl !== undefined) updates.steamProfileUrl = args.steamProfileUrl ?? null;
    if (args.faceitProfileUrl !== undefined) updates.faceitProfileUrl = args.faceitProfileUrl ?? null;
    if (args.psnOnlineId !== undefined) updates.psnOnlineId = args.psnOnlineId ?? null;

    if (args.steamId !== undefined) {
      if (args.steamId) {
        await assertUniqueByIndex(ctx, "by_steamId", "steamId", args.steamId, user.uid, "Steam account already linked.");
      }
      updates.steamId = args.steamId ?? null;
    }
    if (args.faceitId !== undefined) {
      if (args.faceitId) {
        await assertUniqueByIndex(ctx, "by_faceitId", "faceitId", args.faceitId, user.uid, "FACEIT account already linked.");
      }
      updates.faceitId = args.faceitId ?? null;
    }
    if (args.psnAccountId !== undefined) {
      if (args.psnAccountId) {
        await assertUniqueByIndex(ctx, "by_psnAccountId", "psnAccountId", args.psnAccountId, user.uid, "PSN account already linked.");
      }
      updates.psnAccountId = args.psnAccountId ?? null;
    }
    if (args.steamPersonaName !== undefined) updates.steamPersonaName = args.steamPersonaName ?? null;
    if (args.steamCs2Hours !== undefined) updates.steamCs2Hours = args.steamCs2Hours ?? null;
    if (args.steamTekken8Hours !== undefined) {
      updates.steamTekken8Hours = args.steamTekken8Hours ?? null;
    }
    if (args.steamFc26Hours !== undefined) updates.steamFc26Hours = args.steamFc26Hours ?? null;
    if (args.steamStats !== undefined) updates.steamStats = args.steamStats ?? null;
    if (args.faceitNickname !== undefined) updates.faceitNickname = args.faceitNickname ?? null;
    if (args.faceitGame !== undefined) updates.faceitGame = args.faceitGame ?? null;
    if (args.faceitElo !== undefined) updates.faceitElo = args.faceitElo ?? null;
    if (args.faceitSkillLevel !== undefined) updates.faceitSkillLevel = args.faceitSkillLevel ?? null;
    if (args.psnStats !== undefined) updates.psnStats = args.psnStats ?? null;

    await ctx.db.patch(user._id, updates);
    return { ok: true };
  },
});

export const listFriends = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireUser(ctx);
    const friends = await ctx.db
      .query("userFriends")
      .withIndex("by_userId", (q) => q.eq("userId", user.uid))
      .collect();

    return friends.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  },
});

export const listFriendRequests = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireUser(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_toUid_createdAt", (q) => q.eq("toUid", user.uid))
      .order("desc")
      .filter((q) => q.eq(q.field("type"), "friend_request"))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
  },
});

export const sendFriendRequest = mutation({
  args: { toUid: v.string() },
  handler: async (ctx, args): Promise<ServerResponse> => {
    const { user } = await requireUser(ctx);
    if (user.uid === args.toUid) {
      return { ok: false, message: "Cannot add yourself." };
    }

    const existing = await getFriendEdge(ctx, user.uid, args.toUid);
    if (existing) {
      return { ok: false, message: "Already friends." };
    }

    const pending = await ctx.db
      .query("notifications")
      .withIndex("by_toUid_createdAt", (q) => q.eq("toUid", args.toUid))
      .filter((q) => q.eq(q.field("fromUid"), user.uid))
      .filter((q) => q.eq(q.field("type"), "friend_request"))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (pending) {
      return { ok: false, message: "Request already pending." };
    }

    const now = Date.now();
    const notificationId = await ctx.db.insert("notifications", {
      type: "friend_request",
      fromUid: user.uid,
      fromUsername: user.username ?? user.displayName ?? user.fullName ?? "Unknown",
      toUid: args.toUid,
      status: "pending",
      isRead: false,
      createdAt: now,
      expiresAt: now + 7 * DAY_MS,
    });

    return { ok: true, notificationId };
  },
});

export const respondFriendRequest = mutation({
  args: {
    notificationId: v.id("notifications"),
    decision: v.union(v.literal("accept"), v.literal("decline")),
  },
  handler: async (ctx, args): Promise<ServerResponse> => {
    const { user } = await requireUser(ctx);
    const notification = await ctx.db.get(args.notificationId);

    if (!notification) return { ok: false, message: "Request not found." };
    if (notification.toUid !== user.uid) return { ok: false, message: "Not authorized." };
    if (notification.type !== "friend_request") return { ok: false, message: "Invalid request." };
    if (notification.status !== "pending") return { ok: false, message: "Request already handled." };

    const now = Date.now();

    if (args.decision === "decline") {
      await ctx.db.patch(notification._id, { status: "declined", updatedAt: now });
      return { ok: true };
    }

    await ctx.db.patch(notification._id, { status: "accepted", updatedAt: now });

    const friendUid = notification.fromUid || "";
    if (!friendUid) return { ok: true };

    const [mine, theirs] = await Promise.all([
      getFriendEdge(ctx, user.uid, friendUid),
      getFriendEdge(ctx, friendUid, user.uid),
    ]);

    if (!mine) {
      await ctx.db.insert("userFriends", {
        userId: user.uid,
        friendId: friendUid,
        username: notification.fromUsername ?? "Unknown",
        since: now,
        createdAt: now,
      });
    }

    if (!theirs) {
      await ctx.db.insert("userFriends", {
        userId: friendUid,
        friendId: user.uid,
        username: user.username ?? user.displayName ?? user.fullName ?? "Unknown",
        since: now,
        createdAt: now,
      });
    }

    return { ok: true };
  },
});

export const removeFriend = mutation({
  args: { friendUid: v.string() },
  handler: async (ctx, args): Promise<ServerResponse> => {
    const { user } = await requireUser(ctx);
    const [mine, theirs] = await Promise.all([
      getFriendEdge(ctx, user.uid, args.friendUid),
      getFriendEdge(ctx, args.friendUid, user.uid),
    ]);

    if (mine) await ctx.db.delete(mine._id);
    if (theirs) await ctx.db.delete(theirs._id);

    return { ok: true };
  },
});

export const walletTopUpDev = mutation({
  args: { amount: v.number() },
  handler: async (ctx, args): Promise<ServerResponse> => {
    if (!DEV_WALLET_TOPUP_ENABLED) {
      return { ok: false, message: "Wallet top-ups are disabled." };
    }

    const { user } = await requireUser(ctx);
    const amount = Number(args.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, message: "Invalid amount." };
    }

    const now = Date.now();
    const currentBalance = Number(user.walletBalance || 0);
    const nextBalance = currentBalance + amount;

    await ctx.db.patch(user._id, { walletBalance: nextBalance, updatedAt: now });
    const transactionId = await ctx.db.insert("walletTransactions", {
      userId: user.uid,
      type: "credit",
      amount,
      status: "completed",
      source: "dev_topup",
      createdAt: now,
    });

    return { ok: true, balance: nextBalance, transactionId };
  },
});
