import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("profile identity verification boundaries", () => {
  it("binds profile creation to the authenticated Better Auth identity", () => {
    const users = read("convex/users.ts");
    const createUser = users.slice(
      users.indexOf("export const create = mutation"),
      users.indexOf("// Update user profile"),
    );

    expect(createUser).toContain("authComponent.getAuthUser(ctx)");
    expect(createUser).toContain("candidateAuthIds.includes(requestedAuthId)");
    expect(createUser).toContain("normalizeEmail(authUser.email) !== email");
    expect(createUser).toContain('throw new Error("Authenticated account does not match profile creation request.")');
  });

  it("derives signup phone verification from recent server OTP evidence", () => {
    const users = read("convex/users.ts");
    const createUser = users.slice(
      users.indexOf("export const create = mutation"),
      users.indexOf("// Update user profile"),
    );

    expect(createUser).toContain("internal.phoneOtp.getRecentVerified");
    expect(createUser).toContain("phoneHash: verifiedPhoneHash");
    expect(createUser).toContain("phoneOtpVerified: Boolean(verifiedPhone)");
    expect(createUser).toContain("phoneOtpVerifiedAt: verifiedPhone?.updatedAt");
    expect(createUser).not.toContain("phoneOtpVerified: args.phoneOtpVerified");
    expect(createUser).not.toContain("phoneNumberHash: args.phoneNumberHash");
  });

  it("re-verifies phone changes against server OTP records", () => {
    const kyc = read("convex/kyc.ts");
    const requestPhoneChange = kyc.slice(
      kyc.indexOf("export const requestPhoneChange"),
    );

    expect(requestPhoneChange).toContain("const verifiedPhoneHash = await sha256Hex(args.phoneE164)");
    expect(requestPhoneChange).toContain("internal.phoneOtp.getRecentVerified");
    expect(requestPhoneChange).toContain('throw new Error("Please verify this phone number again before saving it.")');
    expect(requestPhoneChange).toContain("phoneOtpVerifiedAt: verifiedPhone.updatedAt");
    expect(requestPhoneChange).toContain("phoneNumberMasked: verifiedPhone.phoneMasked");
    expect(requestPhoneChange).toContain("phoneNumberHash: verifiedPhoneHash");
    expect(requestPhoneChange).not.toContain("phoneOtpVerifiedAt: args.verifiedAt");
    expect(requestPhoneChange).not.toContain("phoneNumberHash: args.phoneHash");
  });

  it("syncs a server-verified signup phone to the authenticated Better Auth user", () => {
    const users = read("convex/users.ts");
    const createUser = users.slice(
      users.indexOf("export const create = mutation"),
      users.indexOf("// Update user profile"),
    );

    expect(createUser).toContain("components.betterAuth.adapter.updateOne");
    expect(createUser).toContain('where: [{ field: "_id", operator: "eq", value: requestedAuthId }]');
    expect(createUser).toContain("phoneNumber: normalizedPhone");
    expect(createUser).toContain("phoneNumberVerified: true");
  });

  it("syncs a server-verified phone change to the authenticated Better Auth user", () => {
    const kyc = read("convex/kyc.ts");
    const requestPhoneChange = kyc.slice(
      kyc.indexOf("export const requestPhoneChange"),
    );

    expect(requestPhoneChange).toContain("components.betterAuth.adapter.updateOne");
    expect(requestPhoneChange).toContain('where: [{ field: "_id", operator: "eq", value: authId }]');
    expect(requestPhoneChange).toContain("phoneNumber: args.phoneE164");
    expect(requestPhoneChange).toContain("phoneNumberVerified: true");
  });
});
