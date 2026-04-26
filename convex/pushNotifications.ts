import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";

const normalizePermissionStatus = (
  value: string
): "granted" | "denied" | "undetermined" => {
  if (value === "granted" || value === "denied" || value === "undetermined") {
    return value;
  }
  return "undetermined" as const;
};

const normalizePlatform = (
  value: string
): "ios" | "android" | "web" | "unknown" => {
  if (value === "ios" || value === "android" || value === "web") {
    return value;
  }
  return "unknown" as const;
};

const inferHref = (notification: any, accountType?: string) => {
  const meta = notification?.data || {};
  if (typeof meta.href === "string" && meta.href.length) {
    return meta.href;
  }

  if (meta.challengeId) {
    return `/teams/challenge?id=${meta.challengeId}`;
  }

  if (meta.matchroomId || notification.matchroomId) {
    return `/matchrooms/${meta.matchroomId || notification.matchroomId}`;
  }

  if (meta.teamId || notification.teamId) {
    return `/teams/${meta.teamId || notification.teamId}`;
  }

  if (accountType === "zone") {
    return "/zone/modules/notifications";
  }

  if (accountType === "super_admin" || accountType === "super-admin") {
    return "/super-admin";
  }

  return "/(player)/inbox";
};

export const upsertDevice = mutation({
  args: {
    userId: v.id("users"),
    installationId: v.string(),
    provider: v.union(v.literal("expo")),
    platform: v.string(),
    expoPushToken: v.optional(v.string()),
    projectId: v.optional(v.string()),
    deviceName: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    permissionStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const permissionStatus = normalizePermissionStatus(args.permissionStatus);
    const platform = normalizePlatform(args.platform);
    const isActive = permissionStatus === "granted" && Boolean(args.expoPushToken);
    const existing = await ctx.db
      .query("pushDevices")
      .withIndex("by_installationId", (q) => q.eq("installationId", args.installationId))
      .unique();

    const patch = {
      userId: args.userId,
      installationId: args.installationId,
      provider: args.provider,
      platform,
      expoPushToken: args.expoPushToken,
      projectId: args.projectId,
      deviceName: args.deviceName,
      appVersion: args.appVersion,
      permissionStatus,
      isActive,
      lastRegisteredAt: now,
      lastError: undefined,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("pushDevices", {
      ...patch,
      createdAt: now,
    });
  },
});

export const deactivateDevice = mutation({
  args: {
    installationId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("pushDevices")
      .withIndex("by_installationId", (q) => q.eq("installationId", args.installationId))
      .unique();

    if (!existing) return false;

    await ctx.db.patch(existing._id, {
      isActive: false,
      permissionStatus: "denied",
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const getActiveDevicesForUser = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const devices = await ctx.db
      .query("pushDevices")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    return devices.filter((device) => device.isActive && !!device.expoPushToken);
  },
});

export const getNotificationEnvelope = internalQuery({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return null;

    const recipient = await ctx.db.get(notification.toUid);
    return {
      notification,
      recipient,
    };
  },
});

export const getUserMuteList = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return { chatMuted: (user as any).chatMuted || [] };
  },
});

export const markDeviceDeliveryResult = internalMutation({
  args: {
    deviceId: v.id("pushDevices"),
    delivered: v.boolean(),
    error: v.optional(v.string()),
    deactivate: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const patch: Record<string, unknown> = {
      updatedAt: now,
      lastError: args.error,
    };

    if (args.delivered) {
      patch.lastDeliveredAt = now;
      patch.lastError = undefined;
    }

    if (args.deactivate) {
      patch.isActive = false;
    }

    await ctx.db.patch(args.deviceId, patch);
    return true;
  },
});
