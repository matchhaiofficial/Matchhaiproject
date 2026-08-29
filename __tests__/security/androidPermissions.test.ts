import appConfig from "../../app.json";

describe("Android permission configuration", () => {
  it("declares every explicit Android permission at most once", () => {
    const permissions = appConfig.expo.android.permissions;

    expect(new Set(permissions).size).toBe(permissions.length);
  });

  it("preserves microphone permission for voice messages", () => {
    expect(appConfig.expo.android.permissions).toContain(
      "android.permission.RECORD_AUDIO",
    );
  });
});
