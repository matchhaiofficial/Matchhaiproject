"use node";

import { createCipheriv } from "node:crypto";
import { v } from "convex/values";

import { internalAction } from "./_generated/server";
import {
  buildCredentialsHeader,
  getEasypaisaRestBaseUrl,
  sanitizeRestPayload,
} from "./easypaisaRest";

function buildCanonicalRequest(fields: { key: string; value: string }[]) {
  return [...fields]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ key, value }) => `${key}=${value}`)
    .join("&");
}

export const buildMerchantHashedReq = internalAction({
  args: {
    fields: v.array(
      v.object({
        key: v.string(),
        value: v.string(),
      }),
    ),
    hashKey: v.string(),
  },
  handler: async (_ctx, args) => {
    const normalizedKey = String(args.hashKey || "");
    const keyBytes = Buffer.from(normalizedKey, "utf8");
    if (![16, 24, 32].includes(keyBytes.length)) {
      throw new Error("Easypaisa hash key must be 16, 24, or 32 bytes.");
    }

    const canonicalValue = buildCanonicalRequest(args.fields);
    const cipher = createCipheriv(`aes-${keyBytes.length * 8}-ecb`, keyBytes, null);
    cipher.setAutoPadding(true);

    const encryptedValue = Buffer.concat([
      cipher.update(canonicalValue, "utf8"),
      cipher.final(),
    ]).toString("base64");

    return {
      merchantHashedReq: encryptedValue,
      canonicalValue,
    };
  },
});

const EASYPAISA_ENV = String(process.env.EASYPAISA_ENV || "staging").trim().toLowerCase();
const EASYPAISA_REST_BASE_URL = String(process.env.EASYPAISA_REST_BASE_URL || "").trim();
const EASYPAISA_API_USERNAME = String(process.env.EASYPAISA_API_USERNAME || "").trim();
const EASYPAISA_API_PASSWORD = String(process.env.EASYPAISA_API_PASSWORD || "").trim();
const EASYPAISA_ACCOUNT_NUM = String(process.env.EASYPAISA_ACCOUNT_NUM || "").trim();
const EASYPAISA_REQUEST_TIMEOUT_MS = Number(process.env.EASYPAISA_REQUEST_TIMEOUT_MS || 25_000);

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTransportError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const lower = rawMessage.toLowerCase();
  const timedOut =
    lower.includes("aborted due to timeout")
    || lower.includes("timeout")
    || lower.includes("signal timed out");

  return {
    message: timedOut
      ? "Easypaisa is taking too long to respond. Please try again."
      : rawMessage,
    isTimeout: timedOut,
  };
}

function ensureRestConfig(requireAccountNum = false) {
  if (!EASYPAISA_API_USERNAME || !EASYPAISA_API_PASSWORD) {
    throw new Error("Easypaisa REST credentials are not configured.");
  }
  if (requireAccountNum && !EASYPAISA_ACCOUNT_NUM) {
    throw new Error("Easypaisa account number is not configured.");
  }
}

async function postJson(
  endpointPath: string,
  body: Record<string, unknown>,
  options?: { retries?: number; retryDelayMs?: number },
) {
  const retries = Math.max(0, options?.retries ?? 0);
  const retryDelayMs = Math.max(0, options?.retryDelayMs ?? 1200);

  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(`${getEasypaisaRestBaseUrl(EASYPAISA_ENV, EASYPAISA_REST_BASE_URL)}${endpointPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
          Credentials: buildCredentialsHeader(EASYPAISA_API_USERNAME, EASYPAISA_API_PASSWORD),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(EASYPAISA_REQUEST_TIMEOUT_MS),
      });

      const rawText = await response.text();
      let parsedBody: any = null;
      try {
        parsedBody = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsedBody = { rawText };
      }

      return {
        ok: response.ok,
        status: response.status,
        body: parsedBody,
        rawText,
        attempt: attempt + 1,
      };
    } catch (error) {
      const normalized = normalizeTransportError(error);
      if (!normalized.isTimeout || attempt >= retries) {
        throw new Error(normalized.message);
      }
      attempt += 1;
      await wait(retryDelayMs);
    }
  }
}

export const initiateRestTransaction = internalAction({
  args: {
    endpointPath: v.string(),
    payload: v.any(),
  },
  handler: async (_ctx, args) => {
    ensureRestConfig(false);
    const response = await postJson(args.endpointPath, args.payload || {}, {
      retries: 0,
    });
    return {
      ...response,
      requestPayload: sanitizeRestPayload(args.payload || {}),
    };
  },
});

export const inquireRestTransaction = internalAction({
  args: {
    orderId: v.string(),
    storeId: v.string(),
  },
  handler: async (_ctx, args) => {
    ensureRestConfig(true);
    const payload = {
      orderId: args.orderId,
      storeId: args.storeId,
      accountNum: EASYPAISA_ACCOUNT_NUM,
    };
    const response = await postJson("/inquire-transaction", payload);
    return {
      ...response,
      requestPayload: sanitizeRestPayload(payload),
    };
  },
});
