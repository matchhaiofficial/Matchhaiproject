import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("remediation contracts", () => {
  it("authenticates block ownership and applies blocks from player reports", () => {
    const social = read("convex/social.ts");
    const reports = read("convex/reports.ts");
    expect(social).toContain("await requireSelf(ctx, args.userId)");
    expect(reports).toContain("await ensureUserBlock(ctx, args.reporterUid, args.reportedUserId)");
  });

  it("keeps backend KYC access verified-only", () => {
    const kycGate = read("convex/kycGate.ts");
    expect(kycGate).toContain('return status === "verified"');
    expect(kycGate).not.toContain('status === "pending" ||');
    const bypassBody = kycGate.slice(
      kycGate.indexOf("export function isKycVerificationBypassEnabled"),
      kycGate.indexOf("export function isPhoneOtpBypassEnabled"),
    );
    expect(bypassBody).toContain("SKIP_KYC_VERIFICATION");
    expect(bypassBody).not.toContain("SKIP_PHONE_OTP");
  });

  it("requires server-side phone OTP proof for player and zone registration", () => {
    const users = read("convex/users.ts");
    expect(users.match(/\["player", "zone"\]\.includes\(args\.accountType\)/g)).toHaveLength(2);
    expect(users).toContain("Please verify this phone number again before creating your profile.");
  });

  it("enforces blocked-pair admission at the shared roster boundary", () => {
    const matchrooms = read("convex/matchrooms.ts");
    expect(matchrooms).toContain("await assertUserCanJoinRoom(ctx, requester._id, room)");
    expect(matchrooms).toContain("await assertRosterHasNoBlockedPair(ctx, playerUids)");
  });

  it("keeps tier preview and final creation checks server authoritative", () => {
    const matchrooms = read("convex/matchrooms.ts");
    expect(matchrooms).toContain("export const checkRateOptionsAvailability = query");
    expect(matchrooms).toContain("await assertZoneResourceCapacityAvailable(ctx");
    expect(matchrooms).toContain("await assertBranchOperatingHoursAvailable(ctx");
  });

  it("uses VeevoTech MNP routing with a non-blocking fallback", () => {
    const otp = read("convex/phoneOtp.ts");
    expect(otp).toContain("/v3/hrl_lookup");
    expect(otp).toContain("receivernetwork");
    expect(otp).toContain("MNP enrichment is best-effort");
  });
});
