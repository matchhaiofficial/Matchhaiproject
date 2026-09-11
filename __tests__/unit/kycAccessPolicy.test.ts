import { isKycAccessAllowed as isClientKycAllowed } from "../../src/utils/verificationGate";

describe("verified-only KYC access policy", () => {
  const previousSkipKyc = process.env.EXPO_PUBLIC_SKIP_KYC_VERIFICATION;
  const previousSkipPhone = process.env.EXPO_PUBLIC_SKIP_PHONE_OTP;

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_SKIP_KYC_VERIFICATION;
    delete process.env.EXPO_PUBLIC_SKIP_PHONE_OTP;
  });

  afterAll(() => {
    if (previousSkipKyc === undefined) delete process.env.EXPO_PUBLIC_SKIP_KYC_VERIFICATION;
    else process.env.EXPO_PUBLIC_SKIP_KYC_VERIFICATION = previousSkipKyc;
    if (previousSkipPhone === undefined) delete process.env.EXPO_PUBLIC_SKIP_PHONE_OTP;
    else process.env.EXPO_PUBLIC_SKIP_PHONE_OTP = previousSkipPhone;
  });

  it.each([undefined, null, "not_started", "pending", "in_progress", "in_review", "rejected", "expired"])(
    "does not grant gameplay access for %s",
    (status) => {
      expect(isClientKycAllowed(status)).toBe(false);
    },
  );

  it("grants gameplay access only after verification", () => {
    expect(isClientKycAllowed("verified")).toBe(true);
  });
});
