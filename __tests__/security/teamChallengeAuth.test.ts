import { getAuthenticatedUserId } from "../../convex/teamChallenges";

const mockGetAuthUser = jest.fn();

jest.mock("../../convex/auth", () => ({
  authComponent: {
    getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  },
}));

describe("Team Challenge authentication", () => {
  beforeEach(() => {
    mockGetAuthUser.mockReset();
  });

  it("rejects a client-supplied user id when no authenticated identity exists", async () => {
    const expectedUid = "users:client-supplied";
    mockGetAuthUser.mockResolvedValue(null);

    const ctx = {
      db: {
        get: jest.fn().mockResolvedValue({
          _id: expectedUid,
          authId: "auth:victim",
          kycVerificationStatus: "verified",
        }),
      },
    };

    await expect(
      getAuthenticatedUserId(ctx, expectedUid),
    ).rejects.toThrow("Not authenticated");
  });

  it("accepts an authenticated user whose profile matches the expected user id", async () => {
    const user = {
      _id: "users:captain",
      authId: "auth:captain",
      kycVerificationStatus: "verified",
    };
    mockGetAuthUser.mockResolvedValue({
      _id: "auth-record:captain",
      userId: user._id,
    });

    const ctx = {
      db: {
        get: jest.fn().mockResolvedValue(user),
      },
    };

    await expect(
      getAuthenticatedUserId(ctx, user._id),
    ).resolves.toBe(user._id);
  });

  it("rejects an authenticated user acting for a different client-supplied user id", async () => {
    const captain = {
      _id: "users:captain",
      authId: "auth:captain",
      kycVerificationStatus: "verified",
    };
    const victim = {
      _id: "users:victim",
      authId: "auth:victim",
      kycVerificationStatus: "verified",
    };
    mockGetAuthUser.mockResolvedValue({
      _id: "auth-record:captain",
      userId: captain._id,
    });

    const ctx = {
      db: {
        get: jest.fn(async (id: string) => id === victim._id ? victim : captain),
      },
    };

    await expect(
      getAuthenticatedUserId(ctx, victim._id),
    ).rejects.toThrow("You can only perform this action for your own account");
  });
});
