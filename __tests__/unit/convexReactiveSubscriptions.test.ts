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
});
