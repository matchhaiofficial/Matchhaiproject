import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireCurrentUser } from "./authz";

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
    const { user } = await requireCurrentUser(ctx);
    if (String(args.userId) !== String(user._id)) {
      throw new Error("Push device registration must match the authenticated user.");
    }

    const now = Date.now();
    const permissionStatus = normalizePermissionStatus(args.permissionStatus);
    const platform = normalizePlatform(args.platform);
    const isActive = permissionStatus === "granted" && Boolean(args.expoPushToken);
    const ownedDevices = await ctx.db
      .query("pushDevices")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const existing = ownedDevices.find((device) => device.installationId === args.installationId);

    const patch = {
      userId: user._id,
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

    if (args.expoPushToken) {
      const tokenRows = await ctx.db
        .query("pushDevices")
        .withIndex("by_expoPushToken", (q) => q.eq("expoPushToken", args.expoPushToken))
        .take(20);

      for (const row of tokenRows) {
        const sameDevice = row.installationId === args.installationId && String(row.userId) === String(user._id);
        if (!sameDevice) {
          await ctx.db.patch(row._id, {
            isActive: false,
            expoPushToken: undefined,
            updatedAt: now,
          });
        }
      }
    }

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
    const { user } = await requireCurrentUser(ctx);
    const ownedDevices = await ctx.db
      .query("pushDevices")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const existing = ownedDevices.find((device) => device.installationId === args.installationId);

    if (!existing) return false;

    await ctx.db.patch(existing._id, {
      isActive: false,
      expoPushToken: undefined,
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
    ticketId: v.optional(v.string()),
    receiptCheckedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const patch: Record<string, unknown> = {
      updatedAt: now,
      lastError: args.error,
    };

    if (args.ticketId) {
      patch.lastTicketId = args.ticketId;
    }

    if (args.receiptCheckedAt) {
      patch.lastReceiptCheckedAt = args.receiptCheckedAt;
    }

    if (args.delivered) {
      patch.lastDeliveredAt = now;
      patch.lastError = undefined;
    }

    if (args.deactivate) {
      patch.isActive = false;
      patch.expoPushToken = undefined;
    }

    await ctx.db.patch(args.deviceId, patch);
    return true;
  },
});

export const recordExpoPushTicket = internalMutation({
  args: {
    notificationId: v.optional(v.id("notifications")),
    deviceId: v.id("pushDevices"),
    pushKind: v.union(v.literal("notification"), v.literal("chat")),
    receiptId: v.optional(v.string()),
    ticketStatus: v.union(v.literal("ok"), v.literal("error")),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.receiptId) return null;
    const now = Date.now();
    return await ctx.db.insert("pushTickets", {
      notificationId: args.notificationId,
      deviceId: args.deviceId,
      pushKind: args.pushKind,
      receiptId: args.receiptId,
      ticketStatus: args.ticketStatus,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getTicketsByReceiptIds = internalQuery({
  args: {
    receiptIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const tickets = [];
    for (const receiptId of args.receiptIds.slice(0, 1000)) {
      const matches = await ctx.db
        .query("pushTickets")
        .withIndex("by_receiptId", (q) => q.eq("receiptId", receiptId))
        .take(1);
      const ticket = matches[0];
      if (ticket) tickets.push(ticket);
    }
    return tickets;
  },
});

export const markTicketReceiptResult = internalMutation({
  args: {
    receiptId: v.string(),
    receiptStatus: v.union(v.literal("ok"), v.literal("error")),
    checkedAt: v.number(),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const matches = await ctx.db
      .query("pushTickets")
      .withIndex("by_receiptId", (q) => q.eq("receiptId", args.receiptId))
      .take(1);
    const ticket = matches[0];
    if (!ticket) return null;

    await ctx.db.patch(ticket._id, {
      receiptStatus: args.receiptStatus,
      receiptCheckedAt: args.checkedAt,
      errorCode: args.errorCode,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });

    return {
      notificationId: ticket.notificationId,
      deviceId: ticket.deviceId,
      pushKind: ticket.pushKind,
    };
  },
});
