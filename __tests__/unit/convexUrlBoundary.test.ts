import { assertConvexUrl } from "../../src/lib/convex";

describe("Convex URL deployment boundary", () => {
  const qa = {
    appEnv: "staging",
    deploymentClass: "qa",
    allowedUrls: "https://striped-dog-623.convex.cloud",
  };

  it("accepts the explicitly allowlisted QA cloud deployment", () => {
    expect(() => assertConvexUrl("https://striped-dog-623.convex.cloud", qa)).not.toThrow();
  });

  it("accepts other valid non-production deployments when no allowlist is supplied", () => {
    expect(() => assertConvexUrl("https://fresh-qa-123.convex.cloud", {
      appEnv: "development",
      deploymentClass: "development",
    })).not.toThrow();
  });

  it.each([
    undefined,
    "",
    "REPLACE_WITH_QA_DEPLOYMENT",
    "http://striped-dog-623.convex.cloud",
    "https://striped-dog-623.convex.cloud/api",
    "https://striped-dog-623.convex.cloud?query=unexpected",
    "not-a-url",
  ])("rejects missing, placeholder, or malformed URL %p", (url) => {
    expect(() => assertConvexUrl(url, qa)).toThrow();
  });

  it("rejects a non-QA URL outside the QA allowlist", () => {
    expect(() => assertConvexUrl("https://another-dev-456.convex.cloud", qa)).toThrow(
      "outside EXPO_PUBLIC_CONVEX_ALLOWED_URLS",
    );
  });

  it("requires an explicit production class and exact production allowlist", () => {
    expect(() => assertConvexUrl("https://production-123.convex.cloud", {
      appEnv: "production",
      deploymentClass: "qa",
      allowedUrls: "https://production-123.convex.cloud",
    })).toThrow("DEPLOYMENT_CLASS=production");

    expect(() => assertConvexUrl("https://production-123.convex.cloud", {
      appEnv: "production",
      deploymentClass: "production",
    })).toThrow("allowlist");
  });

  it("rejects a QA/dev class from a production build", () => {
    expect(() => assertConvexUrl("https://striped-dog-623.convex.cloud", {
      appEnv: "production",
      deploymentClass: "qa",
      allowedUrls: "https://striped-dog-623.convex.cloud",
    })).toThrow("DEPLOYMENT_CLASS=production");
  });
});
