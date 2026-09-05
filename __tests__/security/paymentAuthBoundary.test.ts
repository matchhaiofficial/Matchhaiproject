import fs from "fs";
import path from "path";

const source = fs.readFileSync(path.join(process.cwd(), "convex/easypaisa.ts"), "utf8");

describe("Easypaisa public identity and response boundary", () => {
  it("never falls back to loading a caller-supplied user id", () => {
    expect(source).toContain("requireSelf(ctx, fallbackUserId)");
    expect(source).not.toContain("ctx.db.get(fallbackUserId)");
  });

  it("does not expose raw provider payloads or payment tokens from user status", () => {
    const statusStart = source.indexOf("export const getCheckoutStatus");
    const statusEnd = source.indexOf("export const getCheckoutSessionByToken", statusStart);
    const statusSource = source.slice(statusStart, statusEnd);
    expect(statusSource).not.toContain("providerPayload:");
    expect(statusSource).not.toContain("paymentToken:");
    expect(statusSource).not.toContain("lastError:");
  });

  it("gates checkout diagnostics to a server-authorized super admin", () => {
    const debugStart = source.indexOf("export const getLatestCheckoutDebug");
    const debugSource = source.slice(debugStart);
    expect(debugSource).toContain("await requireSuperAdmin(ctx)");
    expect(debugSource).not.toContain("providerPayload:");
  });
});
