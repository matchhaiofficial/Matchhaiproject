import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { action, httpAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { EasypaisaTransactionType } from "./easypaisaRest";
import { EASYPAY_CHECKOUT_TTL_MS } from "./timing";

const EASYPAISA_ENV = String(process.env.EASYPAISA_ENV || "staging").trim().toLowerCase();
const EASYPAISA_DEFAULT_FLOW = String(process.env.EASYPAISA_DEFAULT_FLOW || "rest").trim().toLowerCase();
const EASYPAISA_HOSTED_FALLBACK_ENABLED = String(process.env.EASYPAISA_HOSTED_FALLBACK_ENABLED || "1").trim() !== "0";
const EASYPAISA_INDEX_URL =
  process.env.EASYPAISA_INDEX_URL
  || (EASYPAISA_ENV === "production"
    ? "https://easypay.easypaisa.com.pk/easypay/Index.jsf"
    : "https://easypaystg.easypaisa.com.pk/easypay/Index.jsf");
const EASYPAISA_CONFIRM_URL =
  process.env.EASYPAISA_CONFIRM_URL
  || (EASYPAISA_ENV === "production"
    ? "https://easypay.easypaisa.com.pk/easypay/Confirm.jsf"
    : "https://easypaystg.easypaisa.com.pk/easypay/Confirm.jsf");
const CONVEX_SITE_URL =
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL
  || process.env.CONVEX_SITE_URL
  || "";
const EASYPAISA_STORE_ID = String(process.env.EASYPAISA_STORE_ID || "").trim();
const EASYPAISA_HASH_KEY = String(process.env.EASYPAISA_HASH_KEY || "").trim();
const EASYPAISA_PAYMENT_METHOD = String(process.env.EASYPAISA_PAYMENT_METHOD || "").trim();
const EASYPAISA_IPN_ALLOWED_HOSTS = String(process.env.EASYPAISA_IPN_ALLOWED_HOSTS || "").trim();
const APP_SCHEME = String(process.env.EXPO_PUBLIC_APP_SCHEME || "matchhai").trim().replace(/:\/?\/?$/, "");
const CHECKOUT_TTL_MS = EASYPAY_CHECKOUT_TTL_MS;
const PROVIDER_FETCH_TIMEOUT_MS = 10_000;
const BOOKING_CHECKOUT_RETRY_WINDOW_MS = CHECKOUT_TTL_MS;
const MAX_BOOKING_CHECKOUT_ATTEMPTS_PER_WINDOW = 5;

const CHECKOUT_PATH = "/payments/easypaisa/checkout";
const TOKEN_PATH = "/payments/easypaisa/token";
const FINALIZE_PATH = "/payments/easypaisa/finalize";
const IPN_PATH = "/payments/easypaisa/ipn";

type PaymentKind = "booking_intent" | "wallet_topup";
type ProviderSource = "initiate" | "ipn" | "inquiry" | "hosted_finalize";
type PaymentStatus =
  | "created"
  | "redirected"
  | "token_received"
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled";

type FinalizeResult = {
  appReturnUrl: string;
  orderRefNum: string;
  ok: boolean;
  shouldRetry: boolean;
  status: PaymentStatus;
  message?: string;
};

type ProviderSnapshot = {
  responseCode?: string | null;
  responseDesc?: string | null;
  transactionStatus?: string | null;
  transactionId?: string | null;
  paymentToken?: string | null;
  paymentTokenExpiryDateTime?: string | null;
  transactionDateTime?: string | null;
  paymentMode?: string | null;
  paymentMethod?: string | null;
  providerReference?: string | null;
  authToken?: string | null;
  rawPayload?: any;
};

function maskStoreId(value?: string | null) {
  const text = String(value || "");
  if (!text) return null;
  if (text.length <= 2) return "*".repeat(text.length);
  return `${"*".repeat(Math.max(0, text.length - 2))}${text.slice(-2)}`;
}

function maskPhone(value?: string | null) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 4) return "*".repeat(digits.length);
  return `${digits.slice(0, 2)}${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-2)}`;
}

function logGatewayDebug(event: string, payload: Record<string, unknown>) {
  console.log(`[easypaisa] ${event}`, JSON.stringify(payload));
}

function getEmailDomain(email?: string | null) {
  const domain = String(email || "").split("@")[1] || "";
  return domain || null;
}

function ensurePaymentConfig() {
  if (!CONVEX_SITE_URL) {
    throw new Error("Payment callbacks are not configured. Set EXPO_PUBLIC_CONVEX_SITE_URL first.");
  }
  if (!EASYPAISA_STORE_ID) {
    throw new Error("Easypaisa store ID is not configured.");
  }
}

function normalizePhoneForGateway(raw?: string | null) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.startsWith("92")) return `0${digits.slice(2)}`;
  if (digits.startsWith("0")) return digits;
  return digits;
}

function buildAppReturnUrl(kind: PaymentKind, targetId?: string) {
  if (kind === "booking_intent" && targetId) {
    return `${APP_SCHEME}://matchrooms/book/status/${targetId}`;
  }
  return `${APP_SCHEME}://wallet`;
}

function buildAbsoluteUrl(path: string, token: string) {
  const base = CONVEX_SITE_URL.replace(/\/$/, "");
  return `${base}${path}?token=${encodeURIComponent(token)}`;
}

function generateCheckoutToken() {
  return [
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 10),
    Math.random().toString(36).slice(2, 10),
  ].join("");
}

function generateOrderRefNum(kind: PaymentKind) {
  const prefix = kind === "booking_intent" ? "MHB" : "MHW";
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;
}

function formatExpiryDate(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day} ${hours}${minutes}${seconds}`;
}

function formatTokenExpiry(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day} ${hours}${minutes}${seconds}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function autoSubmitHtml(args: {
  title: string;
  action: string;
  fields: Record<string, string>;
  message: string;
}) {
  const inputs = Object.entries(args.fields)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`)
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(args.title)}</title>
  </head>
  <body style="font-family: Arial, sans-serif; background:#0b1220; color:#fff; display:flex; min-height:100vh; align-items:center; justify-content:center; margin:0;">
    <div style="max-width:420px; width:100%; background:#131c31; border:1px solid #22304f; border-radius:18px; padding:24px; box-sizing:border-box;">
      <h1 style="margin:0 0 12px; font-size:20px;">${escapeHtml(args.title)}</h1>
      <p style="margin:0 0 20px; color:#c8d3ea;">${escapeHtml(args.message)}</p>
      <form id="gateway-form" method="POST" action="${escapeHtml(args.action)}">
        ${inputs}
        <button type="submit" style="background:#2d7ff9; color:#fff; border:none; border-radius:12px; padding:12px 16px; width:100%; font-size:16px;">Continue</button>
      </form>
    </div>
    <script>document.getElementById("gateway-form").submit();</script>
  </body>
</html>`;
}

function redirectHtml(title: string, message: string, returnUrl: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="font-family: Arial, sans-serif; background:#0b1220; color:#fff; display:flex; min-height:100vh; align-items:center; justify-content:center; margin:0;">
    <div style="max-width:420px; width:100%; background:#131c31; border:1px solid #22304f; border-radius:18px; padding:24px; box-sizing:border-box;">
      <h1 style="margin:0 0 12px; font-size:20px;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 20px; color:#c8d3ea;">${escapeHtml(message)}</p>
      <a href="${escapeHtml(returnUrl)}" style="display:inline-block; background:#2d7ff9; color:#fff; text-decoration:none; border-radius:12px; padding:12px 16px;">Return to MatchHai</a>
    </div>
    <script>setTimeout(function(){ window.location.href = ${JSON.stringify(returnUrl)}; }, 1200);</script>
  </body>
</html>`;
}

async function getAuthenticatedPaymentUser(ctx: any) {
  const authUser = await authComponent.getAuthUser(ctx);
  if (authUser?.userId) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q: any) => q.eq("authId", authUser.userId))
      .unique();

    if (user) {
      return user;
    }
  }

  throw new Error("Please sign in to continue.");
}

async function getPaymentUserWithFallback(ctx: any, fallbackUserId?: Id<"users">) {
  try {
    return await getAuthenticatedPaymentUser(ctx);
  } catch {
    if (fallbackUserId) {
      const fallbackUser = await ctx.db.get(fallbackUserId);
      if (fallbackUser) {
        return fallbackUser;
      }
    }
  }

  throw new Error("Please sign in to continue.");
}

function isTerminalStatus(status: PaymentStatus) {
  return status === "paid" || status === "expired" || status === "cancelled" || status === "failed";
}

function isRecoverableCheckoutStartError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const lower = message.toLowerCase();
  return (
    lower.includes("taking too long")
    || lower.includes("timeout")
    || lower.includes("timed out")
    || lower.includes("signal timed out")
    || lower.includes("aborted due to timeout")
  );
}

function buildPaymentStatusForReturn(status: PaymentStatus) {
  if (status === "paid") return "success";
  if (status === "pending" || status === "created") return "pending";
  if (status === "expired") return "expired";
  return "failed";
}

function getDefaultIpnAllowedHosts() {
  return [
    "easypay.easypaisa.com.pk",
    "easypaystg.easypaisa.com.pk",
    new URL(EASYPAISA_INDEX_URL).hostname,
    new URL(EASYPAISA_CONFIRM_URL).hostname,
  ];
}

function getAllowedIpnHosts() {
  const configuredHosts = EASYPAISA_IPN_ALLOWED_HOSTS
    ? EASYPAISA_IPN_ALLOWED_HOSTS.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean)
    : [];

  return Array.from(new Set([...getDefaultIpnAllowedHosts(), ...configuredHosts]));
}

function assertAllowedIpnUrl(ipnUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(ipnUrl);
  } catch {
    throw new Error("Invalid Easypaisa IPN URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Easypaisa IPN URL must use HTTPS.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!getAllowedIpnHosts().includes(hostname)) {
    throw new Error(`Blocked Easypaisa IPN host: ${hostname}`);
  }

  return parsed;
}

function toGatewayFieldEntries(fields: Record<string, string>) {
  return Object.entries(fields)
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .map(([key, value]) => ({ key, value }));
}

function sanitizeForDebug(input: Record<string, unknown>) {
  const next = { ...input };
  if ("mobileAccountNo" in next) next.mobileAccountNo = maskPhone(String(next.mobileAccountNo || ""));
  if ("msisdn" in next) next.msisdn = maskPhone(String(next.msisdn || ""));
  if ("accountNum" in next) next.accountNum = maskPhone(String(next.accountNum || ""));
  return next;
}

function normalizeProviderUpdate(source: ProviderSource, snapshot: ProviderSnapshot) {
  const paymentMode = String(
    snapshot.paymentMode
    || snapshot.paymentMethod
    || snapshot.rawPayload?.paymentMode
    || snapshot.rawPayload?.paymentMethod
    || "",
  ).trim().toUpperCase();
  const transactionStatus = String(
    snapshot.transactionStatus
    || snapshot.rawPayload?.transactionStatus
    || snapshot.rawPayload?.status
    || "",
  ).trim().toUpperCase();
  const responseCode = String(snapshot.responseCode || snapshot.rawPayload?.responseCode || "").trim();
  const responseDesc = String(
    snapshot.responseDesc
    || snapshot.rawPayload?.responseDesc
    || snapshot.rawPayload?.errorReason
    || snapshot.rawPayload?.responseMessage
    || snapshot.rawPayload?.description
    || snapshot.rawPayload?.errorMessage
    || "",
  ).trim();
  const combined = `${transactionStatus} ${responseCode} ${responseDesc}`.toUpperCase();

  // IMPORTANT: For OTC flows Easypaisa can return responseCode=0000 and "SUCCESS"
  // when only a token was created. MA success is the completed mobile-account charge.
  // Never infer paid for OTC from response text alone.
  const FAILED_STATUSES = new Set([
    "FAILED",
    "REVERSED",
    "CANCELLED",
    "CANCELED",
    "REJECTED",
    "DECLINED",
    "DENIED",
    "VOID",
  ]);
  const EXPIRED_STATUSES = new Set(["EXPIRED", "TIMEOUT", "TIMED_OUT"]);
  const PAID_STATUSES = new Set(["PAID", "SUCCESS", "COMPLETED", "COMPLETE"]);
  const PENDING_STATUSES = new Set([
    "PENDING",
    "BLOCKED",
    "INITIATED",
    "CREATED",
    "REQUESTED",
    "PROCESSING",
  ]);

  let resolvedStatus: PaymentStatus = "failed";

  if (FAILED_STATUSES.has(transactionStatus)) {
    resolvedStatus = "failed";
  } else if (EXPIRED_STATUSES.has(transactionStatus)) {
    resolvedStatus = "expired";
  } else if (PAID_STATUSES.has(transactionStatus)) {
    resolvedStatus = "paid";
  } else if (PENDING_STATUSES.has(transactionStatus)) {
    resolvedStatus = "pending";
  } else if (source === "initiate" && paymentMode === "MA" && responseCode === "0000") {
    resolvedStatus = "paid";
  } else if (
    source === "inquiry" &&
    paymentMode === "MA" &&
    responseCode === "0000" &&
    (combined.includes("SUCCESS") || combined.includes("PAID") || combined.includes("COMPLETE"))
  ) {
    resolvedStatus = "paid";
  } else if (!transactionStatus && (source === "ipn" || source === "hosted_finalize")) {
    // Provider webhooks/finalize responses sometimes omit a normalized transactionStatus.
    if (combined.includes("CANCEL") || combined.includes("REJECT") || combined.includes("DECLIN") || combined.includes("REVERSE")) {
      resolvedStatus = "failed";
    } else if (combined.includes("EXPIRE")) {
      resolvedStatus = "expired";
    } else if (paymentMode === "MA" && combined.includes("SUCCESS")) {
      resolvedStatus = "paid";
    } else if (combined.includes("PAID") || combined.includes("COMPLETE")) {
      resolvedStatus = "paid";
    } else if (responseCode === "0000") {
      resolvedStatus = "pending";
    }
  } else if (combined.includes("CANCEL") || combined.includes("REJECT") || combined.includes("DECLIN") || combined.includes("REVERSE") || combined.includes("FAILED")) {
    resolvedStatus = "failed";
  } else if (combined.includes("EXPIRE")) {
    resolvedStatus = "expired";
  } else if (responseCode === "0000") {
    // Success code means the request was accepted by gateway, not that it was paid.
    resolvedStatus = "pending";
  } else if (responseDesc.toLowerCase().includes("expire")) {
    resolvedStatus = "expired";
  }

  return {
    transactionStatus: transactionStatus || null,
    responseCode: responseCode || null,
    responseDesc: responseDesc || null,
    resolvedStatus,
  };
}

function getProviderReference(snapshot: ProviderSnapshot, orderRefNum: string) {
  return String(
    snapshot.providerReference
    || snapshot.transactionId
    || snapshot.paymentToken
    || snapshot.rawPayload?.transactionId
    || snapshot.rawPayload?.txnId
    || snapshot.rawPayload?.paymentToken
    || orderRefNum,
  );
}

function getRestInquiryResponse(snapshot: ProviderSnapshot) {
  return snapshot.rawPayload?.rest?.inquiry?.response || {};
}

function isMaNoResponseFailure(source: ProviderSource, snapshot: ProviderSnapshot, normalized: ReturnType<typeof normalizeProviderUpdate>) {
  if (source !== "inquiry" || normalized.resolvedStatus !== "failed") {
    return false;
  }

  const inquiryResponse = getRestInquiryResponse(snapshot);
  const paymentMode = String(
    snapshot.paymentMode
    || snapshot.paymentMethod
    || inquiryResponse.paymentMode
    || inquiryResponse.paymentMethod
    || "",
  ).toUpperCase();
  const errorCode = String(inquiryResponse.errorCode || snapshot.rawPayload?.errorCode || "").toUpperCase();
  const errorText = String(
    inquiryResponse.errorReason
    || inquiryResponse.responseDesc
    || normalized.responseDesc
    || "",
  ).toLowerCase();

  return (
    paymentMode === "MA"
    && (
      errorCode === "NO_RESPONSE_FROM_EWP"
      || errorText.includes("approve this transaction")
      || errorText.includes("mobile account pin")
      || errorText.includes("no response")
    )
  );
}

function parseDirectIpnPayload(url: URL, formEntries: Record<string, string>) {
  const params = Object.fromEntries(url.searchParams.entries());
  const merged = { ...params, ...formEntries };
  return {
    responseCode: merged.responseCode || merged.code || merged.statusCode || null,
    responseDesc: merged.responseDesc || merged.responseMessage || merged.description || merged.desc || null,
    transactionStatus: merged.transactionStatus || merged.status || null,
    transactionId: merged.transactionId || merged.txnId || null,
    paymentToken: merged.paymentToken || null,
    paymentMode: merged.paymentMode || merged.paymentMethod || null,
    paymentMethod: merged.paymentMethod || merged.paymentMode || null,
    authToken: merged.auth_token || merged.authToken || null,
    orderRefNumber:
      merged.orderRefNum
      || merged.orderRefNumber
      || merged.orderId
      || merged.orderID
      || merged.order_id
      || null,
    rawPayload: merged,
  };
}

export const getStartCheckoutContext = internalQuery({
  args: {
    kind: v.union(v.literal("booking_intent"), v.literal("wallet_topup")),
    bookingIntentId: v.optional(v.id("bookingIntents")),
    amount: v.optional(v.number()),
    userId: v.optional(v.id("users")),
    phone: v.optional(v.string()),
    forceNew: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getPaymentUserWithFallback(ctx, args.userId);
    const now = Date.now();
    const activeStatuses: PaymentStatus[] = ["created", "redirected", "token_received", "pending"];

    let bookingIntentId: Id<"bookingIntents"> | undefined;
    let amount = 0;
    let currency = "PKR";

    if (args.kind === "booking_intent") {
      if (!args.bookingIntentId) {
        throw new Error("Booking intent is required.");
      }
      const intent = await ctx.db.get(args.bookingIntentId);
      if (!intent) {
        throw new Error("Booking intent not found.");
      }
      if (String(intent.createdByUid) !== String(user._id)) {
        throw new Error("You can only pay for your own booking.");
      }
      if (intent.paymentStatus === "paid" || intent.status === "confirmed") {
        throw new Error("This booking is already paid.");
      }
      if (intent.status !== "approved_pending_payment" && intent.status !== "approved") {
        throw new Error("This booking is not ready for payment yet.");
      }

      bookingIntentId = args.bookingIntentId;
      amount = Number(intent.pricing?.totalCost || 0);
      currency = String(intent.pricing?.currency || "PKR");

      const existing = await ctx.db
        .query("paymentTransactions")
        .withIndex("by_bookingIntentId", (q) => q.eq("bookingIntentId", bookingIntentId!))
        .collect();

      if (args.forceNew) {
        const retryWindowStart = now - BOOKING_CHECKOUT_RETRY_WINDOW_MS;
        const recentAttempts = existing.filter((transaction: any) =>
          transaction.kind === "booking_intent" &&
          Number(transaction.createdAt || 0) >= retryWindowStart,
        );
        if (recentAttempts.length >= MAX_BOOKING_CHECKOUT_ATTEMPTS_PER_WINDOW) {
          throw new Error(
            `You have reached the Easypaisa retry limit for this booking. Please wait a few minutes and try again.`,
          );
        }
      }

      const activeTransaction = args.forceNew
        ? null
        : existing.find((transaction: any) =>
            activeStatuses.includes(transaction.status) && Number(transaction.expiresAt || 0) > now,
          );

      return {
        userId: user._id,
        userPhone: args.phone || user.phone || null,
        userEmail: user.email || null,
        bookingIntentId,
        amount,
        currency,
        activeTransaction: activeTransaction || null,
      };
    }

    amount = Number(args.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Enter a valid top-up amount.");
    }

    let activeTransaction: any = null;
    if (!args.forceNew) {
      for (const status of activeStatuses) {
        const rows = await ctx.db
          .query("paymentTransactions")
          .withIndex("by_userId_and_status", (q) => q.eq("userId", user._id).eq("status", status))
          .collect();
        activeTransaction = rows.find((transaction: any) =>
          transaction.kind === "wallet_topup" &&
          Number(transaction.amount || 0) === amount &&
          Number(transaction.expiresAt || 0) > now,
        );
        if (activeTransaction) {
          break;
        }
      }
    }

    // Avoid reusing old pending wallet top-ups; polling updates `updatedAt`, but does not resend
    // the Easypaisa mobile-account approval request.
    if (
      activeTransaction &&
      Number(activeTransaction.createdAt || 0) + 2 * 60 * 1000 < now
    ) {
      activeTransaction = null;
    }

    return {
      userId: user._id,
      userPhone: args.phone || user.phone || null,
      userEmail: user.email || null,
      bookingIntentId: undefined,
      amount,
      currency,
      activeTransaction,
    };
  },
});

export const insertCheckoutTransaction = internalMutation({
  args: {
    kind: v.union(v.literal("booking_intent"), v.literal("wallet_topup")),
    userId: v.id("users"),
    bookingIntentId: v.optional(v.id("bookingIntents")),
    amount: v.number(),
    currency: v.string(),
    orderRefNum: v.string(),
    checkoutToken: v.string(),
    checkoutUrl: v.string(),
    appReturnUrl: v.string(),
    expiresAt: v.number(),
    flow: v.string(),
    phoneSource: v.optional(v.string()),
    checkoutPhoneMasked: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("paymentTransactions", {
      provider: "easypaisa",
      kind: args.kind,
      status: "created",
      userId: args.userId,
      bookingIntentId: args.bookingIntentId,
      amount: args.amount,
      currency: args.currency,
      orderRefNum: args.orderRefNum,
      checkoutToken: args.checkoutToken,
      checkoutUrl: args.checkoutUrl,
      appReturnUrl: args.appReturnUrl,
      providerPayload: {
        flow: args.flow,
        checkoutContext: {
          phoneSource: args.phoneSource || "profile",
          checkoutPhoneMasked: args.checkoutPhoneMasked || null,
        },
        checkoutDebug: {
          env: EASYPAISA_ENV,
          storeIdMasked: maskStoreId(EASYPAISA_STORE_ID),
          indexHost: new URL(EASYPAISA_INDEX_URL).hostname,
          confirmHost: new URL(EASYPAISA_CONFIRM_URL).hostname,
          callbackBaseUrl: CONVEX_SITE_URL,
          paymentMethod: EASYPAISA_PAYMENT_METHOD || null,
        },
      },
      expiresAt: args.expiresAt,
      callbackCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const markCheckoutFailed = internalMutation({
  args: {
    transactionId: v.id("paymentTransactions"),
    flow: v.string(),
    endpointPath: v.string(),
    requestPayload: v.any(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.transactionId);
    if (!existing) return;
    await ctx.db.patch(args.transactionId, {
      status: "failed",
      lastError: args.message,
      providerPayload: {
        ...(existing.providerPayload || {}),
        flow: args.flow,
        rest: {
          ...((existing.providerPayload || {}).rest || {}),
          initiate: {
            endpointPath: args.endpointPath,
            request: sanitizeForDebug(args.requestPayload || {}),
            error: args.message,
          },
        },
      },
      updatedAt: Date.now(),
    });
  },
});

export const markCheckoutPendingAfterInitiateTimeout = internalMutation({
  args: {
    transactionId: v.id("paymentTransactions"),
    flow: v.string(),
    endpointPath: v.string(),
    requestPayload: v.any(),
    message: v.string(),
    actionRequired: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.transactionId);
    if (!existing) return;
    if (existing.processedAt || isTerminalStatus(existing.status as PaymentStatus)) return;

    await ctx.db.patch(args.transactionId, {
      status: "pending",
      providerDescription: "Waiting for Easypaisa confirmation.",
      lastError: args.message,
      providerPayload: {
        ...(existing.providerPayload || {}),
        flow: args.flow,
        rest: {
          ...((existing.providerPayload || {}).rest || {}),
          initiate: {
            endpointPath: args.endpointPath,
            request: sanitizeForDebug(args.requestPayload || {}),
            error: args.message,
            actionRequired: args.actionRequired,
            timedOutAfterRequest: true,
          },
        },
      },
      updatedAt: Date.now(),
    });
  },
});

export const getTransactionByOrderRef = internalQuery({
  args: {
    orderRefNum: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_orderRefNum", (q) => q.eq("orderRefNum", args.orderRefNum))
      .unique();
    if (!row) return null;
    if (args.userId && String(row.userId) !== String(args.userId)) {
      throw new Error("Transaction not found.");
    }
    return row;
  },
});

export const startCheckout = action({
  args: {
    kind: v.union(v.literal("booking_intent"), v.literal("wallet_topup")),
    bookingIntentId: v.optional(v.id("bookingIntents")),
    amount: v.optional(v.number()),
    userId: v.optional(v.id("users")),
    flow: v.optional(v.union(v.literal("rest"), v.literal("hosted"))),
    transactionType: v.optional(v.union(v.literal("MA"), v.literal("OTC"))),
    phone: v.optional(v.string()),
    forceNew: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<any> => {
    ensurePaymentConfig();
    const now = Date.now();
    const expiresAt = now + CHECKOUT_TTL_MS;
    const context: any = await ctx.runQuery((internal as any).easypaisa.getStartCheckoutContext, {
      kind: args.kind,
      bookingIntentId: args.bookingIntentId,
      amount: args.amount,
      userId: args.userId,
      phone: args.phone,
      forceNew: args.forceNew,
    });
    const userId = context.userId as Id<"users">;
    const userPhone = String(context.userPhone || "");
    const userEmail = String(context.userEmail || "");
    const bookingIntentId = context.bookingIntentId as Id<"bookingIntents"> | undefined;
    const amount = Number(context.amount || 0);
    const currency = String(context.currency || "PKR");
    const active = context.activeTransaction;

    logGatewayDebug("start.context", {
      kind: args.kind,
      userId: String(userId),
      bookingIntentId: bookingIntentId ? String(bookingIntentId) : null,
      amount,
      currency,
      flow: args.flow || EASYPAISA_DEFAULT_FLOW,
      transactionType: args.transactionType || "MA",
      phoneMasked: maskPhone(userPhone),
      emailDomain: getEmailDomain(userEmail),
      activeTransactionId: active?._id ? String(active._id) : null,
      activeStatus: active?.status || null,
    });

    if (active) {
      logGatewayDebug("start.reuse_active", {
        transactionId: String(active._id),
        orderRefNum: active.orderRefNum,
        status: active.status,
        amount: active.amount,
        kind: active.kind,
      });
      return {
        transactionId: active._id,
        orderRefNum: active.orderRefNum,
        checkoutUrl: active.checkoutUrl || null,
        expiresAt: active.expiresAt,
        status: active.status,
        transactionType: active.providerPayload?.rest?.initiate?.request?.transactionType || "MA",
        hostedFallbackAvailable: EASYPAISA_HOSTED_FALLBACK_ENABLED,
        actionRequired: active.providerPayload?.rest?.initiate?.actionRequired || "approve_in_easypaisa",
        paymentToken: active.providerPayload?.rest?.initiate?.response?.paymentToken || null,
        paymentTokenExpiryDateTime: active.providerPayload?.rest?.initiate?.response?.paymentTokenExpiryDateTime || null,
      };
    }

    const checkoutToken = generateCheckoutToken();
    const orderRefNum = generateOrderRefNum(args.kind);
    const checkoutUrl = buildAbsoluteUrl(CHECKOUT_PATH, checkoutToken);
    const appReturnUrl = buildAppReturnUrl(
      args.kind,
      args.kind === "booking_intent" ? String(bookingIntentId || "") : undefined,
    );
    const flow = (args.flow || EASYPAISA_DEFAULT_FLOW) === "hosted" ? "hosted" : "rest";
    const transactionType = (args.transactionType || "MA") as EasypaisaTransactionType;

    if (flow === "hosted" && !EASYPAISA_HOSTED_FALLBACK_ENABLED) {
      throw new Error("Hosted Easypaisa fallback is disabled.");
    }

    const transactionId: Id<"paymentTransactions"> = await ctx.runMutation((internal as any).easypaisa.insertCheckoutTransaction, {
      kind: args.kind,
      userId,
      bookingIntentId,
      amount,
      currency,
      orderRefNum,
      checkoutToken,
      checkoutUrl,
      appReturnUrl,
      expiresAt,
      flow,
      phoneSource: args.phone ? "checkout_override" : "profile",
      checkoutPhoneMasked: maskPhone(userPhone),
    });

    logGatewayDebug("start.transaction_created", {
      transactionId: String(transactionId),
      orderRefNum,
      kind: args.kind,
      amount,
      currency,
      flow,
      transactionType,
      hostedFallbackAvailable: EASYPAISA_HOSTED_FALLBACK_ENABLED,
    });

    if (flow === "hosted") {
      return {
        transactionId,
        orderRefNum,
        checkoutUrl,
        expiresAt,
        status: "created",
        transactionType,
        hostedFallbackAvailable: EASYPAISA_HOSTED_FALLBACK_ENABLED,
        actionRequired: "complete_hosted_checkout",
        paymentToken: null,
        paymentTokenExpiryDateTime: null,
      };
    }

    const normalizedPhone = normalizePhoneForGateway(userPhone);
    const emailAddress = userEmail.trim();
    if (!normalizedPhone) {
      throw new Error("Your phone number is missing or invalid for Easypaisa.");
    }
    if (!emailAddress) {
      throw new Error("Your account email is required for Easypaisa.");
    }

    const requestPayload = transactionType === "OTC"
      ? {
          orderId: orderRefNum,
          storeId: EASYPAISA_STORE_ID,
          transactionAmount: Number(amount).toFixed(2),
          transactionType: "OTC",
          msisdn: normalizedPhone,
          emailAddress,
          tokenExpiry: formatTokenExpiry(expiresAt),
          optional1: args.kind,
          optional2: bookingIntentId ? String(bookingIntentId) : String(userId),
        }
      : {
          orderId: orderRefNum,
          storeId: EASYPAISA_STORE_ID,
          transactionAmount: Number(amount).toFixed(2),
          transactionType: "MA",
          mobileAccountNo: normalizedPhone,
          emailAddress,
          optional1: args.kind,
          optional2: bookingIntentId ? String(bookingIntentId) : String(userId),
        };
    const endpointPath = transactionType === "OTC"
      ? "/initiate-otc-transaction"
      : "/initiate-ma-transaction";
    logGatewayDebug("rest.initiate.request", {
      transactionId: String(transactionId),
      orderRefNum,
      endpointPath,
      kind: args.kind,
      amount,
      transactionType,
      phoneMasked: maskPhone(normalizedPhone),
      emailDomain: getEmailDomain(emailAddress),
    });
    let responseBody: any = {};
    let initiateStatus: PaymentStatus = "pending";
    try {
      const initiateResult: any = await ctx.runAction((internal as any).easypaisaNode.initiateRestTransaction, {
        endpointPath,
        payload: requestPayload,
      });
      responseBody = initiateResult?.body || {};

      logGatewayDebug("rest.initiate.response", {
        transactionId: String(transactionId),
        orderRefNum,
        endpointPath,
        httpStatus: initiateResult?.status || null,
        ok: Boolean(initiateResult?.ok),
        responseCode: responseBody?.responseCode || null,
        responseDesc: responseBody?.responseDesc || null,
        providerTransactionId: responseBody?.transactionId || null,
        paymentTokenPresent: Boolean(responseBody?.paymentToken),
      });

      const providerUpdate: FinalizeResult = await ctx.runMutation((internal as any).easypaisa.applyProviderUpdate, {
        orderRefNum,
        source: "initiate",
        snapshot: {
          responseCode: responseBody?.responseCode || null,
          responseDesc: responseBody?.responseDesc || null,
          transactionStatus: responseBody?.transactionStatus || responseBody?.status || null,
          transactionId: responseBody?.transactionId || null,
          paymentToken: responseBody?.paymentToken || null,
          paymentTokenExpiryDateTime: responseBody?.paymentTokenExpiryDateTime || null,
          transactionDateTime: responseBody?.transactionDateTime || null,
          paymentMode: transactionType,
          paymentMethod: transactionType,
          providerReference: responseBody?.transactionId || responseBody?.paymentToken || orderRefNum,
          rawPayload: {
            rest: {
              initiate: {
                endpointPath,
                request: initiateResult?.requestPayload || sanitizeForDebug(requestPayload),
                response: responseBody,
                httpStatus: initiateResult?.status,
                ok: initiateResult?.ok,
                actionRequired: transactionType === "OTC" ? "pay_with_token" : "approve_in_easypaisa",
              },
            },
          },
        },
      });
      initiateStatus = providerUpdate.status;

      if (String(responseBody?.responseCode || "") !== "0000") {
        throw new Error(String(responseBody?.responseDesc || "Failed to initiate Easypaisa payment."));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to initiate Easypaisa payment.";
      logGatewayDebug("rest.initiate.error", {
        transactionId: String(transactionId),
        orderRefNum,
        endpointPath,
        recoverable: isRecoverableCheckoutStartError(error),
        message,
      });
      if (isRecoverableCheckoutStartError(error)) {
        await ctx.runMutation((internal as any).easypaisa.markCheckoutPendingAfterInitiateTimeout, {
          transactionId,
          flow,
          endpointPath,
          requestPayload,
          message,
          actionRequired: transactionType === "OTC" ? "pay_with_token" : "approve_in_easypaisa",
        });

        return {
          transactionId,
          orderRefNum,
          checkoutUrl: EASYPAISA_HOSTED_FALLBACK_ENABLED ? checkoutUrl : null,
          expiresAt,
          status: "pending",
          transactionType,
          hostedFallbackAvailable: EASYPAISA_HOSTED_FALLBACK_ENABLED,
          actionRequired: transactionType === "OTC" ? "pay_with_token" : "approve_in_easypaisa",
          paymentToken: responseBody?.paymentToken || null,
          paymentTokenExpiryDateTime: responseBody?.paymentTokenExpiryDateTime || null,
          startTimedOut: true,
        };
      }

      await ctx.runMutation((internal as any).easypaisa.markCheckoutFailed, {
        transactionId,
        flow,
        endpointPath,
        requestPayload,
        message,
      });
      throw error;
    }

    return {
      transactionId,
      orderRefNum,
      checkoutUrl: EASYPAISA_HOSTED_FALLBACK_ENABLED ? checkoutUrl : null,
      expiresAt,
      status: initiateStatus,
      transactionType,
      hostedFallbackAvailable: EASYPAISA_HOSTED_FALLBACK_ENABLED,
      actionRequired: transactionType === "OTC" ? "pay_with_token" : "approve_in_easypaisa",
      paymentToken: responseBody?.paymentToken || null,
      paymentTokenExpiryDateTime: responseBody?.paymentTokenExpiryDateTime || null,
    };
  },
});

export const syncTransactionStatus = action({
  args: {
    orderRefNum: v.string(),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    ensurePaymentConfig();
    const row: any = await ctx.runQuery((internal as any).easypaisa.getTransactionByOrderRef, {
      orderRefNum: args.orderRefNum,
      userId: args.userId,
    });
    if (!row) {
      throw new Error("Transaction not found.");
    }

    const inquiryResult: any = await ctx.runAction((internal as any).easypaisaNode.inquireRestTransaction, {
      orderId: row.orderRefNum,
      storeId: EASYPAISA_STORE_ID,
    });
    const inquiryBody = inquiryResult?.body || {};
    const inquiryDescription =
      String(inquiryBody?.transactionStatus || "").toUpperCase() === "FAILED"
        ? inquiryBody?.errorReason || inquiryBody?.responseDesc
        : inquiryBody?.responseDesc || inquiryBody?.errorReason;
    const storedTransactionType =
      row.providerPayload?.rest?.initiate?.request?.transactionType ||
      row.providerPayload?.rest?.initiate?.response?.paymentMode ||
      row.paymentMethod ||
      null;
    const applyResult: any = await ctx.runMutation((internal as any).easypaisa.applyProviderUpdate, {
      orderRefNum: row.orderRefNum,
      source: "inquiry",
      snapshot: {
        responseCode: inquiryBody?.responseCode || inquiryBody?.errorCode || null,
        responseDesc: inquiryDescription || null,
        transactionStatus: inquiryBody?.transactionStatus || null,
        transactionId: inquiryBody?.transactionId || null,
        paymentToken: inquiryBody?.paymentToken || null,
        paymentTokenExpiryDateTime: inquiryBody?.paymentTokenExpiryDateTime || null,
        transactionDateTime: inquiryBody?.transactionDateTime || null,
        paymentMode: inquiryBody?.paymentMode || storedTransactionType || null,
        paymentMethod: inquiryBody?.paymentMethod || inquiryBody?.paymentMode || storedTransactionType || null,
        providerReference: inquiryBody?.transactionId || inquiryBody?.paymentToken || row.orderRefNum,
        rawPayload: {
          rest: {
            inquiry: {
              request: inquiryResult?.requestPayload || {
                orderId: row.orderRefNum,
                storeId: EASYPAISA_STORE_ID,
              },
              response: inquiryBody,
              httpStatus: inquiryResult?.status,
              ok: inquiryResult?.ok,
              lastSyncAt: Date.now(),
            },
          },
        },
      },
    });

    return {
      ok: true,
      status: applyResult.status,
      shouldRetry: applyResult.shouldRetry,
      message: applyResult.message || null,
    };
  },
});

export const listMyTransactions = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedPaymentUser(ctx);
    const rows = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    return rows.sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  },
});

export const getCheckoutStatus = query({
  args: {
    userId: v.optional(v.id("users")),
    orderRefNum: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getPaymentUserWithFallback(ctx, args.userId);
    const rows = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const filtered = args.orderRefNum
      ? rows.filter((row: any) => String(row.orderRefNum) === String(args.orderRefNum))
      : rows;

    const latest = [...filtered].sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
    if (!latest) {
      return null;
    }

    return {
      transactionId: latest._id,
      orderRefNum: latest.orderRefNum,
      kind: latest.kind,
      status: latest.status,
      amount: latest.amount,
      currency: latest.currency,
      checkoutUrl: latest.checkoutUrl || null,
      providerStatus: latest.providerStatus || null,
      providerDescription: latest.providerDescription || null,
      paymentMethod: latest.paymentMethod || null,
      providerReference: latest.providerReference || null,
      transactionType: latest.providerPayload?.rest?.initiate?.request?.transactionType || null,
      actionRequired: latest.providerPayload?.rest?.initiate?.actionRequired || null,
      paymentToken: latest.providerPayload?.rest?.initiate?.response?.paymentToken || null,
      paymentTokenExpiryDateTime: latest.providerPayload?.rest?.initiate?.response?.paymentTokenExpiryDateTime || null,
      hostedFallbackAvailable: EASYPAISA_HOSTED_FALLBACK_ENABLED,
      callbackCount: latest.callbackCount || 0,
      lastError: latest.lastError || null,
      providerPayload: latest.providerPayload || null,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
    };
  },
});

export const getCheckoutSessionByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const transaction = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_checkoutToken", (q) => q.eq("checkoutToken", args.token))
      .unique();

    if (!transaction) {
      return null;
    }

    const user = await ctx.db.get(transaction.userId);
    return {
      transaction,
      user,
    };
  },
});

export const markRedirected = internalMutation({
  args: {
    token: v.string(),
    debug: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_checkoutToken", (q) => q.eq("checkoutToken", args.token))
      .unique();
    if (!row || row.processedAt || isTerminalStatus(row.status as PaymentStatus)) {
      return row;
    }
    await ctx.db.patch(row._id, {
      status: row.status === "created" ? "redirected" : row.status,
      providerPayload: {
        ...(row.providerPayload || {}),
        hosted: {
          ...((row.providerPayload || {}).hosted || {}),
          redirectDebug: args.debug,
          lastRedirectAt: Date.now(),
        },
      },
      updatedAt: Date.now(),
    });
    return row;
  },
});

export const registerProviderToken = internalMutation({
  args: {
    token: v.string(),
    authToken: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_checkoutToken", (q) => q.eq("checkoutToken", args.token))
      .unique();
    if (!row) {
      throw new Error("Transaction not found.");
    }
    if (row.processedAt || isTerminalStatus(row.status as PaymentStatus)) {
      return row;
    }

    await ctx.db.patch(row._id, {
      authToken: args.authToken,
      status: row.status === "created" ? "token_received" : row.status,
      providerPayload: {
        ...(row.providerPayload || {}),
        hosted: {
          ...((row.providerPayload || {}).hosted || {}),
          authTokenReceivedAt: Date.now(),
        },
      },
      updatedAt: Date.now(),
    });

    return row;
  },
});

export const applyProviderUpdate = internalMutation({
  args: {
    orderRefNum: v.string(),
    source: v.union(
      v.literal("initiate"),
      v.literal("ipn"),
      v.literal("inquiry"),
      v.literal("hosted_finalize"),
    ),
    snapshot: v.any(),
  },
  handler: async (ctx, args): Promise<FinalizeResult> => {
    const row = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_orderRefNum", (q) => q.eq("orderRefNum", args.orderRefNum))
      .unique();
    if (!row) {
      throw new Error("Transaction not found.");
    }

    const now = Date.now();
    const snapshot = args.snapshot as ProviderSnapshot;
    const normalized = normalizeProviderUpdate(args.source, snapshot);
    const keepMaNoResponsePending = isMaNoResponseFailure(args.source, snapshot, normalized);
    const providerReference = getProviderReference(snapshot, row.orderRefNum);
    logGatewayDebug("provider.update", {
      transactionId: String(row._id),
      orderRefNum: row.orderRefNum,
      source: args.source,
      kind: row.kind,
      amount: row.amount,
      previousStatus: row.status,
      resolvedStatus: normalized.resolvedStatus,
      keepPending: keepMaNoResponsePending,
      providerStatus: normalized.transactionStatus || normalized.responseCode || null,
      providerDescription: normalized.responseDesc || null,
      providerReference,
      processedAt: row.processedAt || null,
    });
    const currentPayload = row.providerPayload || {};
    const sourcePayload = args.source === "ipn"
      ? {
          ...currentPayload,
          ipn: {
            ...(currentPayload.ipn || {}),
            lastIpnAt: now,
            lastPayload: snapshot.rawPayload || null,
          },
          lastProviderStatus: normalized.transactionStatus || normalized.responseCode,
          lastSyncAt: now,
        }
      : args.source === "hosted_finalize"
        ? {
            ...currentPayload,
            hosted: {
              ...(currentPayload.hosted || {}),
              finalize: snapshot.rawPayload || null,
              lastFinalizeAt: now,
            },
            lastProviderStatus: normalized.transactionStatus || normalized.responseCode,
            lastSyncAt: now,
          }
        : {
            ...currentPayload,
            rest: {
              ...(currentPayload.rest || {}),
              ...(snapshot.rawPayload?.rest || {}),
            },
            lastProviderStatus: normalized.transactionStatus || normalized.responseCode,
            lastSyncAt: now,
          };

    const callbackPatch: Record<string, unknown> = {
      providerStatus: normalized.transactionStatus || normalized.responseCode || undefined,
      providerDescription: normalized.responseDesc || undefined,
      providerPayload: sourcePayload,
      paymentMethod: snapshot.paymentMethod || snapshot.paymentMode || row.paymentMethod,
      providerReference,
      callbackCount: Number(row.callbackCount || 0) + (args.source === "initiate" ? 0 : 1),
      lastCallbackAt: args.source === "initiate" ? row.lastCallbackAt : now,
      updatedAt: now,
    };

    if (row.processedAt || row.status === "paid") {
      await ctx.db.patch(row._id, {
        ...callbackPatch,
        status: "paid",
      });
      return {
        appReturnUrl: row.appReturnUrl,
        orderRefNum: row.orderRefNum,
        ok: true,
        shouldRetry: false,
        status: "paid",
      };
    }

    if (
      Number(row.expiresAt || 0) > 0
      && now > Number(row.expiresAt || 0)
      && (normalized.resolvedStatus === "pending" || keepMaNoResponsePending)
    ) {
      if (row.bookingIntentId) {
        await ctx.db.patch(row.bookingIntentId, {
          status: "expired",
          updatedAt: now,
        });
      }

      await ctx.db.patch(row._id, {
        ...callbackPatch,
        status: "expired",
        lastError: undefined,
      });

      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: row.kind === "wallet_topup" ? "wallet.topup_result" : "match.payment_result",
        toUid: row.userId,
        status: "expired",
        dedupeKey: `${row.kind}:payment_result:${String(row._id)}:expired`,
        dedupePolicy: "replace_active",
        route: row.kind === "wallet_topup" ? "/(player)/wallet" : "/(player)/inbox",
        title: row.kind === "wallet_topup" ? "Top-up Expired" : "Payment Expired",
        body: row.kind === "wallet_topup"
          ? "Your wallet top-up session expired before payment completed."
          : "Your booking payment session expired before the slot was confirmed.",
        data: {
          paymentTransactionId: String(row._id),
          bookingIntentId: row.bookingIntentId ? String(row.bookingIntentId) : null,
          orderRefNum: row.orderRefNum,
          decision: "expired",
          href: row.kind === "wallet_topup" ? "/(player)/wallet" : "/(player)/inbox",
        },
      });

      return {
        appReturnUrl: row.appReturnUrl,
        orderRefNum: row.orderRefNum,
        ok: true,
        shouldRetry: false,
        status: "expired",
      };
    }

    if (normalized.resolvedStatus === "pending" || keepMaNoResponsePending) {
      await ctx.db.patch(row._id, {
        ...callbackPatch,
        status: row.status === "redirected" || row.status === "token_received" ? row.status : "pending",
        lastError: keepMaNoResponsePending ? normalized.responseDesc || undefined : undefined,
      });
      return {
        appReturnUrl: row.appReturnUrl,
        orderRefNum: row.orderRefNum,
        ok: true,
        shouldRetry: false,
        status: "pending",
      };
    }

    if (normalized.resolvedStatus === "expired") {
      if (row.bookingIntentId) {
        await ctx.db.patch(row.bookingIntentId, {
          status: "expired",
          updatedAt: now,
        });
      }

      await ctx.db.patch(row._id, {
        ...callbackPatch,
        status: "expired",
        lastError: undefined,
      });

      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: row.kind === "wallet_topup" ? "wallet.topup_result" : "match.payment_result",
        toUid: row.userId,
        status: "expired",
        dedupeKey: `${row.kind}:payment_result:${String(row._id)}:expired`,
        dedupePolicy: "replace_active",
        route: row.kind === "wallet_topup" ? "/(player)/wallet" : "/(player)/inbox",
        title: row.kind === "wallet_topup" ? "Top-up Expired" : "Payment Expired",
        body: row.kind === "wallet_topup"
          ? "Your wallet top-up session expired before payment completed."
          : "Your booking payment session expired before the slot was confirmed.",
        data: {
          paymentTransactionId: String(row._id),
          bookingIntentId: row.bookingIntentId ? String(row.bookingIntentId) : null,
          orderRefNum: row.orderRefNum,
          decision: "expired",
          href: row.kind === "wallet_topup" ? "/(player)/wallet" : "/(player)/inbox",
        },
      });

      return {
        appReturnUrl: row.appReturnUrl,
        orderRefNum: row.orderRefNum,
        ok: true,
        shouldRetry: false,
        status: "expired",
      };
    }

    if (normalized.resolvedStatus !== "paid") {
      await ctx.db.patch(row._id, {
        ...callbackPatch,
        status: "failed",
        lastError: undefined,
      });

      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: row.kind === "wallet_topup" ? "wallet.topup_result" : "match.payment_result",
        toUid: row.userId,
        status: "rejected",
        dedupeKey: `${row.kind}:payment_result:${String(row._id)}:failed`,
        dedupePolicy: "replace_active",
        route: row.kind === "wallet_topup" ? "/(player)/wallet" : "/(player)/inbox",
        title: row.kind === "wallet_topup" ? "Top-up Failed" : "Payment Failed",
        body: row.kind === "wallet_topup"
          ? "Your wallet top-up did not complete."
          : "Your booking payment did not complete.",
        data: {
          paymentTransactionId: String(row._id),
          bookingIntentId: row.bookingIntentId ? String(row.bookingIntentId) : null,
          orderRefNum: row.orderRefNum,
          decision: "failed",
          href: row.kind === "wallet_topup" ? "/(player)/wallet" : "/(player)/inbox",
        },
      });

      return {
        appReturnUrl: row.appReturnUrl,
        orderRefNum: row.orderRefNum,
        ok: true,
        shouldRetry: false,
        status: "failed",
      };
    }

    try {
      logGatewayDebug("reconcile.wallet_credit.begin", {
        transactionId: String(row._id),
        orderRefNum: row.orderRefNum,
        userId: String(row.userId),
        kind: row.kind,
        amount: row.amount,
      });
      await ctx.runMutation(api.wallet.addFunds, {
        userId: row.userId,
        amount: row.amount,
        reference: `easypaisa:${row.orderRefNum}`,
        metadata: {
          provider: "easypaisa",
          source: row.kind === "booking_intent" ? "booking_intent_funding" : "wallet_topup",
          transactionId: String(row._id),
          bookingIntentId: row.bookingIntentId ? String(row.bookingIntentId) : null,
          orderRefNum: row.orderRefNum,
          providerReference,
        },
      });

      if (row.kind === "booking_intent" && row.bookingIntentId) {
        logGatewayDebug("reconcile.booking_intent.begin", {
          transactionId: String(row._id),
          orderRefNum: row.orderRefNum,
          userId: String(row.userId),
          bookingIntentId: String(row.bookingIntentId),
          amount: row.amount,
        });
        await ctx.runMutation(api.matchrooms.payMatchroomSeatIntent, {
          intentId: row.bookingIntentId,
          userId: row.userId,
          externalPaymentReference: `easypaisa:${row.orderRefNum}`,
        });
      }

      await ctx.db.patch(row._id, {
        ...callbackPatch,
        providerPayload: row.kind === "booking_intent"
          ? { ...sourcePayload, bookingFundsMode: "wallet_hold" }
          : sourcePayload,
        status: "paid",
        processedAt: now,
        lastError: undefined,
      });

      logGatewayDebug("reconcile.complete", {
        transactionId: String(row._id),
        orderRefNum: row.orderRefNum,
        kind: row.kind,
        amount: row.amount,
        status: "paid",
      });

      if (row.kind === "wallet_topup") {
        await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
          type: "wallet.topup_result",
          toUid: row.userId,
          status: "accepted",
          dedupeKey: `wallet_topup:payment_result:${String(row._id)}:paid`,
          dedupePolicy: "replace_active",
          route: "/(player)/wallet",
          title: "Top-up Successful",
          body: "Funds were added to your wallet successfully.",
          data: {
            paymentTransactionId: String(row._id),
            orderRefNum: row.orderRefNum,
            decision: "paid",
            href: "/(player)/wallet",
          },
        });
      }

      return {
        appReturnUrl: row.appReturnUrl,
        orderRefNum: row.orderRefNum,
        ok: true,
        shouldRetry: false,
        status: "paid",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment reconciliation failed.";
      const walletCreditedBookingFailure =
        row.kind === "booking_intent" &&
        /slot is no longer available|payment window expired|matchroom has expired|matchroom is locked/i.test(message);

      if (walletCreditedBookingFailure) {
        await ctx.db.patch(row._id, {
          ...callbackPatch,
          providerPayload: { ...sourcePayload, bookingFundsMode: "wallet_hold" },
          status: "paid",
          processedAt: now,
          lastError: message,
        });

        await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
          type: "match.payment_result",
          toUid: row.userId,
          status: "accepted",
          dedupeKey: `booking_intent:payment_result:${String(row._id)}:wallet_credit_only`,
          dedupePolicy: "replace_active",
          route: "/(player)/wallet",
          title: "Payment added to wallet",
          body: "Your Easypaisa payment was received, but the booking could not be confirmed. Funds are available in your MatchHai wallet.",
          data: {
            paymentTransactionId: String(row._id),
            bookingIntentId: row.bookingIntentId ? String(row.bookingIntentId) : null,
            orderRefNum: row.orderRefNum,
            decision: "wallet_credit_only",
            href: "/(player)/wallet",
          },
        });

        return {
          appReturnUrl: row.appReturnUrl,
          orderRefNum: row.orderRefNum,
          ok: true,
          shouldRetry: false,
          status: "paid",
          message,
        };
      }

      logGatewayDebug("reconcile.error", {
        transactionId: String(row._id),
        orderRefNum: row.orderRefNum,
        kind: row.kind,
        amount: row.amount,
        message,
      });
      await ctx.db.patch(row._id, {
        ...callbackPatch,
        status: "pending",
        lastError: message,
      });

      const superAdmins = await ctx.db
        .query("users")
        .withIndex("by_role", (q: any) => q.eq("role", "super-admin"))
        .collect();
      for (const superAdmin of superAdmins) {
        await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
          type: "operations.general",
          toUid: superAdmin._id,
          recipientRole: "super_admin",
          status: "pending",
          dedupeKey: `payment.reconciliation_failure:${String(row._id)}:${String(superAdmin._id)}`,
          dedupePolicy: "replace_active",
          route: "/super-admin",
          title: "Payment reconciliation needs attention",
          body: message,
          data: {
            paymentTransactionId: String(row._id),
            orderRefNum: row.orderRefNum,
            kind: row.kind,
            href: "/super-admin",
          },
        });
      }

      return {
        appReturnUrl: row.appReturnUrl,
        orderRefNum: row.orderRefNum,
        ok: false,
        shouldRetry: true,
        status: "pending",
        message,
      };
    }
  },
});

export const easypaisaCheckoutPage = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const session: any = await ctx.runQuery(internal.easypaisa.getCheckoutSessionByToken, { token });

  if (!EASYPAISA_HOSTED_FALLBACK_ENABLED) {
    return new Response("Hosted Easypaisa fallback is disabled.", { status: 410 });
  }

  if (!session?.transaction || !session?.user) {
    return new Response("Transaction not found.", { status: 404 });
  }

  const transaction = session.transaction;
  if (transaction.processedAt || transaction.status === "paid") {
    return new Response("This payment session is no longer active.", { status: 410 });
  }

  const fields: Record<string, string> = {
    amount: Number(transaction.amount || 0).toFixed(1),
    storeId: EASYPAISA_STORE_ID,
    postBackURL: buildAbsoluteUrl(TOKEN_PATH, token),
    orderRefNum: transaction.orderRefNum,
    expiryDate: formatExpiryDate(Number(transaction.expiresAt || Date.now() + CHECKOUT_TTL_MS)),
    autoRedirect: "1",
  };

  const normalizedPhone = normalizePhoneForGateway(session.user.phone);
  if (session.user.email) fields.emailAddr = String(session.user.email);
  if (normalizedPhone) fields.mobileNum = normalizedPhone;
  if (EASYPAISA_PAYMENT_METHOD) fields.paymentMethod = EASYPAISA_PAYMENT_METHOD;

  if (EASYPAISA_HASH_KEY) {
    const hashResult: any = await ctx.runAction((internal as any).easypaisaNode.buildMerchantHashedReq, {
      fields: toGatewayFieldEntries(fields),
      hashKey: EASYPAISA_HASH_KEY,
    });
    if (hashResult?.merchantHashedReq) {
      fields.merchantHashedReq = String(hashResult.merchantHashedReq);
    }
  }

  const debugPayload = {
    env: EASYPAISA_ENV,
    storeIdMasked: maskStoreId(EASYPAISA_STORE_ID),
    indexUrl: EASYPAISA_INDEX_URL,
    confirmUrl: EASYPAISA_CONFIRM_URL,
    postBackURL: fields.postBackURL,
    orderRefNum: fields.orderRefNum,
    amount: fields.amount,
    autoRedirect: fields.autoRedirect,
    hasHash: Boolean(fields.merchantHashedReq),
    paymentMethod: fields.paymentMethod || null,
    mobileProvided: Boolean(fields.mobileNum),
    emailProvided: Boolean(fields.emailAddr),
    requestUrl: request.url,
  };

  logGatewayDebug("checkout.redirect", debugPayload);

  await ctx.runMutation(internal.easypaisa.markRedirected, {
    token,
    debug: debugPayload,
  });

  return new Response(
    autoSubmitHtml({
      title: "Redirecting to Easypaisa",
      action: EASYPAISA_INDEX_URL,
      fields,
      message: "MatchHai is redirecting you to Easypaisa checkout.",
    }),
    {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
});

export const easypaisaTokenHandler = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const authToken = url.searchParams.get("auth_token") || "";

  if (!token || !authToken) {
    return new Response("Missing checkout token or auth token.", { status: 400 });
  }

  await ctx.runMutation(internal.easypaisa.registerProviderToken, {
    token,
    authToken,
  });

  logGatewayDebug("token.received", {
    token,
    authTokenLength: authToken.length,
    requestUrl: request.url,
  });

  const fields = {
    auth_token: authToken,
    postBackURL: buildAbsoluteUrl(FINALIZE_PATH, token),
  };

  return new Response(
    autoSubmitHtml({
      title: "Confirming payment",
      action: EASYPAISA_CONFIRM_URL,
      fields,
      message: "MatchHai is confirming your Easypaisa transaction.",
    }),
    {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
});

export const easypaisaFinalizeHandler = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const formData: any = request.method === "POST" ? await request.formData() : null;

  if (!token) {
    return new Response("Missing checkout token.", { status: 400 });
  }

  const session: any = await ctx.runQuery(internal.easypaisa.getCheckoutSessionByToken, { token });
  if (!session?.transaction) {
    return new Response("Transaction not found.", { status: 404 });
  }

  const status = url.searchParams.get("status") || String(formData?.get?.("status") || "");
  const desc = url.searchParams.get("desc") || String(formData?.get?.("desc") || "");
  const orderRefNumber =
    url.searchParams.get("orderRefNumber")
    || url.searchParams.get("orderRefNum")
    || String(formData?.get?.("orderRefNumber") || formData?.get?.("orderRefNum") || "")
    || session.transaction.orderRefNum;
  const authToken = url.searchParams.get("auth_token") || String(formData?.get?.("auth_token") || "");

  const result = await ctx.runMutation((internal as any).easypaisa.applyProviderUpdate, {
    orderRefNum: orderRefNumber,
    source: "hosted_finalize",
    snapshot: {
      responseCode: status,
      responseDesc: desc,
      transactionStatus: status,
      authToken,
      paymentMethod: session.transaction.paymentMethod || EASYPAISA_PAYMENT_METHOD || null,
      providerReference: orderRefNumber,
      rawPayload: {
        orderRefNumber,
        status,
        desc,
        requestUrl: request.url,
        requestMethod: request.method,
      },
    },
  });

  if (!result.ok && result.shouldRetry) {
    return new Response(result.message || "Payment reconciliation is pending retry.", { status: 503 });
  }

  logGatewayDebug("finalize.received", {
    token,
    orderRefNumber,
    status,
    desc,
    resultStatus: result.status,
    requestMethod: request.method,
  });

  const paymentStatus = buildPaymentStatusForReturn(result.status);
  const separator = result.appReturnUrl.includes("?") ? "&" : "?";
  const returnUrl = `${result.appReturnUrl}${separator}gateway=easypaisa&paymentStatus=${paymentStatus}&orderRefNum=${encodeURIComponent(result.orderRefNum)}`;

  return new Response(
    redirectHtml(
      result.status === "paid"
        ? "Payment complete"
        : result.status === "pending"
          ? "Payment pending"
          : "Payment not completed",
      result.status === "paid"
        ? "Your Easypaisa payment was recorded. Returning to MatchHai."
        : result.status === "pending"
          ? "Your payment is being reconciled. MatchHai will reflect the final status shortly."
          : `Easypaisa returned: ${desc || status || "Unknown failure"}.`,
      returnUrl,
    ),
    {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
});

export const easypaisaIpnHandler = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const ipnUrl = url.searchParams.get("url") || "";
  const token = url.searchParams.get("token") || "";
  const formData: any = request.method === "POST" ? await request.formData() : null;
  const formEntries: Record<string, string> = {};
  if (formData && typeof formData.forEach === "function") {
    formData.forEach((value: any, key: string) => {
      formEntries[key] = String(value);
    });
  }

  try {
    let parsedPayload: any;
    if (ipnUrl) {
      const parsedIpnUrl = assertAllowedIpnUrl(ipnUrl);
      const providerResponse = await fetch(parsedIpnUrl.toString(), {
        signal: AbortSignal.timeout(PROVIDER_FETCH_TIMEOUT_MS),
        headers: {
          Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        },
      });
      const rawText = await providerResponse.text();

      try {
        parsedPayload = rawText ? JSON.parse(rawText) : {};
      } catch {
        parsedPayload = { rawText };
      }

      if (!providerResponse.ok) {
        return new Response("Provider status fetch failed.", { status: 502 });
      }
    } else {
      parsedPayload = parseDirectIpnPayload(url, formEntries);
    }

    const directPayload = parseDirectIpnPayload(url, formEntries);
    const orderRefNumber =
      parsedPayload?.orderRefNum
      || parsedPayload?.orderRefNumber
      || parsedPayload?.orderId
      || parsedPayload?.orderID
      || parsedPayload?.order_id
      || parsedPayload?.merchantTxnRefNo
      || directPayload.orderRefNumber;

    if (!orderRefNumber) {
      return new Response("Missing IPN order reference.", { status: 400 });
    }

    const result = await ctx.runMutation((internal as any).easypaisa.applyProviderUpdate, {
      orderRefNum: orderRefNumber,
      source: "ipn",
      snapshot: {
        responseCode: parsedPayload?.responseCode || directPayload.responseCode || null,
        responseDesc: parsedPayload?.responseDesc || parsedPayload?.responseMessage || parsedPayload?.description || directPayload.responseDesc || null,
        transactionStatus: parsedPayload?.transactionStatus || parsedPayload?.status || directPayload.transactionStatus || null,
        transactionId: parsedPayload?.transactionId || parsedPayload?.txnId || directPayload.transactionId || null,
        paymentToken: parsedPayload?.paymentToken || directPayload.paymentToken || null,
        paymentTokenExpiryDateTime: parsedPayload?.paymentTokenExpiryDateTime || null,
        transactionDateTime: parsedPayload?.transactionDateTime || null,
        paymentMode: parsedPayload?.paymentMode || directPayload.paymentMode || null,
        paymentMethod: parsedPayload?.paymentMethod || parsedPayload?.paymentMode || directPayload.paymentMethod || null,
        authToken: parsedPayload?.auth_token || parsedPayload?.authToken || directPayload.authToken || null,
        providerReference: parsedPayload?.transactionId || parsedPayload?.txnId || parsedPayload?.paymentToken || orderRefNumber,
        rawPayload: {
          ...(ipnUrl ? { ipnUrl } : {}),
          payload: parsedPayload,
          directPayload: Object.keys(formEntries).length > 0 ? directPayload.rawPayload : null,
          token: token || null,
        },
      },
    });

    if (!result.ok && result.shouldRetry) {
      return new Response(result.message || "Retrying reconciliation.", { status: 503 });
    }

    return new Response("ok", { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid IPN request.";
    return new Response(message, { status: 400 });
  }
});

export const easypaisaPaths = {
  checkout: CHECKOUT_PATH,
  token: TOKEN_PATH,
  finalize: FINALIZE_PATH,
  ipn: IPN_PATH,
};

export const getLatestCheckoutDebug = query({
  args: {
    orderRefNum: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedPaymentUser(ctx);
    const rows = await ctx.db
      .query("paymentTransactions")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const filtered = args.orderRefNum
      ? rows.filter((row: any) => String(row.orderRefNum) === String(args.orderRefNum))
      : rows;

    const latest = [...filtered].sort((a: any, b: any) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
    if (!latest) return null;

    return {
      transactionId: latest._id,
      orderRefNum: latest.orderRefNum,
      status: latest.status,
      providerStatus: latest.providerStatus || null,
      providerDescription: latest.providerDescription || null,
      paymentMethod: latest.paymentMethod || null,
      providerReference: latest.providerReference || null,
      lastError: latest.lastError || null,
      callbackCount: latest.callbackCount || 0,
      providerPayload: latest.providerPayload || null,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
    };
  },
});
