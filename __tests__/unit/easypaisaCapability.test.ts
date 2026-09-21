import { resolveEasypaisaCapability } from "../../convex/easypaisaConfig";
import fs from "fs";
import path from "path";

const configured = {
  EASYPAISA_ENABLED: "1",
  EASYPAISA_ENV: "staging",
  EXPO_PUBLIC_CONVEX_SITE_URL: "https://qa.example.test",
  EASYPAISA_STORE_ID: "store",
  EASYPAISA_API_USERNAME: "username",
  EASYPAISA_API_PASSWORD: "password",
};

describe("Easypaisa capability gating", () => {
  it("defaults unavailable when the environment is not explicitly configured", () => {
    const result = resolveEasypaisaCapability({ ...configured, EASYPAISA_ENV: undefined });
    expect(result.available).toBe(false);
    expect(result.environment).toBe("unconfigured");
    expect(result.hostedFallbackEnabled).toBe(false);
  });

  it.each([undefined, "0"])('defaults unavailable when EASYPAISA_ENABLED is %s', (enabled) => {
    const result = resolveEasypaisaCapability({ ...configured, EASYPAISA_ENABLED: enabled });
    expect(result.available).toBe(false);
    expect(result.hostedFallbackEnabled).toBe(false);
  });

  it("requires complete server readiness for staging or production", () => {
    expect(resolveEasypaisaCapability({ ...configured, EASYPAISA_STORE_ID: undefined }).available).toBe(false);
    expect(resolveEasypaisaCapability(configured).available).toBe(true);
  });

  it("keeps hosted fallback disabled unless explicitly enabled", () => {
    expect(resolveEasypaisaCapability(configured).hostedFallbackEnabled).toBe(false);
    expect(resolveEasypaisaCapability({ ...configured, EASYPAISA_HOSTED_FALLBACK_ENABLED: "1" }).hostedFallbackEnabled).toBe(true);
  });

  it("enforces the capability gate before provider actions and HTTP callbacks", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "convex/easypaisa.ts"), "utf8");
    expect(source).toContain("ensureEasypaisaAvailable();");
    expect(source).toContain("export const reconcilePaymentByOrderRef = internalAction");
    expect(source).toContain("EASYPAISA_HOSTED_FALLBACK_ENABLED = EASYPAISA_CAPABILITY.hostedFallbackEnabled");
    expect(source).toContain('return new Response("Easypaisa is unavailable.", { status: 410 });');
    const nodeSource = fs.readFileSync(path.join(process.cwd(), "convex/easypaisaNode.ts"), "utf8");
    expect(nodeSource).toContain('process.env.EASYPAISA_ENABLED || ""');
    expect(nodeSource).toContain("Easypaisa provider operations are disabled.");
    expect(source.slice(source.indexOf("export const startCheckout"), source.indexOf("export const startCheckout") + 3000)).toContain("ensurePaymentConfig();");
    expect(source.slice(source.indexOf("export const syncTransactionStatus"), source.indexOf("export const syncTransactionStatus") + 1200)).toContain("ensurePaymentConfig();");
  });

  it("keeps the QA payment option visibly disabled before any provider action", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "app/matchrooms/book/pay/[intentId].tsx"), "utf8");
    expect(source).toContain("api.easypaisa.getCapability");
    expect(source).toContain("disabled={!easypaisaAvailable}");
    expect(source).toContain("Easypaisa unavailable");
    expect(fs.readFileSync(path.join(process.cwd(), "app/(player)/wallet.tsx"), "utf8")).toContain("!easypaisaAvailable");
  });
});
