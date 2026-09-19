import fs from "fs";
import path from "path";

const backend = fs.readFileSync(path.join(process.cwd(), "convex/easypaisa.ts"), "utf8");
const createScreen = fs.readFileSync(path.join(process.cwd(), "app/matchrooms/create/index.tsx"), "utf8");
const submitFlow = fs.readFileSync(
  path.join(process.cwd(), "app-shared/matchrooms/create/hooks/useMatchroomCreateSubmitFlow.ts"),
  "utf8",
);

describe("Easypaisa recovery safety contracts", () => {
  it("retires only stale failed/expired attempts before creating a fresh one", () => {
    expect(backend).toContain("isRetryableStaleCheckoutTransaction");
    expect(backend).toContain('reason: "superseded_by_retry"');
    expect(backend).toContain("forceNew: v.optional(v.boolean())");
    expect(backend).toContain("await retireCheckoutAttemptForRetry(ctx, activeTransaction, now)");
  });

  it("allows authoritative inquiry reconciliation after a retry, while retaining the retry audit marker", () => {
    expect(backend).toContain('reason: "superseded_by_retry"');
    expect(backend).toContain('args.source !== "inquiry"');
    expect(backend).not.toContain("supersededByRetry");
    expect(backend).toContain('lastError: "terminal_state_requires_provider_inquiry"');
  });

  it("lets pending payment UI dismiss while retaining recovery controls", () => {
    const lockStart = createScreen.indexOf("const isEasypaisaPaymentLocked");
    const lockEnd = createScreen.indexOf("const easypaisaDialogTitle", lockStart);
    expect(createScreen.slice(lockStart, lockEnd)).not.toContain('easypaisaPaymentPhase === "payment_sent"');
    expect(createScreen).toContain("easypaisaRetryablePending");
    expect(createScreen).toContain("Try again");
    expect(submitFlow).toContain('easypaisaPaymentPhase === "payment_sent")');
    expect(submitFlow).toContain("setShowEasypaisaPhonePrompt(false);");
  });
});
