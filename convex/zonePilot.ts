import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

export const expireEndedPilots = internalMutation({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const batchSize = Math.min(Math.max(args.batchSize || 50, 1), 100);
    const zones = await ctx.db
      .query("zones")
      .withIndex("by_pilotStatus_and_pilotEndsAt", (q: any) =>
        q.eq("pilotStatus", "active").lte("pilotEndsAt", now)
      )
      .take(batchSize);

    let processed = 0;
    for (const zone of zones) {
      if (zone.pilotStatus !== "active" || typeof zone.pilotEndsAt !== "number" || zone.pilotEndsAt > now) {
        continue;
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

      processed += 1;
    }

    return { processed };
  },
});
