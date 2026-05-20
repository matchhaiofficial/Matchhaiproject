import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { convex } from "../../lib/convex";

type StartCheckoutResult =
  | {
      ok: true;
      transactionId: string;
      orderRefNum: string;
      checkoutUrl: string | null;
      status: string;
      attempt: "reused" | "created";
      attemptMessage: string;
      transactionType: "MA" | "OTC";
      actionRequired: string | null;
      hostedFallbackAvailable: boolean;
      paymentToken?: string | null;
      paymentTokenExpiryDateTime?: string | null;
      expiresAt?: number;
    }
  | {
      ok: false;
      message: string;
    };

export async function startEasypaisaBookingCheckout(intentId: string): Promise<StartCheckoutResult> {
  try {
    const result: any = await convex.action((api as any).easypaisa.startCheckout, {
      kind: "booking_intent",
      bookingIntentId: intentId as Id<"bookingIntents">,
    });

    return {
      ok: true,
      transactionId: String(result.transactionId),
      orderRefNum: String(result.orderRefNum),
      checkoutUrl: result.checkoutUrl ? String(result.checkoutUrl) : null,
      expiresAt: typeof result.expiresAt === "number" ? result.expiresAt : undefined,
      status: String(result.status || "pending"),
      attempt: result.attempt === "reused" ? "reused" : "created",
      attemptMessage: String(result.attemptMessage || "Starting a new payment attempt."),
      transactionType: String(result.transactionType || "MA") as "MA" | "OTC",
      actionRequired: result.actionRequired ? String(result.actionRequired) : null,
      hostedFallbackAvailable: Boolean(result.hostedFallbackAvailable),
      paymentToken: result.paymentToken ? String(result.paymentToken) : null,
      paymentTokenExpiryDateTime: result.paymentTokenExpiryDateTime ? String(result.paymentTokenExpiryDateTime) : null,
    };
  } catch (error: any) {
    return { ok: false, message: error?.message || "Failed to start Easypaisa checkout." };
  }
}

export async function startEasypaisaWalletTopup(amount: number): Promise<StartCheckoutResult> {
  try {
    const result: any = await convex.action((api as any).easypaisa.startCheckout, {
      kind: "wallet_topup",
      amount,
    });

    return {
      ok: true,
      transactionId: String(result.transactionId),
      orderRefNum: String(result.orderRefNum),
      checkoutUrl: result.checkoutUrl ? String(result.checkoutUrl) : null,
      expiresAt: typeof result.expiresAt === "number" ? result.expiresAt : undefined,
      status: String(result.status || "pending"),
      attempt: result.attempt === "reused" ? "reused" : "created",
      attemptMessage: String(result.attemptMessage || "Starting a new payment attempt."),
      transactionType: String(result.transactionType || "MA") as "MA" | "OTC",
      actionRequired: result.actionRequired ? String(result.actionRequired) : null,
      hostedFallbackAvailable: Boolean(result.hostedFallbackAvailable),
      paymentToken: result.paymentToken ? String(result.paymentToken) : null,
      paymentTokenExpiryDateTime: result.paymentTokenExpiryDateTime ? String(result.paymentTokenExpiryDateTime) : null,
    };
  } catch (error: any) {
    return { ok: false, message: error?.message || "Failed to start Easypaisa top-up." };
  }
}

export async function syncEasypaisaStatus(orderRefNum: string) {
  return await convex.action((api as any).easypaisa.syncTransactionStatus, {
    orderRefNum,
  });
}
