// Phase 1H (zone) — zone lifecycle & migration helpers.
import {
  getZoneMigrationStatus,
  isZoneMigrationReady,
  getZoneLifecycleLabel,
  getZoneMigrationLabel,
} from "../../src/utils/zoneLifecycle";

describe("getZoneMigrationStatus", () => {
  it("treats perBranchSeatModel as succeeded", () => {
    expect(getZoneMigrationStatus({ migration: { perBranchSeatModel: true } })).toBe("succeeded");
  });
  it("reads explicit migration.status", () => {
    expect(getZoneMigrationStatus({ migration: { status: "pending" } })).toBe("pending");
    expect(getZoneMigrationStatus({ migration: { status: "failed" } })).toBe("failed");
  });
  it("defaults to not_started", () => {
    expect(getZoneMigrationStatus(null)).toBe("not_started");
    expect(getZoneMigrationStatus({})).toBe("not_started");
  });
});

describe("isZoneMigrationReady", () => {
  it("is ready only for active + migrated zones", () => {
    expect(isZoneMigrationReady({ status: "active", migration: { perBranchSeatModel: true } })).toBe(true);
  });
  it("is not ready when inactive or unmigrated", () => {
    expect(isZoneMigrationReady({ status: "pending-review", migration: { perBranchSeatModel: true } })).toBe(false);
    expect(isZoneMigrationReady({ status: "active" })).toBe(false);
  });
});

describe("labels", () => {
  it("lifecycle labels", () => {
    expect(getZoneLifecycleLabel({ status: "active" })).toBe("Active");
    expect(getZoneLifecycleLabel({ status: "approved_pending_migration" })).toBe("Approved pending migration");
    expect(getZoneLifecycleLabel(null)).toBe("Pending review");
  });
  it("migration labels", () => {
    expect(getZoneMigrationLabel({ migration: { status: "pending" } })).toBe("Migration in progress");
    expect(getZoneMigrationLabel({ migration: { perBranchSeatModel: true } })).toBe("Migration complete");
    expect(getZoneMigrationLabel({})).toBe("Migration not started");
  });
});
