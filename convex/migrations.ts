import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import schema from "./schema";
import { getLifecycleDueAt } from "./matchroomLifecycle";

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
