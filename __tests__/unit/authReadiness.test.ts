import { isAuthenticatedProfileReady } from "../../src/utils/authReadiness";

const readyState = {
  authLoading: false,
  convexAuthLoading: false,
  isAuthenticated: true,
  authUserId: "auth-user",
  profileAuthId: "auth-user",
  profileUserId: "profile-user",
};

describe("authenticated profile readiness", () => {
  it("allows protected queries only when both auth layers and the matching profile are ready", () => {
    expect(isAuthenticatedProfileReady(readyState)).toBe(true);
  });

  it("blocks protected queries while Convex authentication is loading", () => {
    expect(isAuthenticatedProfileReady({ ...readyState, convexAuthLoading: true })).toBe(false);
  });

  it("blocks stale cached profiles from a different session", () => {
    expect(isAuthenticatedProfileReady({ ...readyState, profileAuthId: "previous-user" })).toBe(false);
  });

  it("allows a matching profile before its private authId field is hydrated", () => {
    expect(isAuthenticatedProfileReady({ ...readyState, profileAuthId: undefined })).toBe(true);
  });

  it("blocks protected queries when the current profile is unavailable", () => {
    expect(isAuthenticatedProfileReady({ ...readyState, profileUserId: null })).toBe(false);
  });
});
