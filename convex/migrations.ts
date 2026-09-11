import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import schema from "./schema";
import { getLifecycleScheduleAt, recomputeLifecycleDueAt } from "./matchroomLifecycle";
import {
  getBookingRequestLifecycleDueAt,
  getPaymentNextReconcileAt,
  getTeamChallengeLifecycleDueAt,
} from "./maintenanceDue";
import { getSafeScheduleAt } from "./schedulingSafety";

export const migrations = new Migrations(components.migrations, {
  schema,
  defaultBatchSize: 50,
});

export const backfillMatchroomLifecycleDueAt = migrations.define({
  table: "matchrooms",
  migrateOne: (_ctx, room) => {
    const lifecycleDueAt = recomputeLifecycleDueAt(room);
    if (room.lifecycleDueAt === lifecycleDueAt) return;
    return { lifecycleDueAt };
  },
});

export const runBackfillMatchroomLifecycleDueAt = migrations.runner(
  internal.migrations.backfillMatchroomLifecycleDueAt,
);

export const backfillBookingRequestLifecycleDueAt = migrations.define({
  table: "bookingRequests",
  migrateOne: async (ctx, request) => {
    const linkedRoom = request.matchroomId ? await ctx.db.get(request.matchroomId) : null;
    const lifecycleDueAt = getBookingRequestLifecycleDueAt(request, linkedRoom);
    if (request.lifecycleDueAt === lifecycleDueAt) return;
    return { lifecycleDueAt };
  },
});

export const runBackfillBookingRequestLifecycleDueAt = migrations.runner(
  internal.migrations.backfillBookingRequestLifecycleDueAt,
);

export const backfillTeamChallengeLifecycleDueAt = migrations.define({
  table: "teamChallenges",
  migrateOne: (_ctx, challenge) => {
    const lifecycleDueAt = getTeamChallengeLifecycleDueAt(challenge);
    if (challenge.lifecycleDueAt === lifecycleDueAt) return;
    return { lifecycleDueAt };
  },
});

export const runBackfillTeamChallengeLifecycleDueAt = migrations.runner(
  internal.migrations.backfillTeamChallengeLifecycleDueAt,
);

export const backfillPaymentNextReconcileAt = migrations.define({
  table: "paymentTransactions",
  migrateOne: (_ctx, transaction) => {
    const nextReconcileAt = getPaymentNextReconcileAt(transaction);
    if (transaction.nextReconcileAt === nextReconcileAt) return;
    return { nextReconcileAt };
  },
});

export const runBackfillPaymentNextReconcileAt = migrations.runner(
  internal.migrations.backfillPaymentNextReconcileAt,
);

export const scheduleExistingMatchroomLifecycles: any = migrations.define({
  table: "matchrooms",
  migrateOne: async (ctx, room): Promise<any> => {
    // Always recompute from room state. Reusing a persisted overdue value was
    // the trigger that let an old scheduled job repeatedly run at "now".
    const computedDueAt = recomputeLifecycleDueAt(room);
    const lifecycleDueAt = Number(computedDueAt || 0);
    if (!Number.isFinite(lifecycleDueAt) || lifecycleDueAt <= 0 || lifecycleDueAt === Number.MAX_SAFE_INTEGER) {
      return room.lifecycleDueAt === computedDueAt ? undefined : { lifecycleDueAt: computedDueAt };
    }
    if (room.lifecycleScheduledAt === lifecycleDueAt && room.lifecycleScheduledFnId) return;
    const scheduledId: any = await ctx.scheduler.runAt(
      getLifecycleScheduleAt(lifecycleDueAt)!,
      (internal as any).matchrooms.processScheduledLifecycle,
      { matchroomId: room._id, expectedDueAt: lifecycleDueAt },
    );
    return {
      lifecycleDueAt,
      lifecycleScheduledAt: lifecycleDueAt,
      lifecycleScheduledFnId: String(scheduledId),
    };
  },
});

export const runScheduleExistingMatchroomLifecycles = migrations.runner(
  (internal as any).migrations.scheduleExistingMatchroomLifecycles,
);

export const scheduleExistingTeamChallengeLifecycles: any = migrations.define({
  table: "teamChallenges",
  migrateOne: async (ctx, challenge): Promise<any> => {
    const computedDueAt = getTeamChallengeLifecycleDueAt(challenge);
    const lifecycleDueAt = Number(computedDueAt || 0);
    if (!Number.isFinite(lifecycleDueAt) || lifecycleDueAt <= 0 || lifecycleDueAt === Number.MAX_SAFE_INTEGER) {
      return challenge.lifecycleDueAt === computedDueAt ? undefined : { lifecycleDueAt: computedDueAt };
    }
    if (challenge.lifecycleScheduledAt === lifecycleDueAt && challenge.lifecycleScheduledFnId) return;
    const scheduledId: any = await ctx.scheduler.runAt(
      getSafeScheduleAt(lifecycleDueAt)!,
      (internal as any).teamChallenges.processScheduledExpiry,
      { challengeId: challenge._id, expectedDueAt: lifecycleDueAt },
    );
    return {
      lifecycleDueAt,
      lifecycleScheduledAt: lifecycleDueAt,
      lifecycleScheduledFnId: String(scheduledId),
    };
  },
});

export const runScheduleExistingTeamChallengeLifecycles = migrations.runner(
  (internal as any).migrations.scheduleExistingTeamChallengeLifecycles,
);

// Recompute after the pending-challenge policy was corrected to use the
// earlier of the match date and the seven-day acceptance deadline.
export const reschedulePendingTeamChallengeAcceptDeadlines: any = migrations.define({
  table: "teamChallenges",
  migrateOne: async (ctx, challenge): Promise<any> => {
    if (challenge.status !== "pending" || challenge.matchroomId) return;
    const lifecycleDueAt = Number(getTeamChallengeLifecycleDueAt(challenge) || 0);
    if (!Number.isFinite(lifecycleDueAt) || lifecycleDueAt <= 0 || lifecycleDueAt === Number.MAX_SAFE_INTEGER) return;
    if (challenge.lifecycleScheduledAt === lifecycleDueAt && challenge.lifecycleScheduledFnId) return;
    const scheduledId: any = await ctx.scheduler.runAt(
      getSafeScheduleAt(lifecycleDueAt)!,
      (internal as any).teamChallenges.processScheduledExpiry,
      { challengeId: challenge._id, expectedDueAt: lifecycleDueAt },
    );
    return {
      lifecycleDueAt,
      lifecycleScheduledAt: lifecycleDueAt,
      lifecycleScheduledFnId: String(scheduledId),
    };
  },
});

export const runReschedulePendingTeamChallengeAcceptDeadlines = migrations.runner(
  (internal as any).migrations.reschedulePendingTeamChallengeAcceptDeadlines,
);

export const scheduleExistingZoneOfferExpiries = migrations.define({
  table: "zoneOffers",
  migrateOne: async (ctx, offer) => {
    if (offer.status !== "pending") return;
    const expiresAt = Number(offer.expiresAt || offer.responseExpiresAt || 0);
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) return;
    if (Number(offer.expiryScheduledAt || 0) === expiresAt && offer.expiryScheduledFnId) return;
    const expiryScheduledFnId: any = await ctx.scheduler.runAt(
      getSafeScheduleAt(expiresAt)!,
      offer.requestKind === "broadcast_fanout"
        ? (internal as any).matchroomBroadcast.expireBroadcastCounterOffer
        : (internal as any).zoneAdminBooking.expireDirectCounterOffer,
      { offerId: offer._id },
    );
    return {
      expiryScheduledAt: expiresAt,
      expiryScheduledFnId: String(expiryScheduledFnId),
    };
  },
});

export const runScheduleExistingZoneOfferExpiries = migrations.runner(
  (internal as any).migrations.scheduleExistingZoneOfferExpiries,
);
