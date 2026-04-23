export type ZoneLifecycleStatus =
  | "pending-review"
  | "approved_pending_migration"
  | "active"
  | "rejected"
  | "suspended";

export type ZoneMigrationStatus = "not_started" | "pending" | "succeeded" | "failed";

export type ZoneMigrationState = {
  perBranchSeatModel?: boolean;
  status?: ZoneMigrationStatus;
  resourceModelVersion?: number;
  migratedAt?: number;
  lastAttemptAt?: number;
  lastError?: string;
  retryCount?: number;
  branchCount?: number;
  resourceCount?: number;
} | null | undefined;

export type ZoneLifecycleLike = {
  status?: ZoneLifecycleStatus | string | null;
  migration?: ZoneMigrationState;
};

export function getZoneMigrationStatus(zone?: ZoneLifecycleLike | null): ZoneMigrationStatus {
  if (zone?.migration?.perBranchSeatModel) return "succeeded";
  if (zone?.migration?.status) return zone.migration.status;
  return "not_started";
}

export function isZoneMigrationReady(zone?: ZoneLifecycleLike | null) {
  return zone?.status === "active" && getZoneMigrationStatus(zone) === "succeeded";
}

export function getZoneLifecycleLabel(zone?: ZoneLifecycleLike | null) {
  switch (zone?.status) {
    case "approved_pending_migration":
      return "Approved pending migration";
    case "active":
      return "Active";
    case "rejected":
      return "Rejected";
    case "suspended":
      return "Suspended";
    case "pending-review":
    default:
      return "Pending review";
  }
}

export function getZoneMigrationLabel(zone?: ZoneLifecycleLike | null) {
  switch (getZoneMigrationStatus(zone)) {
    case "pending":
      return "Migration in progress";
    case "succeeded":
      return "Migration complete";
    case "failed":
      return "Migration failed";
    case "not_started":
    default:
      return "Migration not started";
  }
}
