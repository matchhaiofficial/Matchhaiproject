"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_ENDPOINT = "https://exp.host/--/api/v2/push/getReceipts";
const EXPO_SEND_CHUNK_SIZE = 100;
const EXPO_RECEIPT_CHUNK_SIZE = 1000;
const RECEIPT_CHECK_DELAY_MS = 15 * 60 * 1000;

type ExpoMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  channelId: string;
  priority: "high";
  data: Record<string, unknown>;
};

type ExpoSendTarget = {
  deviceId: Id<"pushDevices">;
  message: ExpoMessage;
};

type ExpoSendSummary = {
  accepted: number;
  failed: number;
  receiptIds: string[];
};

const sanitizeExpoError = (value: unknown) => {
  const text = String(value || "").slice(0, 240);
  return text.replace(/ExponentPushToken\[[^\]]+\]/g, "ExponentPushToken[redacted]");
};

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const expoErrorCode = (item: any) => {
  return sanitizeExpoError(item?.details?.error || item?.message || "expo_push_error");
};

async function sendExpoMessages(
  ctx: any,
  targets: ExpoSendTarget[],
  pushKind: "notification" | "chat",
  notificationId?: Id<"notifications">
): Promise<ExpoSendSummary> {
  const summary: ExpoSendSummary = { accepted: 0, failed: 0, receiptIds: [] };

  for (const chunk of chunkArray(targets, EXPO_SEND_CHUNK_SIZE)) {
    let response: Response;
    let parsed: any = null;
    try {
      response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk.map((target) => target.message)),
      });
      const rawText = await response.text();
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }
    } catch {
      response = new Response(null, { status: 599 });
    }

    if (!response.ok) {
      const errorMessage = `expo_push_http_${response.status}`;
      summary.failed += chunk.length;
      await Promise.all(
        chunk.map((target) =>
          ctx.runMutation((internal as any).pushNotifications.markDeviceDeliveryResult, {
            deviceId: target.deviceId,
            delivered: false,
            error: errorMessage,
          })
        )
      );
      continue;
    }

    const resultItems = Array.isArray(parsed?.data) ? parsed.data : [];
    await Promise.all(
      chunk.map(async (target, index) => {
        const item = resultItems[index] || {};
        const status = String(item?.status || "");
        const receiptId = typeof item?.id === "string" ? item.id : undefined;
        const errorCode = status === "ok" ? undefined : expoErrorCode(item);
        const deactivate = errorCode === "DeviceNotRegistered";

        if (status === "ok" && receiptId) {
          summary.accepted += 1;
          summary.receiptIds.push(receiptId);
          await ctx.runMutation((internal as any).pushNotifications.recordExpoPushTicket, {
            notificationId,
            deviceId: target.deviceId,
            pushKind,
            receiptId,
            ticketStatus: "ok",
          });
          await ctx.runMutation((internal as any).pushNotifications.markDeviceDeliveryResult, {
            deviceId: target.deviceId,
            delivered: false,
            ticketId: receiptId,
          });
          return;
        }

        summary.failed += 1;
        await ctx.runMutation((internal as any).pushNotifications.markDeviceDeliveryResult, {
          deviceId: target.deviceId,
          delivered: false,
          error: errorCode || "expo_push_ticket_failed",
          deactivate,
        });
      })
    );
  }

  if (summary.receiptIds.length > 0) {
    await Promise.all(
      chunkArray(summary.receiptIds, EXPO_RECEIPT_CHUNK_SIZE).map((receiptIds) =>
        ctx.scheduler.runAfter(
          RECEIPT_CHECK_DELAY_MS,
          (internal as any).pushNotificationsActions.checkReceipts,
          { receiptIds }
        )
      )
    );
  }

  return summary;
}

const inferHref = (notification: any, accountType?: string) => {
  const meta = notification?.data || {};
  const type = String(notification?.type || meta.canonicalType || "").toLowerCase();
  const role = String(notification?.recipientRole || meta.recipientRole || accountType || "").toLowerCase();
  const requestId = String(meta.requestId || meta.requestRef || "").trim();
  const matchroomId = String(meta.matchroomId || notification.matchroomId || "").trim();
  const intentId = String(meta.intentId || "").trim();
  const challengeId = String(meta.challengeId || "").trim();

  if (type === "match.payment_required" && intentId) {
    return `/matchrooms/book/pay/${encodeURIComponent(intentId)}`;
  }
  if (type === "booking.request_submitted" && role === "zone_admin") {
    return requestId
      ? `/zone/modules/bookings?segment=requests&requestId=${encodeURIComponent(requestId)}&expandedRequestId=${encodeURIComponent(requestId)}&focusRequestId=${encodeURIComponent(requestId)}`
      : "/zone/modules/bookings?segment=requests";
  }
  if (type === "booking.counter_offer_result") {
    return requestId
      ? `/zone/modules/bookings?segment=requests&requestId=${encodeURIComponent(requestId)}&expandedRequestId=${encodeURIComponent(requestId)}&focusRequestId=${encodeURIComponent(requestId)}`
      : "/zone/modules/bookings?segment=requests";
  }
  if (type === "zone.matchroom_full") {
    return matchroomId
      ? `/zone/modules/bookings?segment=matchrooms&matchroomId=${encodeURIComponent(matchroomId)}`
      : "/zone/modules/bookings?segment=matchrooms";
  }
  if ((type === "team.challenge_received" || type === "team.challenge_updated") && challengeId) {
    return `/teams/challenge?id=${encodeURIComponent(challengeId)}`;
  }

  if (typeof notification?.route === "string" && notification.route.length) {
    return notification.route === "/zone/profile" ? "/zone/(tabs)/profile" : notification.route;
  }
  if (typeof meta.href === "string" && meta.href.length) {
    return meta.href === "/zone/profile" ? "/zone/(tabs)/profile" : meta.href;
  }

  if (challengeId) {
    return `/teams/challenge?id=${encodeURIComponent(challengeId)}`;
  }

  if (matchroomId) {
    return `/matchrooms/${encodeURIComponent(matchroomId)}`;
  }

  if (meta.teamId || notification.teamId) {
    return `/teams/${meta.teamId || notification.teamId}`;
  }

  if (role === "zone" || role === "zone_admin") {
    return "/zone/modules/notifications";
  }

  if (role === "super_admin" || role === "super-admin") {
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
    if (["sent", "receipt_ok", "skipped", "no_device"].includes(String(notification.pushState || ""))) {
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

    const claim: any = await ctx.runMutation((internal as any).notifications.claimPushSend, {
      notificationId: args.notificationId,
      attemptedAt: now,
    });
    if (!claim?.ok) {
      return { ok: true, skipped: claim?.reason || "already_claimed", sent: 0 };
    }

    try {
      const devices: any[] = await ctx.runQuery((internal as any).pushNotifications.getActiveDevicesForUser, {
        userId: notification.toUid,
      });

      if (!devices.length) {
        await ctx.runMutation((internal as any).notifications.markPushState, {
          notificationId: args.notificationId,
          state: "no_device",
          attemptedAt: now,
          error: "no_active_devices",
        });
        return { ok: true, sent: 0, skipped: "no_active_devices" as const };
      }

      const href = inferHref(notification, notification.recipientRole || recipient?.role || recipient?.accountType);
      const title = String(notification.title || "New update");
      const body = String(notification.body || "Open MatchHai to view details.");
      const targets: ExpoSendTarget[] = devices.map((device: any) => ({
        deviceId: device._id,
        message: {
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
        },
      }));

      const summary = await sendExpoMessages(ctx, targets, "notification", args.notificationId);
      const accepted = summary.accepted > 0;
      await ctx.runMutation((internal as any).notifications.markPushState, {
        notificationId: args.notificationId,
        state: accepted ? "sent" : "failed",
        attemptedAt: now,
        error: accepted ? undefined : "expo_push_delivery_failed",
      });

      return { ok: accepted, sent: summary.accepted };
    } catch {
      await ctx.runMutation((internal as any).notifications.markPushState, {
        notificationId: args.notificationId,
        state: "failed",
        attemptedAt: now,
        error: "expo_push_action_failed",
      });
      return { ok: false, reason: "send_failed" as const, sent: 0 };
    }
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

    const targets: ExpoSendTarget[] = allDevices.map((device) => ({
      deviceId: device._id,
      message: {
        to: device.expoPushToken,
        sound: "default",
        title: args.senderName,
        body: args.messagePreview,
        channelId: "default",
        priority: "high",
        data: {
          href,
          route: href,
          type: "chat_message",
          chatKey: args.chatKey,
          matchroomId: args.matchroomId || null,
          challengeId: args.challengeId || null,
        },
      },
    }));

    const summary = await sendExpoMessages(ctx, targets, "chat");
    return { ok: summary.accepted > 0, sent: summary.accepted };
  },
});

export const checkReceipts = internalAction({
  args: {
    receiptIds: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; checked: number; failed: number }> => {
    const uniqueReceiptIds = Array.from(new Set(args.receiptIds)).slice(0, EXPO_RECEIPT_CHUNK_SIZE);
    if (uniqueReceiptIds.length === 0) {
      return { ok: true, checked: 0, failed: 0 };
    }

    const tickets: any[] = await ctx.runQuery(
      (internal as any).pushNotifications.getTicketsByReceiptIds,
      { receiptIds: uniqueReceiptIds }
    );
    const existingReceiptIds = new Set(tickets.map((ticket) => String(ticket.receiptId)));
    const notificationIds = new Set<string>();
    const checkedAt = Date.now();
    let checked = 0;
    let failed = 0;

    for (const chunk of chunkArray(uniqueReceiptIds, EXPO_RECEIPT_CHUNK_SIZE)) {
      let receipts: Record<string, any> = {};
      let httpFailed = false;
      try {
        const response = await fetch(EXPO_RECEIPTS_ENDPOINT, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids: chunk }),
        });
        const rawText = await response.text();
        let parsed: any = null;
        try {
          parsed = rawText ? JSON.parse(rawText) : null;
        } catch {
          parsed = null;
        }
        if (!response.ok) {
          httpFailed = true;
          receipts = Object.fromEntries(
            chunk.map((receiptId) => [
              receiptId,
              { status: "error", details: { error: `expo_receipt_http_${response.status}` } },
            ])
          );
        } else {
          receipts = parsed?.data && typeof parsed.data === "object" ? parsed.data : {};
        }
      } catch {
        httpFailed = true;
        receipts = Object.fromEntries(
          chunk.map((receiptId) => [
            receiptId,
            { status: "error", details: { error: "expo_receipt_network_error" } },
          ])
        );
      }

      for (const receiptId of chunk) {
        if (!existingReceiptIds.has(receiptId)) continue;
        const receipt = receipts[receiptId] || (
          httpFailed ? { status: "error", details: { error: "expo_receipt_unavailable" } } : null
        );
        if (!receipt) continue;

        const receiptStatus = String(receipt.status || "") === "ok" ? "ok" : "error";
        const errorCode = receiptStatus === "ok" ? undefined : expoErrorCode(receipt);
        const marked: any = await ctx.runMutation(
          (internal as any).pushNotifications.markTicketReceiptResult,
          {
            receiptId,
            receiptStatus,
            checkedAt,
            errorCode,
            errorMessage: errorCode,
          }
        );
        if (!marked) continue;

        checked += 1;
        if (marked.notificationId) notificationIds.add(String(marked.notificationId));
        const deactivate = errorCode === "DeviceNotRegistered";
        if (receiptStatus === "ok") {
          await ctx.runMutation((internal as any).pushNotifications.markDeviceDeliveryResult, {
            deviceId: marked.deviceId,
            delivered: true,
            receiptCheckedAt: checkedAt,
          });
        } else {
          failed += 1;
          await ctx.runMutation((internal as any).pushNotifications.markDeviceDeliveryResult, {
            deviceId: marked.deviceId,
            delivered: false,
            error: errorCode || "expo_push_receipt_failed",
            deactivate,
            receiptCheckedAt: checkedAt,
          });
        }
      }
    }

    await Promise.all(
      Array.from(notificationIds).map((notificationId) =>
        ctx.runMutation((internal as any).notifications.refreshPushStateFromTickets, {
          notificationId,
          checkedAt,
        })
      )
    );

    return { ok: failed === 0, checked, failed };
  },
});
