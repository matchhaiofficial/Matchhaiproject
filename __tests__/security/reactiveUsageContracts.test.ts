import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("reactive Convex usage contracts", () => {
  test("the global notification bridge does not subscribe to the full player dashboard", () => {
    const source = read("src/components/NotificationRuntimeBridge.tsx");
    expect(source).not.toContain("api.dashboard.getPlayerHomeSummary");
    expect(source).toContain("api.matchrooms.listForUserSchedule");
    expect(source).toContain('tab: "upcoming"');
    expect(source).toContain("limit: 3");
  });

  test("presence is throttled and isolated from the broad home summary", () => {
    const hook = read("src/hooks/usePresenceHeartbeat.ts");
    const presence = read("convex/presence.ts");
    const dashboard = read("convex/dashboard.ts");
    const summaryStart = dashboard.indexOf("export const getPlayerHomeSummary");
    const countStart = dashboard.indexOf("export const getOnlineFriendCount");
    const summary = dashboard.slice(summaryStart, countStart);

    expect(hook).toContain("HEARTBEAT_INTERVAL_MS = 90_000");
    expect(presence).toContain("PRESENCE_WRITE_THROTTLE_MS");
    expect(presence).toContain("now - current.lastActiveAt < PRESENCE_WRITE_THROTTLE_MS");
    expect(summary).not.toContain("friendDocs");
    expect(summary).not.toContain("lastActiveAt");
  });
});
