import {
  isRegistrationAuthSyncError,
  retryRegistrationAuthOperation,
  waitForExpectedRegistrationUser,
} from "../../src/utils/registrationAuth";

describe("registration auth synchronization", () => {
  it("only classifies temporary owner-auth failures as synchronization errors", () => {
    expect(isRegistrationAuthSyncError(new Error("Unauthenticated"))).toBe(true);
    expect(isRegistrationAuthSyncError(new Error("User profile not found"))).toBe(true);
    expect(isRegistrationAuthSyncError(new Error("Not authorized"))).toBe(true);
    expect(isRegistrationAuthSyncError(new Error("ArgumentValidationError"))).toBe(false);
  });

  it("retries an owner operation while the new session propagates", async () => {
    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(new Error("Unauthenticated"))
      .mockResolvedValue("saved");

    await expect(retryRegistrationAuthOperation(operation, [0, 0])).resolves.toBe("saved");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry non-auth failures", async () => {
    const operation = jest.fn<Promise<string>, []>().mockRejectedValue(new Error("Invalid data"));

    await expect(retryRegistrationAuthOperation(operation, [0, 0])).rejects.toThrow("Invalid data");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("waits until the active Convex actor matches the newly-created user", async () => {
    const probe = jest
      .fn<Promise<string | null>, []>()
      .mockRejectedValueOnce(new Error("Unauthenticated"))
      .mockResolvedValueOnce("previous-user")
      .mockResolvedValue("new-user");

    await expect(waitForExpectedRegistrationUser("new-user", probe, [0, 0, 0])).resolves.toBe(true);
    expect(probe).toHaveBeenCalledTimes(3);
  });
});
