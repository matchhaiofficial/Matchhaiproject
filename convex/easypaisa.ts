import { v } from "convex/values";

import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { action, httpAction, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { EasypaisaTransactionType } from "./easypaisaRest";
import { KYC_VERIFICATION_REQUIRED_MESSAGE, assertKycAccessAllowed } from "./kycGate";
import { EASYPAY_CHECKOUT_TTL_MS, getMatchroomLockAt } from "./timing";

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

type CheckoutAttempt = "reused" | "created";

const ACTIVE_PAYMENT_STATUSES: PaymentStatus[] = ["created", "redirected", "token_received", "pending"];
const REUSED_ATTEMPT_MESSAGE = "Continuing previous payment attempt.";
const CREATED_ATTEMPT_MESSAGE = "Starting a new payment attempt.";
const ACTIVE_TOPUP_IN_PROGRESS_MESSAGE = "You already have a top-up in progress. Continue it or wait for it to finish.";
const PLAYER_WALLET_PAYMENT_ROUTE = "/(player)/wallet";
const PLAYER_INBOX_ROUTE = "/(player)/inbox";
const SUPER_ADMIN_PAYMENT_ATTENTION_TYPE = "payments.attention_required";

const PAYMENT_ATTENTION_COPY: Record<string, { title: string; body: string }> = {
  paid_no_wallet_tx: {
    title: "Payment attention required",
    body: "Paid payment has no linked wallet transaction. Review this order.",
  },
  wallet_tx_without_paid: {
    title: "Payment attention required",
    body: "Wallet transaction exists while payment is not paid. Review this order.",
  },
  booking_intent_unpaid_but_payment_paid: {
    title: "Payment attention required",
    body: "Booking intent is unpaid while payment is paid. Review this order.",
  },
  payment_pending_past_expiry: {
    title: "Payment attention required",
    body: "Payment is still pending after expiry. Review this order.",
  },
  failed_but_wallet_tx_exists: {
    title: "Payment attention required",
    body: "Failed payment has a linked wallet transaction. Review this order.",
  },
};

type ProviderSnapshot = {
  responseCode?: string | null;
  responseDesc?: string | null;
  transactionStatus?: string | null;
  transactionId?: string | null;
  orderRefNumber?: string | null;
  amount?: number | string | null;
  paymentToken?: string | null;
  paymentTokenExpiryDateTime?: string | null;
  transactionDateTime?: string | null;
  paymentMode?: string | null;
  paymentMethod?: string | null;
  providerReference?: string | null;
  authToken?: string | null;
  rawPayload?: any;
};

type PaymentAttentionFlag =
  | "paid_no_wallet_tx"
  | "wallet_tx_without_paid"
  | "booking_intent_unpaid_but_payment_paid"
  | "payment_pending_past_expiry"
  | "failed_but_wallet_tx_exists";

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

function isActiveCheckoutTransaction(transaction: any, now: number) {
  return Boolean(
    transaction
    && ACTIVE_PAYMENT_STATUSES.includes(transaction.status)
    && Number(transaction.expiresAt || 0) > now,
  );
}

function chooseLatestActiveTransaction(transactions: any[], now: number) {
  return transactions
    .filter((transaction) => isActiveCheckoutTransaction(transaction, now))
    .sort((a, b) =>
      Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0),
    )[0] || null;
}

function buildAttemptFields(attempt: CheckoutAttempt) {
  return {
    attempt,
    attemptMessage: attempt === "reused" ? REUSED_ATTEMPT_MESSAGE : CREATED_ATTEMPT_MESSAGE,
  };
}

function getSlotUserUid(slot: any): string {
  return String(slot?.uid || slot?.user?.uid || "").trim();
}

function getMatchroomPlayerUids(room: any): string[] {
  const fromPlayerUids = Array.isArray(room?.playerUids) ? room.playerUids.map(String) : [];
  const fromPlayers = Array.isArray(room?.players)
    ? room.players.map((player: any) => String(player?.uid || "")).filter(Boolean)
    : [];
  return Array.from(new Set([...fromPlayerUids, ...fromPlayers]));
}

function getAllMatchroomSlots(room: any): any[] {
  return [...(room?.slotsA || []), ...(room?.slotsB || [])];
}

function getRequiredPlayerCount(room: any): number {
  const maxPlayers = Number(room?.maxPlayers || 0);
  if (Number.isFinite(maxPlayers) && maxPlayers > 0) return maxPlayers;
  const slotCount = getAllMatchroomSlots(room).length;
  return Math.max(1, slotCount || Number(room?.currentPlayers || 0) || 1);
}

function getConfirmedPlayerCount(room: any): number {
  const slots = getAllMatchroomSlots(room);
  const confirmedSlotUids = slots
    .filter((slot: any) => slot?.status === "confirmed" && getSlotUserUid(slot))
    .map(getSlotUserUid);
  if (slots.length > 0) return new Set(confirmedSlotUids).size;
  return getMatchroomPlayerUids(room).length;
}

function isPaymentRosterFull(room: any): boolean {
  const required = getRequiredPlayerCount(room);
  const slotsA = room?.slotsA || [];
  const slotsB = room?.slotsB || [];
  if (slotsA.length > 0 || slotsB.length > 0) {
    const teamAFilled = slotsA.length === 0 || slotsA.every((slot: any) => slot?.status === "confirmed" && getSlotUserUid(slot));
    const teamBFilled = slotsB.length === 0 || slotsB.every((slot: any) => slot?.status === "confirmed" && getSlotUserUid(slot));
    return teamAFilled && teamBFilled && getConfirmedPlayerCount(room) >= required;
  }
  return getConfirmedPlayerCount(room) >= required;
}

function isPaymentMatchroomExpired(room: any, now = Date.now()): boolean {
  if (!room) return false;
  if (room.status === "expired" || room.status === "cancelled") return true;
  const scheduledStartAt = Number(room.scheduledStartAt || room.startTime || 0);
  if (
    ["open", "locked"].includes(String(room.status || ""))
    && Number.isFinite(scheduledStartAt)
    && scheduledStartAt > 0
    && scheduledStartAt <= now
    && !isPaymentRosterFull(room)
  ) {
    return true;
  }
  const expiresAt = Number(room.expiresAt || 0);
  return Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= now && !isPaymentRosterFull(room);
}

function isPaymentJoinLocked(room: any, now = Date.now()): boolean {
  if (!room || room.status === "cancelled" || room.status === "expired") return true;
  if (isPaymentRosterFull(room)) return true;
  const explicitLockAt = Number(room?.lockAt || 0);
  const lockAt = Number.isFinite(explicitLockAt) && explicitLockAt > 0
    ? explicitLockAt
    : getMatchroomLockAt(room?.scheduledStartAt || room?.startTime);
  return typeof lockAt === "number" && lockAt <= now;
}

function isActiveUnpaidBookingIntent(intent: any): boolean {
  if (!intent) return false;
  if (intent.paymentStatus === "paid") return false;
  return !["cancelled", "expired", "rejected", "confirmed"].includes(String(intent.status || ""));
}

function getIntentSelectedSlotId(intent: any): string {
  return String((intent?.selectedSlotIds || [])[0] || "").trim();
}

function hasTimeOverlap(startA: number, durationMinutesA: number, startB: number, durationMinutesB: number) {
  const endA = startA + durationMinutesA * 60 * 1000;
  const endB = startB + durationMinutesB * 60 * 1000;
  return startA < endB && endA > startB;
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

function getPlayerPaymentOutcomeCopy(kind: PaymentKind, decision: "paid" | "failed" | "expired" | "wallet_credit_only") {
  if (kind === "wallet_topup") {
    if (decision === "paid") {
      return {
        title: "Top-up successful",
        body: "Funds were added to your wallet. You can use them for bookings now.",
      };
    }
    if (decision === "expired") {
      return {
        title: "Top-up expired",
        body: "This top-up session expired before payment completed. Start a new top-up if you still want to add funds.",
      };
    }
    return {
      title: "Top-up not completed",
      body: "Your wallet top-up did not complete. You can try again or contact support with this order number if money was deducted.",
    };
  }

  if (decision === "wallet_credit_only") {
    return {
      title: "Payment added to wallet",
      body: "Your Easypaisa payment was received, but the booking could not be confirmed. Funds are available in your MatchHai wallet.",
    };
  }
  if (decision === "expired") {
    return {
      title: "Payment expired",
      body: "This booking payment session expired before the slot was confirmed. Start a new payment if the slot is still available.",
    };
  }
  if (decision === "paid") {
    return {
      title: "Payment successful",
      body: "Your payment was received and your booking is being confirmed.",
    };
  }
  return {
    title: "Payment not completed",
    body: "Your booking payment did not complete. You can try again or contact support with this order number if money was deducted.",
  };
}

function getPlayerPaymentRoute(kind: PaymentKind, decision: "paid" | "failed" | "expired" | "wallet_credit_only") {
  if (kind === "wallet_topup" || decision === "wallet_credit_only") return PLAYER_WALLET_PAYMENT_ROUTE;
  return PLAYER_INBOX_ROUTE;
}

async function notifyPlayerPaymentOutcome(ctx: any, input: {
  payment: any;
  decision: "paid" | "failed" | "expired" | "wallet_credit_only";
  status: "accepted" | "rejected" | "expired";
}) {
  const kind = input.payment.kind as PaymentKind;
  const route = getPlayerPaymentRoute(kind, input.decision);
  const copy = getPlayerPaymentOutcomeCopy(kind, input.decision);
  await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
    type: kind === "wallet_topup" ? "wallet.topup_result" : "match.payment_result",
    toUid: input.payment.userId,
    status: input.status,
    dedupeKey: `${kind}:payment_result:${String(input.payment._id)}:${input.decision}`,
    dedupePolicy: "replace_active",
    route,
    title: copy.title,
    body: copy.body,
    data: {
      paymentTransactionId: String(input.payment._id),
      bookingIntentId: input.payment.bookingIntentId ? String(input.payment.bookingIntentId) : null,
      orderRefNum: input.payment.orderRefNum,
      decision: input.decision,
      href: route,
    },
  });
}

function collectPaymentAttentionFlags(input: {
  payment: any;
  bookingIntent: any | null;
  walletTxExists: boolean;
  now: number;
}): PaymentAttentionFlag[] {
  const status = String(input.payment.status || "");
  const isPaid = status === "paid";
  const activePastExpiry =
    ["created", "redirected", "token_received", "pending"].includes(status)
    && Boolean(input.payment.expiresAt)
    && Number(input.payment.expiresAt) < input.now;
  const flags: PaymentAttentionFlag[] = [];

  if (isPaid && !input.walletTxExists) flags.push("paid_no_wallet_tx");
  if (input.walletTxExists && !isPaid) flags.push("wallet_tx_without_paid");
  if (isPaid && input.payment.kind === "booking_intent" && input.bookingIntent?.paymentStatus === "unpaid") {
    flags.push("booking_intent_unpaid_but_payment_paid");
  }
  if (activePastExpiry) flags.push("payment_pending_past_expiry");
  if (status === "failed" && input.walletTxExists) flags.push("failed_but_wallet_tx_exists");

  return flags;
}

async function notifySuperAdminsPaymentAttentionRequired(ctx: any, input: {
  payment: any;
  status?: PaymentStatus;
  now: number;
}) {
  const payment = {
    ...input.payment,
    status: input.status || input.payment.status,
  };
  const orderRefNum = String(payment.orderRefNum || "").trim();
  if (!orderRefNum) return;

  const [walletRows, bookingIntent] = await Promise.all([
    ctx.db
      .query("walletTransactions")
      .withIndex("by_reference", (q: any) => q.eq("reference", `easypaisa:${orderRefNum}`))
      .collect(),
    payment.bookingIntentId ? ctx.db.get(payment.bookingIntentId) : Promise.resolve(null),
  ]);
  const flags = collectPaymentAttentionFlags({
    payment,
    bookingIntent,
    walletTxExists: walletRows.length > 0,
    now: input.now,
  });
  if (flags.length === 0) return;

  const superAdmins = await ctx.db
    .query("users")
    .withIndex("by_role", (q: any) => q.eq("role", "super-admin"))
    .collect();
  const route = `/super-admin/payment/${encodeURIComponent(orderRefNum)}`;

  for (const flagName of flags) {
    const copy = PAYMENT_ATTENTION_COPY[flagName];
    for (const superAdmin of superAdmins) {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: SUPER_ADMIN_PAYMENT_ATTENTION_TYPE,
        toUid: superAdmin._id,
        recipientRole: "super_admin",
        status: "pending",
        dedupeKey: `payments.attention_required:${orderRefNum}:${flagName}:${String(superAdmin._id)}`,
        dedupePolicy: "upsert_active",
        pushPolicy: "eligible",
        route,
        entity: { kind: "paymentTransaction", id: String(payment._id) },
        entityId: String(payment._id),
        title: copy.title,
        body: copy.body,
        data: {
          orderRefNum,
          paymentTransactionId: String(payment._id),
          flagName,
          route,
          href: route,
        },
      });
    }
  }
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

function parseProviderAmountValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(normalized) ? normalized : null;
}

function findProviderAmount(payload: any): number | null {
  if (!payload || typeof payload !== "object") return null;
  const directKeys = [
    "amount",
    "transactionAmount",
    "txnAmount",
    "paidAmount",
    "totalAmount",
    "grossAmount",
  ];
  for (const key of directKeys) {
    const parsed = parseProviderAmountValue(payload[key]);
    if (parsed !== null) return parsed;
  }
  for (const value of Object.values(payload)) {
    if (value && typeof value === "object") {
      const parsed = findProviderAmount(value);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function findProviderOrderRef(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;
  const directKeys = [
    "orderRefNum",
    "orderRefNumber",
    "orderId",
    "orderID",
    "order_id",
    "merchantTxnRefNo",
  ];
  for (const key of directKeys) {
    const value = String(payload[key] || "").trim();
    if (value) return value;
  }
  for (const value of Object.values(payload)) {
    if (value && typeof value === "object") {
      const found = findProviderOrderRef(value);
      if (found) return found;
    }
  }
  return null;
}

function getProviderOrderRef(snapshot: ProviderSnapshot) {
  return String(
    snapshot.orderRefNumber
    || findProviderOrderRef(snapshot.rawPayload)
    || "",
  ).trim();
}

function getProviderAmount(snapshot: ProviderSnapshot) {
  const explicit = parseProviderAmountValue(snapshot.amount);
  if (explicit !== null) return explicit;
  return findProviderAmount(snapshot.rawPayload);
}

function amountsMatch(expected: number, actual: number) {
  return Math.abs(Number(expected || 0) - Number(actual || 0)) < 0.01;
}

function getRestInquiryResponse(snapshot: ProviderSnapshot) {
  return snapshot.rawPayload?.rest?.inquiry?.response || {};
}

function isInvalidOrderInquiryFailure(source: ProviderSource, snapshot: ProviderSnapshot, normalized: ReturnType<typeof normalizeProviderUpdate>) {
  if (source !== "inquiry" || normalized.resolvedStatus !== "failed") {
    return false;
  }

  const inquiryResponse = getRestInquiryResponse(snapshot);
  const values = [
    inquiryResponse.errorCode,
    inquiryResponse.responseCode,
    inquiryResponse.errorReason,
    inquiryResponse.responseDesc,
    snapshot.rawPayload?.errorCode,
    snapshot.rawPayload?.responseCode,
    snapshot.rawPayload?.errorReason,
    snapshot.rawPayload?.responseDesc,
    normalized.responseCode,
    normalized.responseDesc,
  ];

  return values.some((value) => {
    const text = String(value || "").trim().toUpperCase();
    if (!text) return false;
    const compact = text.replace(/[^A-Z0-9]/g, "");
    return compact.includes("INVALIDORDER");
  });
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
    matchroomCreateArgs: v.optional(v.any()),
    teamChallengeHold: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await getPaymentUserWithFallback(ctx, args.userId);
    const now = Date.now();

    let bookingIntentId: Id<"bookingIntents"> | undefined;
    let amount = 0;
    let currency = "PKR";

    if (args.kind === "booking_intent") {
      if (!args.bookingIntentId) {
        throw new Error("Booking intent is required.");
      }
      assertKycAccessAllowed(user, KYC_VERIFICATION_REQUIRED_MESSAGE);

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
      if (intent.expiresAt && intent.expiresAt < now) {
        throw new Error("This payment window has expired. Please request a new seat.");
      }
      if (intent.status !== "approved_pending_payment" && intent.status !== "approved") {
        throw new Error("This booking is not ready for payment yet.");
      }

      bookingIntentId = args.bookingIntentId;
      amount = Number(intent.pricing?.totalCost || 0);
      currency = String(intent.pricing?.currency || "PKR");
      if (!Number.isFinite(amount) || amount <= 0) {
        console.warn("[easypaisa] booking checkout blocked: invalid server-derived amount", {
          bookingIntentId: String(args.bookingIntentId),
          matchroomId: String(intent.matchroomId),
          userId: String(user._id),
          amount,
        });
        throw new Error("This booking is not ready for payment yet.");
      }

      const room = await ctx.db.get(intent.matchroomId);
      if (!room) {
        throw new Error("This matchroom is no longer available.");
      }
      if (room.status === "cancelled" || isPaymentMatchroomExpired(room, now)) {
        throw new Error("This matchroom is no longer available.");
      }

      const playerUids = getMatchroomPlayerUids(room);
      const payerUid = String(user._id);
      const side = String(intent.side || "");
      const selectedSlotId = getIntentSelectedSlotId(intent);

      if (!selectedSlotId) {
        console.warn("[easypaisa] booking checkout blocked: missing selected slot", {
          bookingIntentId: String(args.bookingIntentId),
          matchroomId: String(intent.matchroomId),
          userId: payerUid,
        });
        throw new Error("This slot is no longer available.");
      }

      const targetSlots = side === "A" ? (room.slotsA || []) : side === "B" ? (room.slotsB || []) : [];
      const slot = targetSlots.find((entry: any) => String(entry?.slotId || "") === selectedSlotId);
      if (!slot) {
        console.warn("[easypaisa] booking checkout blocked: selected slot missing", {
          bookingIntentId: String(args.bookingIntentId),
          matchroomId: String(intent.matchroomId),
          userId: payerUid,
          side,
          selectedSlotId,
        });
        throw new Error("This slot is no longer available.");
      }

      const slotUserUid = getSlotUserUid(slot);
      if (playerUids.includes(payerUid) || slotUserUid === payerUid) {
        throw new Error("You are already in this matchroom.");
      }
      if (slotUserUid) {
        console.warn("[easypaisa] booking checkout blocked: selected slot occupied", {
          bookingIntentId: String(args.bookingIntentId),
          matchroomId: String(intent.matchroomId),
          userId: payerUid,
          side,
          selectedSlotId,
          occupiedByUid: slotUserUid,
        });
        throw new Error("This slot is no longer available.");
      }
      if (isPaymentJoinLocked(room, now)) {
        throw new Error("This matchroom is no longer available.");
      }

      const relatedIntents = await ctx.db
        .query("bookingIntents")
        .withIndex("by_createdByUid_matchroomId", (q: any) =>
          q.eq("createdByUid", user._id).eq("matchroomId", intent.matchroomId)
        )
        .collect();
      const duplicateIntent = relatedIntents.find((otherIntent: any) =>
        String(otherIntent._id) !== String(args.bookingIntentId)
        && isActiveUnpaidBookingIntent(otherIntent)
        && getIntentSelectedSlotId(otherIntent) === selectedSlotId
      );
      if (duplicateIntent) {
        console.warn("[easypaisa] booking checkout blocked: duplicate payable intent", {
          bookingIntentId: String(args.bookingIntentId),
          duplicateIntentId: String(duplicateIntent._id),
          matchroomId: String(intent.matchroomId),
          userId: payerUid,
          selectedSlotId,
        });
        throw new Error("You already have an active payment attempt for this slot.");
      }

      const targetStart = Number(room.scheduledStartAt || 0);
      const targetDurationMinutes = Number(room.durationMinutes || 60);
      if (
        Number.isFinite(targetStart)
        && targetStart > 0
        && Number.isFinite(targetDurationMinutes)
        && targetDurationMinutes > 0
      ) {
        const recentRooms = await ctx.db
          .query("matchrooms")
          .withIndex("by_createdAt")
          .order("desc")
          .take(100);
        const conflict = recentRooms.find((candidate: any) => {
          if (String(candidate._id) === String(room._id)) return false;
          if (!getMatchroomPlayerUids(candidate).includes(payerUid)) return false;
          if (!["open", "locked", "in-progress"].includes(String(candidate.status || ""))) return false;
          const candidateStart = Number(candidate.scheduledStartAt || 0);
          const candidateDurationMinutes = Number(candidate.durationMinutes || 60);
          if (!Number.isFinite(candidateStart) || candidateStart <= 0) return false;
          if (!Number.isFinite(candidateDurationMinutes) || candidateDurationMinutes <= 0) return false;
          return hasTimeOverlap(targetStart, targetDurationMinutes, candidateStart, candidateDurationMinutes);
        });
        if (conflict) {
          console.warn("[easypaisa] booking checkout blocked: time conflict", {
            bookingIntentId: String(args.bookingIntentId),
            matchroomId: String(intent.matchroomId),
            conflictMatchroomId: String(conflict._id),
            userId: payerUid,
          });
          throw new Error("You have another match at this time.");
        }
      }

      let activeTransaction: any = null;
      if (intent.activePaymentTransactionId) {
        const pointedTransaction = await ctx.db.get(intent.activePaymentTransactionId);
        if (
          pointedTransaction
          && String(pointedTransaction.bookingIntentId || "") === String(bookingIntentId)
          && isActiveCheckoutTransaction(pointedTransaction, now)
        ) {
          activeTransaction = pointedTransaction;
        }
      }
      if (!activeTransaction) {
        const existing = await ctx.db
          .query("paymentTransactions")
          .withIndex("by_bookingIntentId", (q) => q.eq("bookingIntentId", bookingIntentId!))
          .collect();
        activeTransaction = chooseLatestActiveTransaction(existing, now);
      }

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
    if (user.activeTopupPaymentTransactionId) {
      const pointedTransaction: any = await ctx.db.get(user.activeTopupPaymentTransactionId);
      if (
        pointedTransaction
        && pointedTransaction.kind === "wallet_topup"
        && String(pointedTransaction.userId) === String(user._id)
        && isActiveCheckoutTransaction(pointedTransaction, now)
      ) {
        activeTransaction = pointedTransaction;
      }
    }
    if (!activeTransaction) {
      const activeTopups: any[] = [];
      for (const status of ACTIVE_PAYMENT_STATUSES) {
        const rows = await ctx.db
          .query("paymentTransactions")
          .withIndex("by_userId_and_status", (q) => q.eq("userId", user._id).eq("status", status))
          .collect();
        activeTopups.push(...rows.filter((transaction: any) =>
          transaction.kind === "wallet_topup"
          && isActiveCheckoutTransaction(transaction, now),
        ));
      }
      activeTransaction = chooseLatestActiveTransaction(activeTopups, now);
    }

    if (activeTransaction && Number(activeTransaction.amount || 0) !== amount) {
      throw new Error(ACTIVE_TOPUP_IN_PROGRESS_MESSAGE);
    }

    if (
      activeTransaction
      && (args.matchroomCreateArgs || args.teamChallengeHold)
      && !activeTransaction.providerPayload?.checkoutContext?.matchroomCreateArgs
      && !activeTransaction.providerPayload?.checkoutContext?.teamChallengeHold
    ) {
      activeTransaction = null;
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

export const createCheckoutTransactionWithLock = internalMutation({
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
    matchroomCreateArgs: v.optional(v.any()),
    teamChallengeHold: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    if (args.kind === "booking_intent") {
      if (!args.bookingIntentId) {
        throw new Error("Booking intent is required.");
      }

      const intent = await ctx.db.get(args.bookingIntentId);
      if (!intent) {
        throw new Error("Booking intent not found.");
      }
      if (String(intent.createdByUid) !== String(args.userId)) {
        throw new Error("You can only pay for your own booking.");
      }

      if (intent.activePaymentTransactionId) {
        const pointedTransaction = await ctx.db.get(intent.activePaymentTransactionId);
        if (
          pointedTransaction
          && String(pointedTransaction.bookingIntentId || "") === String(args.bookingIntentId)
          && isActiveCheckoutTransaction(pointedTransaction, now)
        ) {
          return { transaction: pointedTransaction, ...buildAttemptFields("reused") };
        }
      }

      const existing = await ctx.db
        .query("paymentTransactions")
        .withIndex("by_bookingIntentId", (q) => q.eq("bookingIntentId", args.bookingIntentId!))
        .collect();
      const activeTransaction = chooseLatestActiveTransaction(existing, now);
      if (activeTransaction) {
        await ctx.db.patch(args.bookingIntentId, {
          activePaymentTransactionId: activeTransaction._id,
          activePaymentOrderRefNum: activeTransaction.orderRefNum,
          activePaymentExpiresAt: activeTransaction.expiresAt,
          updatedAt: now,
        });
        return { transaction: activeTransaction, ...buildAttemptFields("reused") };
      }
    } else {
      const user = await ctx.db.get(args.userId);
      if (!user) {
        throw new Error("User profile not found.");
      }

      if (user.activeTopupPaymentTransactionId) {
        const pointedTransaction: any = await ctx.db.get(user.activeTopupPaymentTransactionId);
        if (
          pointedTransaction
          && pointedTransaction.kind === "wallet_topup"
          && String(pointedTransaction.userId) === String(args.userId)
          && isActiveCheckoutTransaction(pointedTransaction, now)
        ) {
          if (Number(pointedTransaction.amount || 0) !== Number(args.amount || 0)) {
            throw new Error(ACTIVE_TOPUP_IN_PROGRESS_MESSAGE);
          }
          if (
            (args.matchroomCreateArgs || args.teamChallengeHold)
            && !pointedTransaction.providerPayload?.checkoutContext?.matchroomCreateArgs
            && !pointedTransaction.providerPayload?.checkoutContext?.teamChallengeHold
          ) {
            // Do not bind a domain-linked payment to a generic wallet top-up.
          } else {
          return { transaction: pointedTransaction, ...buildAttemptFields("reused") };
          }
        }
      }

      const activeTopups: any[] = [];
      for (const status of ACTIVE_PAYMENT_STATUSES) {
      const rows = await ctx.db
        .query("paymentTransactions")
        .withIndex("by_userId_and_status", (q) => q.eq("userId", args.userId).eq("status", status))
        .collect();
        activeTopups.push(...rows.filter((transaction: any) =>
        transaction.kind === "wallet_topup"
          && isActiveCheckoutTransaction(transaction, now),
        ));
      }
      const activeTransaction = chooseLatestActiveTransaction(activeTopups, now);
      if (activeTransaction) {
        if (Number(activeTransaction.amount || 0) !== Number(args.amount || 0)) {
          throw new Error(ACTIVE_TOPUP_IN_PROGRESS_MESSAGE);
        }
        if (
          (args.matchroomCreateArgs || args.teamChallengeHold)
          && !activeTransaction.providerPayload?.checkoutContext?.matchroomCreateArgs
          && !activeTransaction.providerPayload?.checkoutContext?.teamChallengeHold
        ) {
          // Continue below and create a domain-linked checkout.
        } else {
        await ctx.db.patch(args.userId, {
          activeTopupPaymentTransactionId: activeTransaction._id,
          activeTopupAmount: activeTransaction.amount,
          activeTopupExpiresAt: activeTransaction.expiresAt,
          updatedAt: now,
        });
        return { transaction: activeTransaction, ...buildAttemptFields("reused") };
        }
      }
    }

    const transactionId = await ctx.db.insert("paymentTransactions", {
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
          matchroomCreateArgs: args.matchroomCreateArgs || null,
          teamChallengeHold: args.teamChallengeHold || null,
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
      createdAt: now,
      updatedAt: now,
    });

    const transaction = await ctx.db.get(transactionId);
    if (!transaction) {
      throw new Error("Could not start the payment attempt.");
    }

    if (args.kind === "booking_intent" && args.bookingIntentId) {
      await ctx.db.patch(args.bookingIntentId, {
        activePaymentTransactionId: transactionId,
        activePaymentOrderRefNum: args.orderRefNum,
        activePaymentExpiresAt: args.expiresAt,
        updatedAt: now,
      });
    } else if (args.kind === "wallet_topup") {
      await ctx.db.patch(args.userId, {
        activeTopupPaymentTransactionId: transactionId,
        activeTopupAmount: args.amount,
        activeTopupExpiresAt: args.expiresAt,
        updatedAt: now,
      });
    }

    return { transaction, ...buildAttemptFields("created") };
  },
});

async function clearActivePaymentPointerIfMatching(ctx: any, transaction: any, now: number) {
  if (transaction.kind === "booking_intent" && transaction.bookingIntentId) {
    const intent = await ctx.db.get(transaction.bookingIntentId);
    if (
      intent?.activePaymentTransactionId
      && String(intent.activePaymentTransactionId) === String(transaction._id)
    ) {
      await ctx.db.patch(transaction.bookingIntentId, {
        activePaymentTransactionId: undefined,
        activePaymentOrderRefNum: undefined,
        activePaymentExpiresAt: undefined,
        updatedAt: now,
      });
    }
  }

  if (transaction.kind === "wallet_topup") {
    const user = await ctx.db.get(transaction.userId);
    if (
      user?.activeTopupPaymentTransactionId
      && String(user.activeTopupPaymentTransactionId) === String(transaction._id)
    ) {
      await ctx.db.patch(transaction.userId, {
        activeTopupPaymentTransactionId: undefined,
        activeTopupAmount: undefined,
        activeTopupExpiresAt: undefined,
        updatedAt: now,
      });
    }
  }
}

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
    const now = Date.now();
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
      updatedAt: now,
    });
    await clearActivePaymentPointerIfMatching(ctx, existing, now);
    await notifySuperAdminsPaymentAttentionRequired(ctx, {
      payment: existing,
      status: "failed",
      now,
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
    matchroomCreateArgs: v.optional(v.any()),
    teamChallengeHold: v.optional(v.any()),
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
      matchroomCreateArgs: args.matchroomCreateArgs,
      teamChallengeHold: args.teamChallengeHold,
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
        ...buildAttemptFields("reused"),
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

    const checkoutStart: any = await ctx.runMutation((internal as any).easypaisa.createCheckoutTransactionWithLock, {
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
      matchroomCreateArgs: args.matchroomCreateArgs,
      teamChallengeHold: args.teamChallengeHold,
    });
    const transaction = checkoutStart.transaction;
    const attempt = String(checkoutStart.attempt || "created") as CheckoutAttempt;
    const attemptMessage = String(checkoutStart.attemptMessage || CREATED_ATTEMPT_MESSAGE);
    const transactionId = transaction._id as Id<"paymentTransactions">;

    if (attempt === "reused") {
      logGatewayDebug("start.reuse_active_after_lock", {
        transactionId: String(transaction._id),
        orderRefNum: transaction.orderRefNum,
        status: transaction.status,
        amount: transaction.amount,
        kind: transaction.kind,
      });
      return {
        transactionId: transaction._id,
        orderRefNum: transaction.orderRefNum,
        checkoutUrl: transaction.checkoutUrl || null,
        expiresAt: transaction.expiresAt,
        status: transaction.status,
        attempt,
        attemptMessage,
        transactionType: transaction.providerPayload?.rest?.initiate?.request?.transactionType || "MA",
        hostedFallbackAvailable: EASYPAISA_HOSTED_FALLBACK_ENABLED,
        actionRequired: transaction.providerPayload?.rest?.initiate?.actionRequired || "approve_in_easypaisa",
        paymentToken: transaction.providerPayload?.rest?.initiate?.response?.paymentToken || null,
        paymentTokenExpiryDateTime: transaction.providerPayload?.rest?.initiate?.response?.paymentTokenExpiryDateTime || null,
      };
    }

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
        attempt,
        attemptMessage,
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
          attempt,
          attemptMessage,
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
      attempt,
      attemptMessage,
      transactionType,
      hostedFallbackAvailable: EASYPAISA_HOSTED_FALLBACK_ENABLED,
      actionRequired: transactionType === "OTC" ? "pay_with_token" : "approve_in_easypaisa",
      paymentToken: responseBody?.paymentToken || null,
      paymentTokenExpiryDateTime: responseBody?.paymentTokenExpiryDateTime || null,
    };
  },
});

// Server-to-server reconcile for a single transaction row: perform the REST
// inquiry then apply the result via the inquiry-sourced provider update (the
// only source allowed to resurrect a terminal-not-paid row to paid). Shared by
// the client-driven sync action and the stale-payment reconciler cron so both
// go through the identical, audited safe path.
async function performProviderInquiryAndApply(ctx: any, row: any) {
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
  return applyResult;
}

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

    const applyResult: any = await performProviderInquiryAndApply(ctx, row);

    return {
      ok: true,
      status: applyResult.status,
      shouldRetry: applyResult.shouldRetry,
      message: applyResult.message || null,
    };
  },
});

// --- Stuck/abandoned payment reconciler (cron) -----------------------------
// Reconciliation is otherwise only triggered by the client poll or a provider
// IPN. If the app is killed after the user paid and the IPN is dropped/delayed,
// a "provider paid / local pending" transaction would never be reconciled and
// the wallet never credited. This cron re-inquires stale ACTIVE transactions
// through the same inquiry+applyProviderUpdate path, which is idempotent
// (processedAt / status==="paid" short-circuits, reference-keyed wallet ops) and
// already credits the wallet + notifies the payer & super admins when the
// provider confirms paid but the booking/create can no longer complete.
const STALE_PAYMENT_RECONCILE_AFTER_MS = 10 * 60 * 1000; // give the client poll/IPN ~10m first
const STALE_PAYMENT_RECONCILE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // don't re-inquire ancient rows
const STALE_PAYMENT_RECONCILE_COOLDOWN_MS = 30 * 60 * 1000; // throttle re-inquiry of a row that was recently reconciled

export const listStaleActivePaymentTransactions = internalQuery({
  args: {
    olderThanMs: v.number(),
    maxAgeMs: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const cutoff = now - Math.max(0, args.olderThanMs);
    const floor = now - Math.max(0, args.maxAgeMs);
    const limit = Math.max(1, Math.min(Math.floor(args.limit), 50));
    const activeStatuses: PaymentStatus[] = ["created", "redirected", "token_received", "pending"];
    const out: Array<{ orderRefNum: string }> = [];
    for (const status of activeStatuses) {
      if (out.length >= limit) break;
      const batch = await ctx.db
        .query("paymentTransactions")
        .withIndex("by_provider_and_status_and_createdAt", (q: any) =>
          q
            .eq("provider", "easypaisa")
            .eq("status", status)
            .gte("createdAt", floor)
            .lte("createdAt", cutoff),
        )
        .order("asc")
        .take(limit);
      for (const row of batch) {
        out.push({ orderRefNum: row.orderRefNum });
        if (out.length >= limit) break;
      }
    }
    return out.slice(0, limit);
  },
});

export const reconcileStalePayments = internalAction({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    try {
      ensurePaymentConfig();
    } catch (error) {
      logGatewayDebug("reconcile.cron.config_unavailable", {
        message: error instanceof Error ? error.message : String(error),
      });
      return { ok: false, reason: "payment_config_unavailable", scanned: 0, processed: 0 };
    }

    const limit = Math.max(1, Math.min(Number(args.batchSize || 15), 50));
    const staleRows: Array<{ orderRefNum: string }> = await ctx.runQuery(
      (internal as any).easypaisa.listStaleActivePaymentTransactions,
      {
        olderThanMs: STALE_PAYMENT_RECONCILE_AFTER_MS,
        maxAgeMs: STALE_PAYMENT_RECONCILE_MAX_AGE_MS,
        limit,
      },
    );

    let processed = 0;
    let paid = 0;
    let failedOrExpired = 0;
    let errors = 0;
    for (const stale of staleRows) {
      try {
        const row: any = await ctx.runQuery((internal as any).easypaisa.getTransactionByOrderRef, {
          orderRefNum: stale.orderRefNum,
        });
        if (!row) continue;
        // Re-check it is still active — a concurrent IPN/poll may have resolved it.
        if (!["created", "redirected", "token_received", "pending"].includes(String(row.status))) continue;
        // Throttle: a permanently-stuck row (provider keeps returning pending) is
        // re-inquired at most once per cooldown window instead of every cron tick.
        if (row.lastCallbackAt && Date.now() - Number(row.lastCallbackAt) < STALE_PAYMENT_RECONCILE_COOLDOWN_MS) continue;
        const result: any = await performProviderInquiryAndApply(ctx, row);
        processed += 1;
        if (result?.status === "paid") paid += 1;
        else if (result?.status === "failed" || result?.status === "expired") failedOrExpired += 1;
      } catch (error) {
        errors += 1;
        logGatewayDebug("reconcile.cron.error", {
          orderRefNum: stale.orderRefNum,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { ok: true, scanned: staleRows.length, processed, paid, failedOrExpired, errors };
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
      finalizedMatchroomId: latest.providerPayload?.matchroomCreate?.matchroomId || null,
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
    const keepInvalidOrderInquiryPending =
      isInvalidOrderInquiryFailure(args.source, snapshot, normalized)
      && Number(row.expiresAt || 0) > now;
    const keepInquiryPending = keepMaNoResponsePending || keepInvalidOrderInquiryPending;
    const providerReference = getProviderReference(snapshot, row.orderRefNum);
    const providerOrderRef = getProviderOrderRef(snapshot);
    const providerAmount = getProviderAmount(snapshot);
    logGatewayDebug("provider.update", {
      transactionId: String(row._id),
      orderRefNum: row.orderRefNum,
      source: args.source,
      kind: row.kind,
      amount: row.amount,
      previousStatus: row.status,
      resolvedStatus: normalized.resolvedStatus,
      keepPending: keepInquiryPending,
      keepPendingReason: keepInvalidOrderInquiryPending
        ? "invalid_order_inquiry"
        : keepMaNoResponsePending
          ? "ma_no_response"
          : null,
      providerStatus: normalized.transactionStatus || normalized.responseCode || null,
      providerDescription: normalized.responseDesc || null,
      providerReference,
      providerOrderRef: providerOrderRef || null,
      providerAmount,
      processedAt: row.processedAt || null,
    });

    const payloadMismatch =
      (providerOrderRef && providerOrderRef !== row.orderRefNum)
      || (providerAmount !== null && !amountsMatch(row.amount, providerAmount));
    if (payloadMismatch) {
      const reason = providerOrderRef && providerOrderRef !== row.orderRefNum
        ? "provider_order_reference_mismatch"
        : "provider_amount_mismatch";
      const currentPayload = row.providerPayload || {};
      await ctx.db.patch(row._id, {
        providerStatus: normalized.transactionStatus || normalized.responseCode || undefined,
        providerDescription: normalized.responseDesc || undefined,
        providerPayload: {
          ...currentPayload,
          anomaly: {
            reason,
            source: args.source,
            expectedOrderRefNum: row.orderRefNum,
            providerOrderRef: providerOrderRef || null,
            expectedAmount: row.amount,
            providerAmount,
            detectedAt: now,
          },
          lastProviderStatus: normalized.transactionStatus || normalized.responseCode,
          lastSyncAt: now,
        },
        providerReference,
        callbackCount: Number(row.callbackCount || 0) + (args.source === "initiate" ? 0 : 1),
        lastCallbackAt: args.source === "initiate" ? row.lastCallbackAt : now,
        lastError: reason,
        updatedAt: now,
      });
      await notifySuperAdminsPaymentAttentionRequired(ctx, {
        payment: row,
        status: row.status as PaymentStatus,
        now,
      });
      return {
        appReturnUrl: row.appReturnUrl,
        orderRefNum: row.orderRefNum,
        ok: false,
        shouldRetry: false,
        status: row.status as PaymentStatus,
        message: "Payment provider payload did not match the expected transaction.",
      };
    }
    const currentPayload = row.providerPayload || {};
    let sourcePayload = args.source === "ipn"
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

    if (
      isTerminalStatus(row.status as PaymentStatus)
      && row.status !== "paid"
      && normalized.resolvedStatus === "paid"
      && args.source !== "inquiry"
    ) {
      await ctx.db.patch(row._id, {
        ...callbackPatch,
        status: row.status,
        lastError: "terminal_state_requires_provider_inquiry",
      });
      await notifySuperAdminsPaymentAttentionRequired(ctx, {
        payment: row,
        status: row.status as PaymentStatus,
        now,
      });
      return {
        appReturnUrl: row.appReturnUrl,
        orderRefNum: row.orderRefNum,
        ok: false,
        shouldRetry: false,
        status: row.status as PaymentStatus,
        message: "Terminal payment state was not changed without provider inquiry.",
      };
    }

    if (row.processedAt || row.status === "paid") {
      const matchroomCreateArgs = row.kind === "wallet_topup"
        ? row.providerPayload?.checkoutContext?.matchroomCreateArgs
        : null;
      if (matchroomCreateArgs && !row.providerPayload?.matchroomCreate?.matchroomId) {
        const finalizeResult: any = await ctx.runMutation(
          internal.matchrooms.finalizePaidCreateFromProvider,
          {
            orderRefNum: row.orderRefNum,
            userId: row.userId,
            amount: row.amount,
            matchroomCreateArgs,
          },
        );
        const matchroomId = finalizeResult?.matchroomId;
        if (matchroomId) {
          await ctx.runMutation(internal.wallet.deductFundsInternal, {
            amount: row.amount,
            metadata: {
              flow: String(matchroomCreateArgs.locationMode || "") === "broadcast"
                ? "broadcast_matchroom_create"
                : "zone_matchroom_create",
              matchroomId: String(matchroomId),
              provider: "easypaisa",
              orderRefNum: row.orderRefNum,
              transactionId: String(row._id),
            },
            reference: `matchroom_create:${String(matchroomId)}`,
            source: "matchroom_create",
            userId: row.userId,
          });
          sourcePayload = {
            ...sourcePayload,
            matchroomCreate: {
              finalizedAt: now,
              matchroomId: String(matchroomId),
            },
          };
        }
      }
      await ctx.db.patch(row._id, {
        ...callbackPatch,
        providerPayload: sourcePayload,
        status: "paid",
      });
      await clearActivePaymentPointerIfMatching(ctx, row, now);
      await notifySuperAdminsPaymentAttentionRequired(ctx, {
        payment: row,
        status: "paid",
        now,
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
      && (normalized.resolvedStatus === "pending" || keepInquiryPending)
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
      await clearActivePaymentPointerIfMatching(ctx, row, now);

      await notifyPlayerPaymentOutcome(ctx, {
        payment: row,
        decision: "expired",
        status: "expired",
      });
      await notifySuperAdminsPaymentAttentionRequired(ctx, {
        payment: row,
        status: "expired",
        now,
      });

      return {
        appReturnUrl: row.appReturnUrl,
        orderRefNum: row.orderRefNum,
        ok: true,
        shouldRetry: false,
        status: "expired",
      };
    }

    if (normalized.resolvedStatus === "pending" || keepInquiryPending) {
      await ctx.db.patch(row._id, {
        ...callbackPatch,
        status: row.status === "redirected" || row.status === "token_received" ? row.status : "pending",
        lastError: keepInquiryPending ? "inquiry_unverified" : undefined,
      });
      await notifySuperAdminsPaymentAttentionRequired(ctx, {
        payment: row,
        status: row.status === "redirected" || row.status === "token_received" ? row.status : "pending",
        now,
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
      await clearActivePaymentPointerIfMatching(ctx, row, now);

      await notifyPlayerPaymentOutcome(ctx, {
        payment: row,
        decision: "expired",
        status: "expired",
      });
      await notifySuperAdminsPaymentAttentionRequired(ctx, {
        payment: row,
        status: "expired",
        now,
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
      await clearActivePaymentPointerIfMatching(ctx, row, now);

      await notifyPlayerPaymentOutcome(ctx, {
        payment: row,
        decision: "failed",
        status: "rejected",
      });
      await notifySuperAdminsPaymentAttentionRequired(ctx, {
        payment: row,
        status: "failed",
        now,
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
      await ctx.runMutation(internal.wallet.addFunds, {
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
        await ctx.runMutation(internal.matchrooms.confirmPaidMatchroomSeatIntentFromProvider, {
          intentId: row.bookingIntentId,
          userId: row.userId,
          externalPaymentReference: `easypaisa:${row.orderRefNum}`,
        });
      }

      const matchroomCreateArgs = row.kind === "wallet_topup"
        ? row.providerPayload?.checkoutContext?.matchroomCreateArgs
        : null;
      if (matchroomCreateArgs) {
        logGatewayDebug("reconcile.matchroom_create.begin", {
          transactionId: String(row._id),
          orderRefNum: row.orderRefNum,
          userId: String(row.userId),
          amount: row.amount,
        });
        const finalizeResult: any = await ctx.runMutation(
          internal.matchrooms.finalizePaidCreateFromProvider,
          {
            orderRefNum: row.orderRefNum,
            userId: row.userId,
            amount: row.amount,
            matchroomCreateArgs,
          },
        );
        const matchroomId = finalizeResult?.matchroomId;
        if (matchroomId) {
          await ctx.runMutation(internal.wallet.deductFundsInternal, {
            amount: row.amount,
            metadata: {
              flow: String(matchroomCreateArgs.locationMode || "") === "broadcast"
                ? "broadcast_matchroom_create"
                : "zone_matchroom_create",
              matchroomId: String(matchroomId),
              provider: "easypaisa",
              orderRefNum: row.orderRefNum,
              transactionId: String(row._id),
            },
            reference: `matchroom_create:${String(matchroomId)}`,
            source: "matchroom_create",
            userId: row.userId,
          });
          sourcePayload = {
            ...sourcePayload,
            matchroomCreate: {
              finalizedAt: now,
              matchroomId: String(matchroomId),
            },
          };
        }
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
      await clearActivePaymentPointerIfMatching(ctx, row, now);

      logGatewayDebug("reconcile.complete", {
        transactionId: String(row._id),
        orderRefNum: row.orderRefNum,
        kind: row.kind,
        amount: row.amount,
        status: "paid",
      });

      if (row.kind === "wallet_topup") {
        // A create-paid order whose matchroom could not be finalized keeps the
        // money as MatchHai wallet credit (addFunds already committed in this
        // same transaction). Tell the payer it landed in their wallet rather
        // than the generic "top-up successful" so the policy is honoured.
        const createWasAttempted = Boolean(matchroomCreateArgs);
        const createFinalized = Boolean((sourcePayload as any)?.matchroomCreate?.matchroomId);
        const decision = createWasAttempted && !createFinalized ? "wallet_credit_only" : "paid";
        await notifyPlayerPaymentOutcome(ctx, {
          payment: row,
          decision,
          status: "accepted",
        });
      }
      await notifySuperAdminsPaymentAttentionRequired(ctx, {
        payment: row,
        status: "paid",
        now,
      });

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
        await clearActivePaymentPointerIfMatching(ctx, row, now);

        await notifyPlayerPaymentOutcome(ctx, {
          payment: row,
          decision: "wallet_credit_only",
          status: "accepted",
        });
        await notifySuperAdminsPaymentAttentionRequired(ctx, {
          payment: row,
          status: "paid",
          now,
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
      const adminRoute = `/super-admin/payment/${encodeURIComponent(row.orderRefNum)}`;
      for (const superAdmin of superAdmins) {
        await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
          type: "operations.general",
          toUid: superAdmin._id,
          recipientRole: "super_admin",
          status: "pending",
          dedupeKey: `payment.reconciliation_failure:${String(row._id)}:${String(superAdmin._id)}`,
          dedupePolicy: "replace_active",
          route: adminRoute,
          title: "Payment reconciliation needs attention",
          body: "A payment reconciliation update needs review. Open the payment detail screen for this order.",
          data: {
            paymentTransactionId: String(row._id),
            orderRefNum: row.orderRefNum,
            kind: row.kind,
            href: adminRoute,
          },
        });
      }
      await notifySuperAdminsPaymentAttentionRequired(ctx, {
        payment: row,
        status: "pending",
        now,
      });

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

  const inboundStatus = url.searchParams.get("status") || String(formData?.get?.("status") || "");
  const inboundDesc = url.searchParams.get("desc") || String(formData?.get?.("desc") || "");
  const orderRefNumber =
    url.searchParams.get("orderRefNumber")
    || url.searchParams.get("orderRefNum")
    || String(formData?.get?.("orderRefNumber") || formData?.get?.("orderRefNum") || "")
    || session.transaction.orderRefNum;
  const authToken = url.searchParams.get("auth_token") || String(formData?.get?.("auth_token") || "");
  if (orderRefNumber !== session.transaction.orderRefNum) {
    return new Response("Payment reference mismatch.", { status: 400 });
  }

  // P1 SECURITY: never trust the inbound finalize status/body. A party that knows
  // a still-pending checkout token must not be able to flip the order to "paid"
  // by POSTing status=SUCCESS. The hosted return is only a TRIGGER to verify with
  // the provider: resolve the real payment state through the same server-to-server
  // REST inquiry used by IPN/polling, then apply it via the idempotent
  // applyProviderUpdate("inquiry") path. The inbound status/desc are retained only
  // as diagnostics inside rawPayload and never drive the resolved status.
  let result: any;
  try {
    const inquiryResult: any = await ctx.runAction((internal as any).easypaisaNode.inquireRestTransaction, {
      orderId: session.transaction.orderRefNum,
      storeId: EASYPAISA_STORE_ID,
    });
    const inquiryBody = inquiryResult?.body || {};
    result = await ctx.runMutation((internal as any).easypaisa.applyProviderUpdate, {
      orderRefNum: session.transaction.orderRefNum,
      source: "inquiry",
      snapshot: {
        orderRefNumber: session.transaction.orderRefNum,
        amount: session.transaction.amount,
        responseCode: inquiryBody?.responseCode || inquiryBody?.errorCode || null,
        responseDesc: inquiryBody?.responseDesc || inquiryBody?.errorReason || null,
        transactionStatus: inquiryBody?.transactionStatus || inquiryBody?.status || null,
        transactionId: inquiryBody?.transactionId || inquiryBody?.txnId || null,
        paymentToken: inquiryBody?.paymentToken || null,
        transactionDateTime: inquiryBody?.transactionDateTime || null,
        paymentMode: inquiryBody?.paymentMode || null,
        paymentMethod:
          inquiryBody?.paymentMethod
          || inquiryBody?.paymentMode
          || session.transaction.paymentMethod
          || EASYPAISA_PAYMENT_METHOD
          || null,
        authToken: inquiryBody?.auth_token || inquiryBody?.authToken || authToken || null,
        providerReference:
          inquiryBody?.transactionId
          || inquiryBody?.txnId
          || inquiryBody?.paymentToken
          || session.transaction.orderRefNum,
        rawPayload: {
          rest: {
            inquiry: {
              status: inquiryResult?.status || null,
              response: inquiryBody,
              request: inquiryResult?.requestPayload || null,
            },
          },
          finalize: {
            receivedAt: Date.now(),
            inboundStatus,
            inboundDesc,
            requestUrl: request.url,
            requestMethod: request.method,
          },
          token: token || null,
        },
      },
    });
  } catch (error) {
    // Provider inquiry failed (unreachable / transient). Do NOT credit on the
    // strength of the inbound status. Leave the transaction in its current state
    // and show a pending page; the IPN handler and the stuck-pending reconciler
    // cron will settle it once the provider is reachable.
    logGatewayDebug("finalize.inquiry_failed", {
      token,
      orderRefNumber,
      inboundStatus,
      message: error instanceof Error ? error.message : String(error),
    });
    const appReturnUrl = String(session.transaction.appReturnUrl || "");
    const sep = appReturnUrl.includes("?") ? "&" : "?";
    const pendingReturnUrl = `${appReturnUrl}${sep}gateway=easypaisa&paymentStatus=pending&orderRefNum=${encodeURIComponent(session.transaction.orderRefNum)}`;
    return new Response(
      redirectHtml(
        "Payment pending",
        "Your payment is being reconciled. MatchHai will reflect the final status shortly.",
        pendingReturnUrl,
      ),
      {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      },
    );
  }

  if (!result.ok && result.shouldRetry) {
    return new Response(result.message || "Payment reconciliation is pending retry.", { status: 503 });
  }

  logGatewayDebug("finalize.received", {
    token,
    orderRefNumber,
    inboundStatus,
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
          : "Payment was not completed. Return to MatchHai and refresh this order for the latest status.",
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

    const row: any = await ctx.runQuery((internal as any).easypaisa.getTransactionByOrderRef, {
      orderRefNum: orderRefNumber,
    });
    if (!row) {
      return new Response("Transaction not found.", { status: 404 });
    }

    const inquiryResult: any = await ctx.runAction((internal as any).easypaisaNode.inquireRestTransaction, {
      orderId: row.orderRefNum,
      storeId: EASYPAISA_STORE_ID,
    });
    const inquiryBody = inquiryResult?.body || {};
    const result = await ctx.runMutation((internal as any).easypaisa.applyProviderUpdate, {
      orderRefNum: row.orderRefNum,
      source: "inquiry",
      snapshot: {
        orderRefNumber: row.orderRefNum,
        amount: row.amount,
        responseCode: inquiryBody?.responseCode || inquiryBody?.errorCode || null,
        responseDesc: inquiryBody?.responseDesc || inquiryBody?.errorReason || null,
        transactionStatus: inquiryBody?.transactionStatus || inquiryBody?.status || null,
        transactionId: inquiryBody?.transactionId || inquiryBody?.txnId || null,
        paymentToken: inquiryBody?.paymentToken || null,
        paymentTokenExpiryDateTime: parsedPayload?.paymentTokenExpiryDateTime || null,
        transactionDateTime: inquiryBody?.transactionDateTime || null,
        paymentMode: inquiryBody?.paymentMode || null,
        paymentMethod: inquiryBody?.paymentMethod || inquiryBody?.paymentMode || null,
        authToken: inquiryBody?.auth_token || inquiryBody?.authToken || null,
        providerReference: inquiryBody?.transactionId || inquiryBody?.txnId || inquiryBody?.paymentToken || row.orderRefNum,
        rawPayload: {
          rest: {
            inquiry: {
              status: inquiryResult?.status || null,
              response: inquiryBody,
              request: inquiryResult?.requestPayload || null,
            },
          },
          ipn: {
            receivedAt: Date.now(),
            source: ipnUrl ? "provider_url" : "direct",
          },
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
