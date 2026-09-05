import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("zone admin reactive subscriptions", () => {
  it("uses Convex invalidation watches instead of timer polling", () => {
    const booking = read("src/services/convex/zoneAdminBookingService.ts");
    const resources = read("src/services/convex/zoneAdminResourceService.ts");
    const registry = read("src/services/convex/sharedPollingRegistry.ts");
    const combined = `${booking}\n${resources}`;

    expect(combined).toContain("convex.watchQuery");
    expect(combined).toContain("watch.onUpdate(publishCurrent)");
    expect(combined).not.toContain("POLL_INTERVAL_MS");
    expect(combined).not.toContain("setInterval(");
    expect(registry).toContain("currentState.unsubscribe?.()");
  });

  it("repairs refunds through a captain-scoped index", () => {
    const challenges = read("convex/teamChallenges.ts");
    const repair = challenges.slice(
      challenges.indexOf("export const repairRejectedRefundsForCaptain"),
      challenges.indexOf("export const proposeVenue"),
    );

    expect(repair).toContain('.withIndex("by_captainAUid_and_status"');
    expect(repair).not.toContain('.withIndex("by_status"');
  });
});
