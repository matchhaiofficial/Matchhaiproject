import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("matchroom lifecycle cron safety", () => {
  it("keeps production registration behind the explicit enablement flag", () => {
    const crons = read("convex/crons.ts");

    expect(crons).toContain('process.env.MATCHHAI_ENABLE_LIFECYCLE_CRON === "1"');
  });

  it("uses the due-time index without a non-advancing status-scan fallback", () => {
    const matchrooms = read("convex/matchrooms.ts");
    const sweep = matchrooms.slice(
      matchrooms.indexOf("export const runLifecycleSweep"),
      matchrooms.indexOf("export const captureBookingIntentHold"),
    );

    expect(sweep).toContain('withIndex("by_status_and_lifecycleDueAt"');
    expect(sweep).not.toContain("MATCHHAI_USE_INDEXED_LIFECYCLE_SWEEP");
    expect(sweep).not.toContain('withIndex("by_status"');
  });
});
