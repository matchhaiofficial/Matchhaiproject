"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";

const inferHref = (notification: any, accountType?: string) => {
  if (typeof notification?.route === "string" && notification.route.length) {
    return notification.route;
  }
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

export const sendForNotification = internalAction({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; reason?: string; sent?: number; skipped?: string; status?: number }> => {
    const envelope: any = await ctx.runQuery((internal as any).pushNotifications.getNotificationEnvelope, {
      notificationId: args.notificationId,
    });

    if (!envelope?.notification) {
      return { ok: false, reason: "notification_not_found" as const };
    }

    const { notification, recipient }: any = envelope;
    const now = Date.now();
    if (notification.pushState === "sent" || notification.pushState === "skipped") {
      return { ok: true, skipped: "already_processed" as const, sent: 0 };
    }
    if (notification.expiresAt && notification.expiresAt <= now) {
      await ctx.runMutation((internal as any).notifications.markPushState, {
        notificationId: args.notificationId,
        state: "skipped",
        attemptedAt: now,
        error: "expired",
      });
      return { ok: false, reason: "expired" as const };
    }

    await ctx.runMutation((internal as any).notifications.markPushState, {
      notificationId: args.notificationId,
      state: "pending",
      attemptedAt: now,
    });

    const devices: any[] = await ctx.runQuery((internal as any).pushNotifications.getActiveDevicesForUser, {
      userId: notification.toUid,
    });

    if (!devices.length) {
      await ctx.runMutation((internal as any).notifications.markPushState, {
        notificationId: args.notificationId,
        state: "skipped",
        attemptedAt: now,
        error: "no_active_devices",
      });
      return { ok: true, sent: 0, skipped: "no_active_devices" as const };
    }

    const href = inferHref(notification, notification.recipientRole || recipient?.role || recipient?.accountType);
    const title = String(notification.title || "New update");
    const body = String(notification.body || "Open MatchHai to view details.");
    const payload: any[] = devices.map((device: any) => ({
      to: device.expoPushToken,
      sound: "default",
      title,
      body,
      channelId: "default",
      priority: "high",
        data: {
          href,
          route: href,
          notificationId: notification._id,
          type: notification.type,
          dedupeKey: notification.dedupeKey || null,
          matchroomId: notification.matchroomId || notification.data?.matchroomId || null,
          teamId: notification.teamId || notification.data?.teamId || null,
          challengeId: notification.data?.challengeId || null,
      },
    }));

    const response: Response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const rawText = await response.text();
    let parsed: any = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const errorMessage = `Expo push send failed: ${response.status} ${rawText}`;
      await ctx.runMutation((internal as any).notifications.markPushState, {
        notificationId: args.notificationId,
        state: "failed",
        attemptedAt: now,
        error: errorMessage,
      });
      await Promise.all(
        devices.map((device: any) =>
          ctx.runMutation((internal as any).pushNotifications.markDeviceDeliveryResult, {
            deviceId: device._id,
            delivered: false,
            error: errorMessage,
          })
        )
      );
      return { ok: false, reason: "send_failed" as const, status: response.status };
    }

    const resultItems = Array.isArray(parsed?.data) ? parsed.data : [];
    const delivered = resultItems.some((item: any) => String(item?.status || "") === "ok");
    await ctx.runMutation((internal as any).notifications.markPushState, {
      notificationId: args.notificationId,
      state: delivered ? "sent" : "failed",
      attemptedAt: now,
      deliveredAt: delivered ? Date.now() : undefined,
      error: delivered ? undefined : "expo_push_delivery_failed",
    });
    await Promise.all(
      devices.map((device: any, index: number) => {
        const item = resultItems[index] || {};
        const errorCode = String(item?.details?.error || item?.message || "");
        const deactivate = errorCode === "DeviceNotRegistered";
        return ctx.runMutation((internal as any).pushNotifications.markDeviceDeliveryResult, {
          deviceId: device._id,
          delivered: String(item?.status || "") === "ok",
          error: errorCode || undefined,
          deactivate,
        });
      })
    );

    return { ok: true, sent: devices.length };
  },
});

export const sendChatPush = internalAction({
  args: {
    senderName: v.string(),
    messagePreview: v.string(),
    recipientUserIds: v.array(v.id("users")),
    chatKey: v.string(),
    matchroomId: v.optional(v.string()),
    challengeId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; sent?: number }> => {
    if (args.recipientUserIds.length === 0) {
      return { ok: true, sent: 0 };
    }

    const allDevices: Array<{ expoPushToken: string; _id: Id<"pushDevices"> }> = [];

    for (const recipientId of args.recipientUserIds) {
      // Check if this user has muted this chat
      const recipient: any = await ctx.runQuery((internal as any).pushNotifications.getUserMuteList, {
        userId: recipientId,
      });
      if (recipient?.chatMuted?.includes(args.chatKey)) {
        continue;
      }

      const devices: any[] = await ctx.runQuery(
        (internal as any).pushNotifications.getActiveDevicesForUser,
        { userId: recipientId }
      );
      allDevices.push(...devices);
    }

    if (allDevices.length === 0) {
      return { ok: true, sent: 0 };
    }

    // Determine the deep-link href
    let href: string;
    if (args.matchroomId) {
      href = `/matchrooms/chat/${args.matchroomId}`;
    } else if (args.challengeId) {
      href = `/teams/challenge-chat?id=${args.challengeId}`;
    } else {
      href = "/(player)/chatrooms";
    }

    const payload = allDevices.map((device) => ({
      to: device.expoPushToken,
      sound: "default" as const,
      title: args.senderName,
      body: args.messagePreview,
      channelId: "default",
      priority: "high" as const,
      data: {
        href,
        route: href,
        type: "chat_message",
        chatKey: args.chatKey,
        matchroomId: args.matchroomId || null,
        challengeId: args.challengeId || null,
      },
    }));

    try {
      const response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return { ok: false, sent: 0 };
      }

      return { ok: true, sent: allDevices.length };
    } catch {
      return { ok: false, sent: 0 };
    }
  },
});
