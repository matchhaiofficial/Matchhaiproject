import fs from "node:fs";
import path from "node:path";

type AppConfig = {
  expo: {
    owner?: string;
    ios?: { bundleIdentifier?: string };
    android?: { package?: string };
    extra?: { eas?: { projectId?: string } };
    updates?: unknown;
  };
};

type EasConfig = {
  build?: Record<string, {
    environment?: string;
    distribution?: string;
    channel?: unknown;
    env?: Record<string, string>;
    android?: { buildType?: string };
  }>;
  submit?: Record<string, unknown>;
};

const readJson = <T>(fileName: string): T =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), fileName), "utf8")) as T;

describe("EAS project and release configuration", () => {
  const app = readJson<AppConfig>("app.json");
  const eas = readJson<EasConfig>("eas.json");

  it("links the app to the shared MatchHai EAS project and keeps store identifiers stable", () => {
    expect(app.expo.owner).toBe("matchhai");
    expect(app.expo.extra?.eas?.projectId).toBe("cc63aac8-7e68-4dbc-9e95-c59e145fb7b4");
    expect(app.expo.ios?.bundleIdentifier).toBe("com.ovaisto.matchhai");
    expect(app.expo.android?.package).toBe("com.ovaisto.matchhai");
  });

  it("keeps production isolated while remote QA uses an internal Android APK", () => {
    expect(Object.keys(eas.build || {})).toEqual(["preview", "production"]);
    expect(eas.build?.preview?.environment).toBe("preview");
    expect(eas.build?.preview?.distribution).toBe("internal");
    expect(eas.build?.preview?.android?.buildType).toBe("apk");
    expect(eas.build?.preview?.env?.EXPO_PUBLIC_ENV).toBe("development");
    expect(eas.build?.production?.environment).toBe("production");
    expect(eas.submit?.production).toEqual({});
  });

  it("does not commit stale or placeholder Convex values to EAS", () => {
    const serialized = fs.readFileSync(path.join(process.cwd(), "eas.json"), "utf8");
    expect(serialized).not.toMatch(/acrobatic-bison-271|nautical-ibex-721|REPLACE_WITH_/);
    expect(eas.build?.production?.env).not.toHaveProperty("EXPO_PUBLIC_CONVEX_URL");
    expect(eas.build?.production?.env).not.toHaveProperty("EXPO_PUBLIC_CONVEX_SITE_URL");
    expect(eas.build?.production?.env).not.toHaveProperty("EXPO_PUBLIC_CONVEX_DEPLOYMENT_CLASS");
    expect(eas.build?.production?.env).not.toHaveProperty("EXPO_PUBLIC_CONVEX_ALLOWED_URLS");
    expect(eas.build?.preview?.env).not.toHaveProperty("EXPO_PUBLIC_CONVEX_URL");
    expect(eas.build?.preview?.env).not.toHaveProperty("EXPO_PUBLIC_CONVEX_SITE_URL");
  });

  it("does not opt the app into Expo Updates or an update channel", () => {
    expect(app.expo.updates).toBeUndefined();
    expect(eas.build?.production?.channel).toBeUndefined();
  });
});
