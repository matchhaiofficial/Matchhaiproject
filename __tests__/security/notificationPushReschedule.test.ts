import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("notification push rescheduling regression guard", () => {
  it("reschedules push delivery when active notifications are updated", () => {
    const source = read("convex/notifications.ts");

    expect(source).toContain("shouldQueuePushAfterActiveUpsert");
    expect(source).toContain('pushState: "queued" as const');
    expect(source).toContain("const scheduledPush = await scheduleNotificationPush(ctx, active._id, shouldQueuePush)");
    expect(source).toContain("return { notificationId: active._id, created: false, scheduledPush }");
  });
});
