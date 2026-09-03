import { getPushRegistrationRetryDelayMs } from "../../src/utils/pushRegistrationRetry";

describe("push registration retry timing", () => {
  it("backs off repeated token registration failures", () => {
    expect(getPushRegistrationRetryDelayMs(0)).toBe(5_000);
    expect(getPushRegistrationRetryDelayMs(1)).toBe(30_000);
    expect(getPushRegistrationRetryDelayMs(2)).toBe(2 * 60_000);
    expect(getPushRegistrationRetryDelayMs(3)).toBe(10 * 60_000);
  });

  it("caps long-running retries and handles invalid attempts", () => {
    expect(getPushRegistrationRetryDelayMs(100)).toBe(10 * 60_000);
    expect(getPushRegistrationRetryDelayMs(-1)).toBe(5_000);
    expect(getPushRegistrationRetryDelayMs(Number.NaN)).toBe(5_000);
  });
});
