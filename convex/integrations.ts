import { action, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { requireUser } from "./lib/auth";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const getBaseUrl = () =>
  process.env.INTEGRATIONS_BASE_URL || process.env.API_BASE_URL || "";

const isFresh = (fetchedAt?: number | null) =>
  !!fetchedAt && Date.now() - fetchedAt < CACHE_TTL_MS;

export const updateIntegrationCache = mutation({
  args: {
    provider: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx);
    const legacy = { ...(user.legacy || {}) } as Record<string, any>;
    const integrationCache = { ...(legacy.integrationCache || {}) } as Record<string, any>;
    integrationCache[args.provider] = {
      fetchedAt: Date.now(),
      data: args.data,
    };
    legacy.integrationCache = integrationCache;
    await ctx.db.patch(user._id, { legacy, updatedAt: Date.now() });
    return { ok: true };
  },
});

export const fetchSteamProfileFromUrl = action({
  args: { profileUrl: v.string(), forceRefresh: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery("users:getCurrentUser" as any, {});
    const cached = user?.legacy?.integrationCache?.steam;
    if (!args.forceRefresh && cached && isFresh(cached.fetchedAt)) {
      return { ok: true, data: cached.data, cached: true };
    }

    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      return { ok: false, message: "Integrations base URL not configured." };
    }

    const url = `${baseUrl}/steam/profile-from-url?url=${encodeURIComponent(args.profileUrl)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, message: text || "Steam lookup failed." };
    }

    const data = await res.json();

    await ctx.runMutation("users:updatePlatformLinks" as any, {
      steamProfileUrl: args.profileUrl,
      steamId: data.steamId ?? null,
      steamPersonaName: data.personaName ?? null,
      steamCs2Hours: data.cs2Hours ?? null,
      steamStats: data.stats ?? null,
    });
    await ctx.runMutation("integrations:updateIntegrationCache" as any, { provider: "steam", data });

    return { ok: true, data };
  },
});

export const fetchFaceitProfileFromUrl = action({
  args: {
    value: v.string(),
    game: v.optional(v.string()),
    forceRefresh: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery("users:getCurrentUser" as any, {});
    const cached = user?.legacy?.integrationCache?.faceit;
    if (!args.forceRefresh && cached && isFresh(cached.fetchedAt)) {
      return { ok: true, data: cached.data, cached: true };
    }

    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      return { ok: false, message: "Integrations base URL not configured." };
    }

    const value = args.value.trim();
    if (!value) throw new ConvexError("FACEIT value required.");

    const url = `${baseUrl}/faceit/profile-from-value?value=${encodeURIComponent(value)}&game=${encodeURIComponent(args.game || "cs2")}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, message: text || "FACEIT lookup failed." };
    }

    const data = await res.json();

    await ctx.runMutation("users:updatePlatformLinks" as any, {
      faceitProfileUrl: value,
      faceitId: data.faceitId ?? null,
      faceitNickname: data.nickname ?? null,
      faceitGame: data.game ?? null,
      faceitElo: data.elo ?? null,
      faceitSkillLevel: data.skillLevel ?? null,
    });
    await ctx.runMutation("integrations:updateIntegrationCache" as any, { provider: "faceit", data });

    return { ok: true, data };
  },
});

export const verifyPsnProfile = action({
  args: {
    psnOnlineId: v.string(),
    wantsTekken: v.boolean(),
    wantsFc: v.boolean(),
    forceRefresh: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery("users:getCurrentUser" as any, {});
    const cached = user?.legacy?.integrationCache?.psn;
    if (!args.forceRefresh && cached && isFresh(cached.fetchedAt)) {
      return { ok: true, data: cached.data, cached: true };
    }

    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      return { ok: false, message: "Integrations base URL not configured." };
    }

    const res = await fetch(`${baseUrl}/psn/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        psnOnlineId: args.psnOnlineId,
        wantsTekken: args.wantsTekken,
        wantsFc: args.wantsFc,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      return { ok: false, message: json?.message || "PSN verification failed." };
    }

    const data = json.data ?? json;

    await ctx.runMutation("users:updatePlatformLinks" as any, {
      psnOnlineId: data.psnOnlineId ?? args.psnOnlineId,
      psnAccountId: data.psnAccountId ?? null,
      psnStats: data ?? null,
    });
    await ctx.runMutation("integrations:updateIntegrationCache" as any, { provider: "psn", data });

    return { ok: true, data };
  },
});
