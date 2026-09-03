import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import schema from "./schema";
import { getLifecycleDueAt } from "./matchroomLifecycle";
import {
  getBookingRequestLifecycleDueAt,
  getPaymentNextReconcileAt,
  getTeamChallengeLifecycleDueAt,
} from "./maintenanceDue";

export const migrations = new Migrations(components.migrations, {
  schema,
  defaultBatchSize: 50,
});

export const backfillMatchroomLifecycleDueAt = migrations.define({
  table: "matchrooms",
  migrateOne: (_ctx, room) => {
    const lifecycleDueAt = getLifecycleDueAt(room);
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
