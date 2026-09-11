import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { isMaintenanceJobEnabled } from "./runtimeEnv";
import { getSafeScheduleAt } from "./schedulingSafety";

async function endPilotIfDue(ctx: any, zone: any, expectedEndsAt: number, now = Date.now()) {
  if (
    !zone
    || zone.pilotStatus !== "active"
    || Number(zone.pilotEndsAt || 0) !== expectedEndsAt
    || expectedEndsAt > now
  ) {
    return false;
  }
  await ctx.db.patch(zone._id, {
    pilotStatus: "ended",
    pilotEndedAt: now,
    updatedAt: now,
  });
  if (zone.ownerUid) {
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "zone.pilot_ended",
      toUid: zone.ownerUid,
      recipientRole: "zone_admin",
      status: "pending",
      dedupeKey: `zone.pilot_ended:${String(zone._id)}`,
      dedupePolicy: "replace_active",
      pushPolicy: "force",
      route: "/zone/(tabs)/profile",
      entity: { kind: "zone", id: String(zone._id) },
      entityId: String(zone._id),
      title: "Pilot period ended",
      body: "Your 1-month pilot period has ended. Future Matchhai booking payouts will follow the standard 90% venue payout rate.",
      data: {
        zoneId: String(zone._id),
        pilotStartedAt: zone.pilotStartedAt || null,
        pilotEndsAt: zone.pilotEndsAt,
        pilotEndedAt: now,
        normalPayoutRate: zone.normalPayoutRate || 0.9,
        route: "/zone/(tabs)/profile",
        href: "/zone/(tabs)/profile",
      },
    });
  }
  return true;
}

export const processScheduledPilotExpiry = internalMutation({
  args: { zoneId: v.id("zones"), expectedEndsAt: v.number() },
  handler: async (ctx, args) => {
    const zone = await ctx.db.get(args.zoneId);
    return { ended: await endPilotIfDue(ctx, zone, args.expectedEndsAt) };
  },
});

export const scheduleActivePilotExpiries = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("zones")
      .withIndex("by_pilotStatus_and_pilotEndsAt", (q: any) => q.eq("pilotStatus", "active").gte("pilotEndsAt", 0))
      .paginate({
        cursor: args.cursor ?? null,
        numItems: Math.min(100, Math.max(1, Number(args.batchSize || 50))),
      });
    for (const zone of page.page) {
      if (typeof zone.pilotEndsAt !== "number") continue;
      await ctx.scheduler.runAt(
        getSafeScheduleAt(zone.pilotEndsAt)!,
        internal.zonePilot.processScheduledPilotExpiry,
        { zoneId: zone._id, expectedEndsAt: zone.pilotEndsAt },
      );
    }
    if (!page.isDone) {
      if (!page.continueCursor || page.continueCursor === args.cursor) {
        throw new Error("Zone pilot scheduling pagination made no progress.");
      }
      await ctx.scheduler.runAfter(0, internal.zonePilot.scheduleActivePilotExpiries, {
        batchSize: args.batchSize,
        cursor: page.continueCursor,
      });
    }
    return { scheduled: page.page.length, isDone: page.isDone, continueCursor: page.continueCursor };
  },
});

export const expireEndedPilots = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!isMaintenanceJobEnabled("MATCHHAI_ENABLE_ZONE_PILOT_CRON")) {
      return { disabled: true, processed: 0 };
    }

    const now = Date.now();
    const batchSize = Math.min(Math.max(args.batchSize || 50, 1), 100);
    const zones = await ctx.db
      .query("zones")
      .withIndex("by_pilotStatus_and_pilotEndsAt", (q: any) =>
        q
          .eq("pilotStatus", "active")
          .gte("pilotEndsAt", 0)
          .lte("pilotEndsAt", now)
      )
      .take(batchSize);

    let processed = 0;
    for (const zone of zones) {
      if (typeof zone.pilotEndsAt === "number" && await endPilotIfDue(ctx, zone, zone.pilotEndsAt, now)) {
        processed += 1;
      }
    }

    return { processed };
  },
});
