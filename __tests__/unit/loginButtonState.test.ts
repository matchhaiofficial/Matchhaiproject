import { getLoginButtonState } from "../../src/utils/loginButtonState";

describe("login button state", () => {
  it("is active and clickable when credentials are valid", () => {
    expect(
      getLoginButtonState({
        isIdentifierValid: true,
        hasPassword: true,
        loading: false,
        isLockedOut: false,
      }),
    ).toEqual({ canSubmit: true, showActiveStyle: true });
  });

  it("keeps the active visual while a valid login is processing", () => {
    expect(
      getLoginButtonState({
        isIdentifierValid: true,
        hasPassword: true,
        loading: true,
        isLockedOut: false,
      }),
    ).toEqual({ canSubmit: false, showActiveStyle: true });
  });

  it("is disabled-looking when credentials are incomplete", () => {
    expect(
      getLoginButtonState({
        isIdentifierValid: true,
        hasPassword: false,
        loading: false,
        isLockedOut: false,
      }),
    ).toEqual({ canSubmit: false, showActiveStyle: false });
  });
});
