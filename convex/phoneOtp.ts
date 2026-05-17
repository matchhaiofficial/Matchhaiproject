import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const SEND_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const VERIFY_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_SENDS_PER_HOUR = 3;
const MAX_VERIFY_ATTEMPTS_PER_DAY = 5;
const DEFAULT_VEEVOTECH_SMS_URL = "https://api.veevotech.com/v3/sendsms";
const SMS_SEND_FAILURE_MESSAGE = "Could not send OTP. Please check your number and try again.";
const SMS_PROVIDER_FAILURE_MESSAGE = "SMS service is temporarily unavailable. Please try again later.";

type NormalizedPhone = {
  phoneE164: string;
  phoneDigits: string;
  phoneMasked: string;
};

type PhoneOtpFailure = { ok: false; message: string };

function phoneOtpFailure(message: string): PhoneOtpFailure {
  return { ok: false, message };
}

function normalizePakistaniPhone(value: string): NormalizedPhone {
  const raw = String(value || "").trim();
  const numeric = raw.replace(/\D/g, "");
  let digits = "";

  if (!numeric) {
    digits = "";
  } else if (raw.startsWith("+")) {
    digits = numeric.startsWith("92") ? numeric.slice(2) : "";
  } else if (numeric.startsWith("0092")) {
    digits = numeric.slice(4);
  } else if (numeric.startsWith("92")) {
    digits = numeric.slice(2);
  } else if (numeric.startsWith("0")) {
    digits = numeric.slice(1);
  } else if (numeric.length === 10) {
    digits = numeric;
  } else {
    digits = "";
  }

  if (digits.length > 10) digits = digits.slice(-10);
  if (!/^3\d{9}$/.test(digits)) {
    throw new Error("Please enter a valid Pakistani mobile number.");
  }

  const phoneE164 = `+92${digits}`;
  return {
    phoneE164,
    phoneDigits: digits,
    phoneMasked: maskPhone(phoneE164),
  };
}

function maskPhone(phoneE164: string) {
  const digits = phoneE164.replace(/\D/g, "");
  if (digits.length < 6) return "****";
  return `+${digits.slice(0, 2)}******${digits.slice(-4)}`;
}

async function sha256(value: string) {
  const input = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function generateOtp() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1_000_000).padStart(6, "0");
}

function extractProviderMessageId(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const direct = getProviderValue(record, [
    "messageId",
    "message_id",
    "MESSAGE_ID",
    "id",
    "smsId",
    "sms_id",
  ]);
  return typeof direct === "string" || typeof direct === "number"
    ? String(direct)
    : undefined;
}

function normalizeProviderKey(value: string) {
  return value.toLowerCase().replace(/[_\s-]/g, "");
}

function getProviderValue(record: Record<string, unknown>, keys: string[]) {
  const wanted = new Set(keys.map(normalizeProviderKey));
  for (const [key, value] of Object.entries(record)) {
    if (wanted.has(normalizeProviderKey(key))) return value;
  }
  return undefined;
}

function getProviderString(record: Record<string, unknown>, keys: string[]) {
  const value = getProviderValue(record, keys);
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function getProviderBoolean(record: Record<string, unknown>, keys: string[]) {
  const value = getProviderValue(record, keys);
  return typeof value === "boolean" ? value : null;
}

function isProviderFailureResponse(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const successFlag = getProviderBoolean(record, ["success", "ok"]);
  if (successFlag === false) return true;

  const errorCode = getProviderString(record, ["ERROR_CODE", "errorCode", "error_code"]);
  const errorFilter = getProviderString(record, ["ERROR_FILTER", "errorFilter", "error_filter"]);
  if (errorCode || errorFilter) return true;

  const status = getProviderString(record, ["STATUS", "status"]).toLowerCase();
  return ["failed", "failure", "error", "invalid", "rejected", "unsuccessful"].includes(status);
}

function getProviderFailureCategory(value: unknown) {
  if (!value || typeof value !== "object") return "provider_ambiguous_success";
  const record = value as Record<string, unknown>;
  const errorFilter = getProviderString(record, ["ERROR_FILTER", "errorFilter", "error_filter"]);
  if (errorFilter) return `provider_error_${errorFilter.toLowerCase()}`;

  const errorCode = getProviderString(record, ["ERROR_CODE", "errorCode", "error_code"]);
  if (errorCode) return "provider_error";

  const status = getProviderString(record, ["STATUS", "status"]).toLowerCase();
  if (status === "error") return "provider_error";

  return "provider_ambiguous_success";
}

function isProviderSuccessResponse(value: unknown) {
  if (!value || typeof value !== "object" || isProviderFailureResponse(value)) return false;
  const record = value as Record<string, unknown>;
  const successFlag = getProviderBoolean(record, ["success", "ok"]);
  if (successFlag === true) return true;

  const status = getProviderString(record, ["STATUS", "status"]).toLowerCase();
  if (["successful", "success", "sent", "queued", "accepted", "submitted"].includes(status)) {
    return true;
  }

  return Boolean(extractProviderMessageId(record));
}

function parseProviderBody(bodyText: string) {
  if (!bodyText.trim()) return null;
  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}

function redactProviderBody(value: unknown): unknown {
  if (typeof value === "string") return value.slice(0, 1000);
  if (!value || typeof value !== "object") return value;

  const redacted: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = normalizeProviderKey(key);
    if (
      normalizedKey.includes("hash") ||
      normalizedKey.includes("key") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("password")
    ) {
      redacted[key] = "[redacted]";
    } else {
      redacted[key] = fieldValue;
    }
  }
  return redacted;
}

function getSmsUrlDebugInfo(smsUrl: string) {
  try {
    const parsed = new URL(smsUrl);
    return {
      host: parsed.host,
      path: parsed.pathname,
    };
  } catch {
    return {
      host: "invalid-url",
      path: "",
    };
  }
}

function logSmsFailure(
  category: string,
  details: {
    phoneMasked: string;
    smsUrl: string;
    hasApiHash: boolean;
    hasSenderId: boolean;
    status?: number;
    statusText?: string;
    providerBody?: unknown;
    errorMessage?: string;
  },
) {
  const smsUrlDebug = getSmsUrlDebugInfo(details.smsUrl);

  console.warn("[phoneOtp] VeevoTech send debug", {
    phoneMasked: details.phoneMasked,
    smsEndpointHost: smsUrlDebug.host,
    smsEndpointPath: smsUrlDebug.path,
    hasApiHash: details.hasApiHash,
    hasSenderId: details.hasSenderId,
    status: details.status,
    statusText: details.statusText,
    category,
    providerBody: redactProviderBody(details.providerBody),
    errorMessage: details.errorMessage,
    timestamp: Date.now(),
  });
}

export const sendPhoneOtp = action({
  args: { phone: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<
    | PhoneOtpFailure
    | {
        ok: true;
        phoneE164: string;
        phoneMasked: string;
        cooldownSeconds: number;
      }
  > => {
    const apiHash = process.env.VEEVOTECH_API_HASH;
    const senderId = process.env.VEEVOTECH_SENDER_ID;
    const smsUrl = process.env.VEEVOTECH_SMS_URL || DEFAULT_VEEVOTECH_SMS_URL;

    if (!apiHash || !senderId) {
      logSmsFailure("missing_config", {
        phoneMasked: "unavailable",
        smsUrl,
        hasApiHash: Boolean(apiHash),
        hasSenderId: Boolean(senderId),
      });
      return phoneOtpFailure("SMS verification is not configured.");
    }

    let normalizedPhone: NormalizedPhone;
    try {
      normalizedPhone = normalizePakistaniPhone(args.phone);
    } catch {
      return phoneOtpFailure("Please enter a valid Pakistani mobile number.");
    }

    const { phoneE164, phoneMasked } = normalizedPhone;
    const phoneHash = await sha256(phoneE164);
    const now = Date.now();

    const available: boolean = await ctx.runQuery(api.users.isPhoneAvailable, {
      phone: phoneE164,
    });
    if (!available) {
      return phoneOtpFailure("This phone number is already registered.");
    }

    const sendState: {
      sendsInWindow: number;
      lastCreatedAt: number | null;
    } = await ctx.runQuery(internal.phoneOtp.getSendState, {
      phoneHash,
      since: now - SEND_LIMIT_WINDOW_MS,
    });

    if (sendState.lastCreatedAt && now - sendState.lastCreatedAt < RESEND_COOLDOWN_MS) {
      const remaining = Math.ceil((RESEND_COOLDOWN_MS - (now - sendState.lastCreatedAt)) / 1000);
      return phoneOtpFailure(`Please wait ${remaining}s before requesting another code.`);
    }

    if (sendState.sendsInWindow >= MAX_SENDS_PER_HOUR) {
      return phoneOtpFailure("Too many OTP requests. Please try again later.");
    }

    const otp = generateOtp();
    const otpHash = await sha256(`${phoneHash}:${otp}`);
    const verificationId: Id<"phoneVerifications"> = await ctx.runMutation(
      internal.phoneOtp.createSession,
      {
        phoneHash,
        phoneMasked,
        otpHash,
        resendCount: sendState.sendsInWindow + 1,
        expiresAt: now + OTP_EXPIRY_MS,
        createdAt: now,
      },
    );

    try {
      const response = await fetch(smsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          apikey: apiHash,
          hash: apiHash,
          receivernum: phoneE164,
          sendernum: senderId,
          textmessage: `Your Matchhai verification code is ${otp}. It expires in 5 minutes. Do not share this code.`,
        }),
      });

      let providerMessageId: string | undefined;
      const providerBody = parseProviderBody(await response.text());
      if (response.ok && isProviderSuccessResponse(providerBody)) {
        providerMessageId = extractProviderMessageId(providerBody);
        await ctx.runMutation(internal.phoneOtp.markProviderSent, {
          verificationId,
          providerMessageId,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.runMutation(internal.phoneOtp.markFailed, {
          verificationId,
          updatedAt: Date.now(),
        });
        const failureCategory = response.ok
          ? getProviderFailureCategory(providerBody)
          : "provider_non_ok";
        logSmsFailure(failureCategory, {
          phoneMasked,
          smsUrl,
          hasApiHash: Boolean(apiHash),
          hasSenderId: Boolean(senderId),
          status: response.status,
          statusText: response.statusText,
          providerBody,
        });
        return phoneOtpFailure(response.ok ? SMS_PROVIDER_FAILURE_MESSAGE : SMS_SEND_FAILURE_MESSAGE);
      }
    } catch (error) {
      await ctx.runMutation(internal.phoneOtp.markFailed, {
        verificationId,
        updatedAt: Date.now(),
      });
      logSmsFailure("network_or_runtime", {
        phoneMasked,
        smsUrl,
        hasApiHash: Boolean(apiHash),
        hasSenderId: Boolean(senderId),
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return phoneOtpFailure(SMS_SEND_FAILURE_MESSAGE);
    }

    return {
      ok: true,
      phoneE164,
      phoneMasked,
      cooldownSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
    };
  },
});

export const verifyPhoneOtp = action({
  args: { phone: v.string(), otp: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<
    | PhoneOtpFailure
    | {
        ok: true;
        phoneE164: string;
        phoneMasked: string;
        phoneHash: string;
        verifiedAt: number;
      }
  > => {
    let normalizedPhone: NormalizedPhone;
    try {
      normalizedPhone = normalizePakistaniPhone(args.phone);
    } catch {
      return phoneOtpFailure("Please enter a valid Pakistani mobile number.");
    }

    const { phoneE164, phoneMasked } = normalizedPhone;
    const otp = String(args.otp || "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(otp)) {
      return phoneOtpFailure("Enter the 6-digit verification code.");
    }

    const phoneHash = await sha256(phoneE164);
    const now = Date.now();
    const attemptState: { attemptsInWindow: number } = await ctx.runQuery(
      internal.phoneOtp.getVerifyAttemptState,
      {
        phoneHash,
        since: now - VERIFY_LIMIT_WINDOW_MS,
      },
    );
    if (attemptState.attemptsInWindow >= MAX_VERIFY_ATTEMPTS_PER_DAY) {
      return phoneOtpFailure("Too many attempts. Please try again later.");
    }

    const session: {
      _id: Id<"phoneVerifications">;
      otpHash: string;
      expiresAt: number;
      attempts: number;
    } | null = await ctx.runQuery(internal.phoneOtp.getLatestPending, { phoneHash });

    if (!session) {
      return phoneOtpFailure("Verification code expired. Please request a new code.");
    }

    if (session.expiresAt <= now) {
      await ctx.runMutation(internal.phoneOtp.markExpired, {
        verificationId: session._id,
        updatedAt: now,
      });
      return phoneOtpFailure("Verification code expired. Please request a new code.");
    }

    const enteredHash = await sha256(`${phoneHash}:${otp}`);
    if (enteredHash !== session.otpHash) {
      await ctx.runMutation(internal.phoneOtp.incrementAttempts, {
        verificationId: session._id,
        updatedAt: now,
      });
      return phoneOtpFailure("Incorrect verification code.");
    }

    await ctx.runMutation(internal.phoneOtp.markVerified, {
      verificationId: session._id,
      updatedAt: now,
    });

    return {
      ok: true,
      phoneE164,
      phoneMasked,
      phoneHash,
      verifiedAt: now,
    };
  },
});

export const getSendState = internalQuery({
  args: { phoneHash: v.string(), since: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("phoneVerifications")
      .withIndex("by_phoneHash_and_createdAt", (q) =>
        q.eq("phoneHash", args.phoneHash).gte("createdAt", args.since),
      )
      .order("desc")
      .take(10);

    return {
      sendsInWindow: rows.length,
      lastCreatedAt: rows.find((row) => row.status !== "failed")?.createdAt ?? null,
    };
  },
});

export const getVerifyAttemptState = internalQuery({
  args: { phoneHash: v.string(), since: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("phoneVerifications")
      .withIndex("by_phoneHash_and_createdAt", (q) =>
        q.eq("phoneHash", args.phoneHash).gte("createdAt", args.since),
      )
      .order("desc")
      .take(50);

    return {
      attemptsInWindow: rows.reduce((total, row) => total + Number(row.attempts || 0), 0),
    };
  },
});

export const getLatestPending = internalQuery({
  args: { phoneHash: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("phoneVerifications")
      .withIndex("by_phoneHash_and_status_and_updatedAt", (q) =>
        q.eq("phoneHash", args.phoneHash).eq("status", "pending"),
      )
      .order("desc")
      .take(1);
    return rows[0] ?? null;
  },
});

export const getRecentVerified = internalQuery({
  args: { phoneHash: v.string(), since: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("phoneVerifications")
      .withIndex("by_phoneHash_and_status_and_updatedAt", (q) =>
        q.eq("phoneHash", args.phoneHash).eq("status", "verified"),
      )
      .order("desc")
      .take(10);

    return rows.find((row) => row.updatedAt >= args.since) ?? null;
  },
});

export const createSession = internalMutation({
  args: {
    phoneHash: v.string(),
    phoneMasked: v.string(),
    otpHash: v.string(),
    resendCount: v.number(),
    expiresAt: v.number(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("phoneVerifications", {
      phoneHash: args.phoneHash,
      phoneMasked: args.phoneMasked,
      otpHash: args.otpHash,
      status: "pending",
      attempts: 0,
      resendCount: args.resendCount,
      provider: "veevotech",
      expiresAt: args.expiresAt,
      createdAt: args.createdAt,
      updatedAt: args.createdAt,
    });
  },
});

export const markProviderSent = internalMutation({
  args: {
    verificationId: v.id("phoneVerifications"),
    providerMessageId: v.optional(v.string()),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.verificationId, {
      ...(args.providerMessageId ? { providerMessageId: args.providerMessageId } : {}),
      updatedAt: args.updatedAt,
    });
  },
});

export const markFailed = internalMutation({
  args: { verificationId: v.id("phoneVerifications"), updatedAt: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.verificationId, {
      status: "failed",
      updatedAt: args.updatedAt,
    });
  },
});

export const markExpired = internalMutation({
  args: { verificationId: v.id("phoneVerifications"), updatedAt: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.verificationId, {
      status: "expired",
      updatedAt: args.updatedAt,
    });
  },
});

export const incrementAttempts = internalMutation({
  args: { verificationId: v.id("phoneVerifications"), updatedAt: v.number() },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.verificationId);
    if (!row) return;
    await ctx.db.patch(args.verificationId, {
      attempts: Number(row.attempts || 0) + 1,
      updatedAt: args.updatedAt,
    });
  },
});

export const markVerified = internalMutation({
  args: { verificationId: v.id("phoneVerifications"), updatedAt: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.verificationId, {
      status: "verified",
      updatedAt: args.updatedAt,
    });
  },
});
