import { assertCanManuallyVerifyKyc } from "../../convex/adminKycPolicy";
import fs from "fs";
import path from "path";

describe("manual KYC review authorization", () => {
  it("rejects a super-admin approving their own identity", () => {
    expect(() => assertCanManuallyVerifyKyc("user_admin", "user_admin")).toThrow(
      "Super admins cannot manually approve their own KYC.",
    );
  });

  it("allows a super-admin to review a different user", () => {
    expect(() => assertCanManuallyVerifyKyc("user_admin", "user_player")).not.toThrow();
  });

  it("keeps the server guard immediately before manual verification writes", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "convex/admin.ts"), "utf8");
    const start = source.indexOf("export const manuallyVerifyIdentityVerification");
    const end = source.indexOf("function isRoomFull", start);
    const review = source.slice(start, end);
    expect(review).toContain("assertCanManuallyVerifyKyc(String(admin.profile._id), String(verification.userId))");
    expect(review.indexOf("assertCanManuallyVerifyKyc")).toBeLessThan(review.indexOf("ctx.db.patch(args.verificationId"));
  });
});
