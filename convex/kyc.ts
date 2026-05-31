import { v } from "convex/values";
import { httpAction, action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, components, internal } from "./_generated/api";
import { authComponent } from "./auth";
import { Id } from "./_generated/dataModel";
import { notifyKycStatusUpdated, notifySuperAdminsKycReviewNeeded } from "./kycNotifications";

const DEFAULT_DIDIT_BASE_URL = "https://verification.didit.me";

const kycStatusValidator = v.union(
  v.literal("not_started"),
  v.literal("pending"),
  v.literal("in_progress"),
  v.literal("in_review"),
  v.literal("verified"),
  v.literal("rejected"),
  v.literal("expired"),
);

const kycRoleValidator = v.union(
  v.literal("player"),
  v.literal("zone_owner"),
  v.literal("venue_admin"),
  v.literal("high_risk_dispute"),
  v.literal("tournament_organizer"),
);

type KycStatus = "not_started" | "pending" | "in_progress" | "in_review" | "verified" | "rejected" | "expired";
type KycRole = "player" | "zone_owner" | "venue_admin" | "high_risk_dispute" | "tournament_organizer";

const ACCOUNT_EMAIL_REQUIRED_MESSAGE =
  "Your account email is missing or invalid. Please update your account email before starting verification.";

async function getAuthIdFromContextOrSessionToken(ctx: any, sessionToken?: string | null) {
  try {
    const authUser = await authComponent.getAuthUser(ctx);
    if (authUser?.userId) return authUser.userId;
  } catch {
    // Fall back to Better Auth session token below.
  }

  const token = String(sessionToken || "").trim();
  if (!token) return null;

  const session = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "session",
    where: [{ field: "token", operator: "eq", value: token }],
  });

  if (!session?.userId || session.expiresAt <= Date.now()) {
    return null;
  }

  return String(session.userId);
}

function normalizeAccountEmail(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function isValidAccountEmail(value?: string | null) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeAccountEmail(value));
}

function requireAccountEmail(profile?: any) {
  const email = normalizeAccountEmail(profile?.email);
  if (!isValidAccountEmail(email)) {
    throw new Error(ACCOUNT_EMAIL_REQUIRED_MESSAGE);
  }
  return email;
}

async function getBetterAuthEmail(ctx: any, authId?: string | null, fallbackEmail?: string | null) {
  const fallback = normalizeAccountEmail(fallbackEmail);
  if (fallback) return fallback;
  const id = String(authId || "").trim();
  if (!id) return "";
  const authUser = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "_id", operator: "eq", value: id }],
  });
  return normalizeAccountEmail(authUser?.email);
}

async function logAuthEmailMismatch(ctx: any, input: {
  userId: Id<"users">;
  verificationId?: Id<"identityVerifications">;
  role: KycRole;
  authEmail?: string | null;
  accountEmail: string;
  timestamp: number;
}) {
  const authEmail = normalizeAccountEmail(input.authEmail);
  const accountEmail = normalizeAccountEmail(input.accountEmail);
  if (!authEmail || authEmail === accountEmail) return;
  const [authEmailHash, accountEmailHash] = await Promise.all([
    sha256Hex(authEmail),
    sha256Hex(accountEmail),
  ]);

  await ctx.runMutation(internal.kyc.recordKycAuditEvent, {
    userId: input.userId,
    verificationId: input.verificationId,
    provider: "didit",
    role: input.role,
    action: "auth_email_mismatch",
    timestamp: input.timestamp,
    details: {
      authEmailHash,
      accountEmailHash,
      emailUsedForKycHash: accountEmailHash,
      emailsMatch: false,
      sourceOfTruth: "users.email",
    },
  });
}

function getDiditConfig() {
  const apiKey = String(process.env.DIDIT_API_KEY || "").trim();
  const workflowId = String(process.env.DIDIT_KYC_WORKFLOW_ID || process.env.DIDIT_WORKFLOW_ID || "").trim();
  const baseUrl = String(process.env.DIDIT_BASE_URL || DEFAULT_DIDIT_BASE_URL).replace(/\/+$/, "");
  const webhookUrl = String(process.env.DIDIT_WEBHOOK_URL || "").trim();
  const appScheme = String(process.env.EXPO_PUBLIC_APP_SCHEME || "matchhai").trim() || "matchhai";
  const configuredCallbackUrl = String(
    process.env.DIDIT_CALLBACK_URL ||
    process.env.DIDIT_APP_CALLBACK_URL ||
    `${appScheme}://`
  ).trim();
  const callbackUrl = configuredCallbackUrl.includes("/auth/verification-required")
    ? `${appScheme}://`
    : configuredCallbackUrl;

  if (!apiKey) throw new Error("Didit KYC is not configured.");
  if (!workflowId) throw new Error("Didit KYC workflow is not configured.");
  if (!webhookUrl) throw new Error("Didit webhook URL is not configured.");
  if (!callbackUrl) throw new Error("Didit callback URL is not configured.");

  return { apiKey, workflowId, baseUrl, webhookUrl, callbackUrl };
}

function splitFullName(value?: string | null) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: undefined, lastName: undefined };
  if (parts.length === 1) return { firstName: parts[0], lastName: undefined };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function buildDiditSessionBody(config: ReturnType<typeof getDiditConfig>, verificationId: Id<"identityVerifications">, profile?: any) {
  const { firstName, lastName } = splitFullName(profile?.fullName || profile?.ownerFullName);
  const contactDetails: Record<string, string> = {};
  const expectedDetails: Record<string, string> = {};
  contactDetails.email = requireAccountEmail(profile);
  if (profile?.phone) contactDetails.phone_number = String(profile.phone).trim();
  if (firstName) expectedDetails.first_name = firstName;
  if (lastName) expectedDetails.last_name = lastName;

  return {
    workflow_id: config.workflowId,
    vendor_data: String(verificationId),
    callback: config.callbackUrl,
    ...(Object.keys(contactDetails).length > 0 ? { contact_details: contactDetails } : {}),
    ...(Object.keys(expectedDetails).length > 0 ? { expected_details: expectedDetails } : {}),
  };
}

function getWebhookSecret() {
  const secret = String(process.env.DIDIT_WEBHOOK_SECRET || "").trim();
  if (!secret) throw new Error("Didit webhook secret is not configured.");
  return secret;
}

function normalizeDiditStatus(value: unknown): KycStatus {
  const key = String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (key === "approved" || key === "verified") return "verified";
  if (key === "declined" || key === "rejected") return "rejected";
  if (key === "in review") return "in_review";
  if (key === "not started") return "not_started";
  if (key === "expired" || key === "abandoned" || key === "kyc expired") return "expired";
  if (key === "pending") return "pending";
  return "in_progress";
}

function toSessionCreatedStatus(_status: KycStatus): "in_progress" {
  return "in_progress";
}

function extractString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function extractSessionId(payload: any) {
  return extractString(
    payload?.session_id,
    payload?.sessionId,
    payload?.session?.id,
    payload?.session?.session_id,
    payload?.id,
  );
}

function extractVendorData(payload: any) {
  return extractString(
    payload?.vendor_data,
    payload?.vendorData,
    payload?.session?.vendor_data,
    payload?.session?.vendorData,
  );
}

function extractStatus(payload: any) {
  return extractString(payload?.status, payload?.session?.status, payload?.verification?.status);
}

function extractWorkflowId(payload: any) {
  return extractString(payload?.workflow_id, payload?.workflowId, payload?.session?.workflow_id, payload?.session?.workflowId);
}

function extractVerificationUrl(payload: any) {
  return extractString(
    payload?.url,
    payload?.verification_url,
    payload?.verificationUrl,
    payload?.session_url,
    payload?.sessionUrl,
    payload?.session?.url,
    payload?.session?.verification_url,
  );
}

function extractSafeReason(payload: any) {
  const decision = payload?.decision || payload?.session?.decision || {};
  const warningReason = extractFirstWarningReason(
    decision?.face_matches,
    decision?.faceMatches,
    decision?.id_verifications,
    decision?.idVerifications,
    decision?.liveness_checks,
    decision?.livenessChecks,
    decision?.aml_screenings,
    decision?.amlScreenings,
    decision?.ip_analyses,
    decision?.ipAnalyses,
    decision?.email_verifications,
    decision?.emailVerifications,
  );

  return extractString(
    payload?.rejection_reason,
    payload?.rejectionReason,
    payload?.decision?.reason,
    payload?.decision?.category,
    warningReason,
    payload?.session?.rejection_reason,
  )?.slice(0, 240);
}

function extractDecision(payload: any) {
  return extractString(
    payload?.result,
    payload?.decision?.status,
    payload?.session?.result,
    payload?.session?.decision?.status,
    payload?.status,
  )?.slice(0, 120);
}

function normalizeCheckStatus(value: unknown) {
  return extractString(value)?.slice(0, 80);
}

function firstArrayEntry(...values: unknown[]) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) return value[0] as any;
    if (value && typeof value === "object" && !Array.isArray(value)) return value as any;
  }
  return undefined;
}

function extractFirstWarningReason(...values: unknown[]) {
  for (const value of values) {
    const entry = firstArrayEntry(value);
    const warning = firstArrayEntry(entry?.warnings);
    const reason = extractString(warning?.risk, warning?.short_description, warning?.category, warning?.feature);
    if (reason) return reason;
  }
  return undefined;
}

function extractSafeCheckStatuses(payload: any) {
  const checks = payload?.checks || payload?.session?.checks || payload?.verification?.checks || {};
  const decision = payload?.decision || payload?.session?.decision || {};
  const email = checks?.email || checks?.email_verification || checks?.emailVerification || {};
  const id = checks?.id || checks?.id_verification || checks?.idVerification || {};
  const liveness = checks?.liveness || {};
  const face = checks?.face_match || checks?.faceMatch || {};
  const aml = checks?.aml || checks?.aml_screening || checks?.amlScreening || {};
  const ip = checks?.ip_analysis || checks?.ipAnalysis || {};
  const diditEmail = firstArrayEntry(decision?.email_verifications, decision?.emailVerifications);
  const diditId = firstArrayEntry(decision?.id_verifications, decision?.idVerifications);
  const diditLiveness = firstArrayEntry(decision?.liveness_checks, decision?.livenessChecks);
  const diditFace = firstArrayEntry(decision?.face_matches, decision?.faceMatches);
  const diditAml = firstArrayEntry(decision?.aml_screenings, decision?.amlScreenings);
  const diditIp = firstArrayEntry(decision?.ip_analyses, decision?.ipAnalyses);

  return {
    emailVerificationStatus: normalizeCheckStatus(email?.status || diditEmail?.status || payload?.email_verification_status),
    idVerificationStatus: normalizeCheckStatus(id?.status || diditId?.status || payload?.id_verification_status),
    livenessStatus: normalizeCheckStatus(liveness?.status || diditLiveness?.status || payload?.liveness_status),
    faceMatchStatus: normalizeCheckStatus(face?.status || diditFace?.status || payload?.face_match_status),
    amlStatus: normalizeCheckStatus(aml?.status || diditAml?.status || payload?.aml_status),
    ipAnalysisStatus: normalizeCheckStatus(ip?.status || diditIp?.status || payload?.ip_analysis_status),
  };
}

function isTerminal(status: KycStatus) {
  return status === "verified" || status === "rejected" || status === "expired";
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

function createStartToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(signature));
}

function timingSafeEqualHex(left: string, right: string) {
  const a = String(left || "").toLowerCase();
  const b = String(right || "").toLowerCase();
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function parseSignatureHeader(value: string | null) {
  const entries: Record<string, string> = {};
  const rawValue = String(value || "").trim();
  if (rawValue && /^[a-f0-9]{64}$/i.test(rawValue)) {
    entries.value = rawValue;
  }
  rawValue.split(",").forEach((part) => {
    const [key, ...rest] = part.trim().split("=");
    if (key && rest.length) entries[key] = rest.join("=");
  });
  return entries;
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record).sort().reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = canonicalizeJson(record[key]);
      return acc;
    }, {});
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toString());
  }
  return value;
}

async function verifyDiditSignature(request: Request, rawBody: string, payload: any) {
  const secret = getWebhookSecret();
  const v2 = parseSignatureHeader(request.headers.get("x-signature-v2"));
  const simple = parseSignatureHeader(request.headers.get("x-signature-simple"));
  const legacy = parseSignatureHeader(request.headers.get("x-signature"));
  const timestamp = extractString(
    v2.t,
    simple.t,
    legacy.t,
    request.headers.get("x-timestamp"),
    payload?.timestamp,
  );

  let canonicalJson = rawBody;
  try {
    canonicalJson = JSON.stringify(canonicalizeJson(JSON.parse(rawBody)));
  } catch {
    canonicalJson = rawBody;
  }

  const signedBodyMessages = [
    rawBody,
    canonicalJson,
    timestamp ? `${timestamp}.${rawBody}` : undefined,
    timestamp ? `${timestamp}.${canonicalJson}` : undefined,
    timestamp ? `${timestamp}:${rawBody}` : undefined,
    timestamp ? `${timestamp}:${canonicalJson}` : undefined,
    timestamp ? `${timestamp}${rawBody}` : undefined,
    timestamp ? `${timestamp}${canonicalJson}` : undefined,
  ].filter((value): value is string => Boolean(value));

  const bodySignatures = [v2.v2, v2.value, legacy.v1, legacy.v2, legacy.value].filter(
    (value): value is string => Boolean(value),
  );
  for (const signature of bodySignatures) {
    for (const message of signedBodyMessages) {
      const expected = await hmacSha256Hex(secret, message);
      if (timingSafeEqualHex(expected, signature)) return true;
    }
  }

  const sessionId = extractSessionId(payload) || "";
  const status = extractStatus(payload) || "";
  const webhookType = extractString(payload?.webhook_type, payload?.webhookType, payload?.event) || "";
  const simpleMessages = [
    timestamp ? `${timestamp}:${sessionId}:${status}:${webhookType}` : undefined,
    timestamp ? `${timestamp}.${sessionId}.${status}.${webhookType}` : undefined,
    `${sessionId}:${status}:${webhookType}`,
  ].filter((value): value is string => Boolean(value));
  const simpleSignatures = [simple.simple, simple.value].filter((value): value is string => Boolean(value));
  for (const signature of simpleSignatures) {
    for (const message of simpleMessages) {
      const expected = await hmacSha256Hex(secret, message);
      if (timingSafeEqualHex(expected, signature)) return true;
    }
  }

  return false;
}

export const getCurrentUserKyc = query({
  args: {},
  handler: async (ctx) => {
    // Prefer Better Auth session; fall back to Convex JWT identity (mirrors wallet.ts pattern).
    const candidateAuthIds: string[] = [];

    try {
      const authUser = await authComponent.getAuthUser(ctx);
      if (authUser?.userId) candidateAuthIds.push(authUser.userId);
    } catch {}

    if (candidateAuthIds.length === 0) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) return null;
      for (const raw of [identity.subject, identity.tokenIdentifier]) {
        if (!raw) continue;
        candidateAuthIds.push(raw);
        if (raw.includes("|")) {
          const suffix = raw.split("|").pop();
          if (suffix) candidateAuthIds.push(suffix);
        }
      }
    }

    if (candidateAuthIds.length === 0) return null;

    let profile: any = null;
    for (const authId of candidateAuthIds) {
      profile = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", authId))
        .unique();
      if (profile) break;
    }

    if (!profile?.identityVerificationId) return null;
    try {
      return await ctx.db.get(profile.identityVerificationId as Id<"identityVerifications">);
    } catch {
      return null;
    }
  },
});

export const startDiditKycSession = action({
  args: { role: kycRoleValidator },
  handler: async (ctx, args): Promise<{ verificationUrl: string; verificationId: Id<"identityVerifications">; status: KycStatus }> => {
    if (args.role === "high_risk_dispute" || args.role === "tournament_organizer") {
      throw new Error("This verification role is not available yet.");
    }

    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser?.userId) throw new Error("Please sign in to continue.");

    const profile: any = await ctx.runQuery(api.users.getByAuthId, { authId: authUser.userId });
    if (!profile?._id) throw new Error("User profile not found.");
    if (args.role === "player" && profile.accountType !== "player") {
      throw new Error("Player verification is only available for player accounts.");
    }
    if ((args.role === "zone_owner" || args.role === "venue_admin") && profile.accountType !== "zone") {
      throw new Error("Zone verification is only available for zone admin accounts.");
    }
    const accountEmail = requireAccountEmail(profile);

    const config = getDiditConfig();
    const verificationId: Id<"identityVerifications"> = await ctx.runMutation(internal.kyc.createOrReuseKycVerification, {
      userId: profile._id,
      role: args.role,
      workflowId: config.workflowId,
      now: Date.now(),
    });
    await logAuthEmailMismatch(ctx, {
      userId: profile._id,
      verificationId,
      role: args.role,
      authEmail: authUser.email,
      accountEmail,
      timestamp: Date.now(),
    });

    const response = await fetch(`${config.baseUrl}/v3/session/`, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(buildDiditSessionBody(config, verificationId, profile)),
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error("Could not start identity verification. Please try again.");
    }

    const providerSessionId = extractSessionId(payload);
    const verificationUrl = extractVerificationUrl(payload);
    if (!verificationUrl) {
      throw new Error("Didit did not return a verification URL.");
    }

    const diditStatus = normalizeDiditStatus(extractStatus(payload) || "pending");
    const status = toSessionCreatedStatus(diditStatus);
    await ctx.runMutation(internal.kyc.markKycSessionCreated, {
      verificationId,
      providerSessionId,
      providerReference: extractString(payload?.reference, payload?.session?.reference),
      status,
      now: Date.now(),
    });

    return { verificationUrl, verificationId, status };
  },
});

export const createDiditKycStartIntent = mutation({
  args: {
    role: kycRoleValidator,
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ verificationId: Id<"identityVerifications">; startToken: string }> => {
    if (args.role === "high_risk_dispute" || args.role === "tournament_organizer") {
      throw new Error("This verification role is not available yet.");
    }

    const authId = await getAuthIdFromContextOrSessionToken(ctx, args.sessionToken);
    if (!authId) throw new Error("Please sign in to continue.");

    const profile = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authId))
      .unique();
    if (!profile?._id) throw new Error("User profile not found.");
    if (args.role === "player" && profile.accountType !== "player") {
      throw new Error("Player verification is only available for player accounts.");
    }
    if ((args.role === "zone_owner" || args.role === "venue_admin") && profile.accountType !== "zone") {
      throw new Error("Zone verification is only available for zone admin accounts.");
    }
    const accountEmail = requireAccountEmail(profile);
    const authEmail = await getBetterAuthEmail(ctx, authId);

    const config = getDiditConfig();
    const now = Date.now();
    const existing = await ctx.db
      .query("identityVerifications")
      .withIndex("by_userId_and_status", (q) => q.eq("userId", profile._id).eq("status", "pending"))
      .first();
    const verificationId = existing?._id ?? await ctx.db.insert("identityVerifications", {
      userId: profile._id,
      type: "kyc",
      role: args.role,
      provider: "didit",
      vendorData: "",
      workflowId: config.workflowId,
      status: "pending",
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const startToken = createStartToken();
    await ctx.db.patch(verificationId, {
      role: args.role,
      vendorData: String(verificationId),
      workflowId: config.workflowId,
      status: "pending",
      startTokenHash: await sha256Hex(startToken),
      startTokenExpiresAt: now + 10 * 60 * 1000,
      updatedAt: now,
    });
    await logAuthEmailMismatch(ctx, {
      userId: profile._id,
      verificationId,
      role: args.role,
      authEmail,
      accountEmail,
      timestamp: now,
    });

    await ctx.db.patch(profile._id, {
      kycVerificationStatus: "pending",
      kycProvider: "didit",
      identityVerificationId: String(verificationId),
      updatedAt: now,
    });

    return { verificationId, startToken };
  },
});

export const startDiditKycSessionFromIntent = action({
  args: {
    verificationId: v.id("identityVerifications"),
    startToken: v.string(),
  },
  handler: async (ctx, args): Promise<{ verificationUrl: string; verificationId: Id<"identityVerifications">; status: KycStatus }> => {
    const verification: any = await ctx.runQuery(internal.kyc.getVerificationForStartIntent, {
      verificationId: args.verificationId,
    });
    const profile: any = verification?.userId
      ? await ctx.runQuery(api.users.getById, { userId: verification.userId })
      : null;
    requireAccountEmail(profile);
    if (!verification?.startTokenHash || !verification.startTokenExpiresAt) {
      throw new Error("Verification session expired. Please try again.");
    }
    if (verification.startTokenExpiresAt < Date.now()) {
      throw new Error("Verification session expired. Please try again.");
    }
    const providedHash = await sha256Hex(args.startToken);
    if (providedHash !== verification.startTokenHash) {
      throw new Error("Verification session expired. Please try again.");
    }

    const config = getDiditConfig();
    const response = await fetch(`${config.baseUrl}/v3/session/`, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(buildDiditSessionBody(config, args.verificationId, profile)),
    });

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error("Could not start identity verification. Please try again.");
    }

    const verificationUrl = extractVerificationUrl(payload);
    if (!verificationUrl) {
      throw new Error("Didit did not return a verification URL.");
    }

    const diditStatus = normalizeDiditStatus(extractStatus(payload) || "pending");
    const status = toSessionCreatedStatus(diditStatus);
    await ctx.runMutation(internal.kyc.markKycSessionCreated, {
      verificationId: args.verificationId,
      providerSessionId: extractSessionId(payload),
      providerReference: extractString(payload?.reference, payload?.session?.reference),
      status,
      now: Date.now(),
    });

    return { verificationUrl, verificationId: args.verificationId, status };
  },
});

export const refreshDiditVerificationStatus = action({
  args: { verificationId: v.id("identityVerifications") },
  handler: async (ctx, args): Promise<{ status: KycStatus; updatedAt: number }> => {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser?.userId) throw new Error("Please sign in to continue.");
    const profile: any = await ctx.runQuery(api.users.getByAuthId, { authId: authUser.userId });
    const verification: any = await ctx.runQuery(internal.kyc.getVerificationForRefresh, { verificationId: args.verificationId });
    if (!profile?._id || !verification || String(verification.userId) !== String(profile._id)) {
      throw new Error("Verification not found.");
    }

    const config = getDiditConfig();
    if (!verification.providerSessionId) {
      return { status: verification.status, updatedAt: verification.updatedAt };
    }

    const response = await fetch(`${config.baseUrl}/v3/session/${encodeURIComponent(verification.providerSessionId)}/decision/`, {
      method: "GET",
      headers: {
        "x-api-key": config.apiKey,
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Could not refresh verification status.");
    }

    const payload = await response.json();
    const status = normalizeDiditStatus(extractStatus(payload) || extractDecision(payload) || verification.status);
    const now = Date.now();
    await ctx.runMutation(internal.kyc.applyDiditStatusUpdate, {
      verificationId: args.verificationId,
      providerSessionId: extractSessionId(payload),
      workflowId: extractWorkflowId(payload),
      status,
      decision: extractDecision(payload),
      rejectionReason: extractSafeReason(payload),
      checkStatuses: extractSafeCheckStatuses(payload),
      now,
    });
    return { status, updatedAt: now };
  },
});

export const diditWebhook = httpAction(async (ctx, request) => {
  const rawBody = await request.text();
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const valid = await verifyDiditSignature(request, rawBody, payload);
  if (!valid) {
    try {
      await ctx.runMutation(internal.kyc.recordKycAuditEvent, {
        action: "signature_failed",
        provider: "didit",
        role: undefined,
        status: undefined,
        verificationId: undefined,
        userId: undefined,
        timestamp: Date.now(),
      });
    } catch {
      // Signature failures should still reject quickly.
    }
    return new Response("Invalid signature", { status: 401 });
  }

  const webhookType = extractString(payload?.webhook_type, payload?.webhookType, payload?.event);
  if (webhookType && webhookType !== "status.updated" && webhookType !== "data.updated") {
    return new Response("OK", { status: 200 });
  }

  const vendorData = extractVendorData(payload);
  const providerSessionId = extractSessionId(payload);
  const verification: any = await ctx.runQuery(internal.kyc.findVerificationFromDiditPayload, {
    vendorData,
    providerSessionId,
  });
  if (!verification?._id) {
    return new Response("OK", { status: 200 });
  }

  const status = normalizeDiditStatus(extractStatus(payload) || extractDecision(payload));
  await ctx.runMutation(internal.kyc.applyDiditStatusUpdate, {
    verificationId: verification._id,
    providerSessionId,
    workflowId: extractWorkflowId(payload),
    status,
    decision: extractDecision(payload),
    rejectionReason: extractSafeReason(payload),
    checkStatuses: extractSafeCheckStatuses(payload),
    now: Date.now(),
  });

  return new Response("OK", { status: 200 });
});

export const createOrReuseKycVerification = internalMutation({
  args: {
    userId: v.id("users"),
    role: kycRoleValidator,
    workflowId: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("identityVerifications")
      .withIndex("by_type_and_role_and_status", (q) => q.eq("type", "kyc").eq("role", args.role).eq("status", "pending"))
      .take(50);
    const existingPending = rows.find((row) => String(row.userId) === String(args.userId));
    if (existingPending) return existingPending._id;

    const inProgressRows = await ctx.db
      .query("identityVerifications")
      .withIndex("by_type_and_role_and_status", (q) => q.eq("type", "kyc").eq("role", args.role).eq("status", "in_progress"))
      .take(50);
    const existingInProgress = inProgressRows.find((row) => String(row.userId) === String(args.userId));
    if (existingInProgress) return existingInProgress._id;

    const verificationId = await ctx.db.insert("identityVerifications", {
      userId: args.userId,
      type: "kyc",
      role: args.role,
      provider: "didit",
      vendorData: "pending",
      workflowId: args.workflowId,
      status: "pending",
      submittedAt: args.now,
      createdAt: args.now,
      updatedAt: args.now,
    });
    await ctx.db.patch(verificationId, { vendorData: String(verificationId) });
    await ctx.db.patch(args.userId, {
      kycVerificationStatus: "pending",
      kycProvider: "didit",
      identityVerificationId: String(verificationId),
      updatedAt: args.now,
    });
    return verificationId;
  },
});

export const markKycSessionCreated = internalMutation({
  args: {
    verificationId: v.id("identityVerifications"),
    providerSessionId: v.optional(v.string()),
    providerReference: v.optional(v.string()),
    status: kycStatusValidator,
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.verificationId);
    if (!verification) return;
    const safeStatus = toSessionCreatedStatus(args.status);
    const patch: Record<string, unknown> = {
      status: safeStatus,
      submittedAt: verification.submittedAt || args.now,
      startTokenHash: undefined,
      startTokenExpiresAt: undefined,
      updatedAt: args.now,
    };
    if (args.providerSessionId) patch.providerSessionId = args.providerSessionId;
    if (args.providerReference) patch.providerReference = args.providerReference;
    await ctx.db.patch(args.verificationId, patch);
    await ctx.db.patch(verification.userId, {
      kycVerificationStatus: safeStatus,
      kycProvider: "didit",
      identityVerificationId: String(args.verificationId),
      updatedAt: args.now,
    });
  },
});

export const findVerificationFromDiditPayload = internalQuery({
  args: {
    vendorData: v.optional(v.string()),
    providerSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.vendorData) {
      const byVendor = await ctx.db
        .query("identityVerifications")
        .withIndex("by_vendorData", (q) => q.eq("vendorData", args.vendorData!))
        .unique();
      if (byVendor) return byVendor;
    }
    if (args.providerSessionId) {
      return await ctx.db
        .query("identityVerifications")
        .withIndex("by_providerSessionId", (q) => q.eq("providerSessionId", args.providerSessionId!))
        .unique();
    }
    return null;
  },
});

export const getVerificationForRefresh = internalQuery({
  args: { verificationId: v.id("identityVerifications") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.verificationId);
  },
});

export const getVerificationForStartIntent = internalQuery({
  args: { verificationId: v.id("identityVerifications") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.verificationId);
  },
});

export const applyDiditStatusUpdate = internalMutation({
  args: {
    verificationId: v.id("identityVerifications"),
    providerSessionId: v.optional(v.string()),
    workflowId: v.optional(v.string()),
    status: kycStatusValidator,
    decision: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    checkStatuses: v.object({
      emailVerificationStatus: v.optional(v.string()),
      idVerificationStatus: v.optional(v.string()),
      livenessStatus: v.optional(v.string()),
      faceMatchStatus: v.optional(v.string()),
      amlStatus: v.optional(v.string()),
      ipAnalysisStatus: v.optional(v.string()),
    }),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.verificationId);
    if (!verification) return;
    const previousStatus = verification.status as KycStatus;
    const effectiveStatus: KycStatus = args.status === "not_started" ? "in_progress" : args.status;
    const statusChanged = previousStatus !== effectiveStatus;

    const verificationPatch: Record<string, unknown> = {
      status: effectiveStatus,
      updatedAt: args.now,
    };
    if (args.providerSessionId || verification.providerSessionId) verificationPatch.providerSessionId = args.providerSessionId || verification.providerSessionId;
    if (args.workflowId || verification.workflowId) verificationPatch.workflowId = args.workflowId || verification.workflowId;
    if (args.decision) verificationPatch.decision = args.decision;
    if (args.rejectionReason) verificationPatch.rejectionReason = args.rejectionReason;
    Object.entries(args.checkStatuses).forEach(([key, value]) => {
      if (value) verificationPatch[key] = value;
    });
    if (effectiveStatus === "verified") verificationPatch.verifiedAt = args.now;
    if (effectiveStatus === "rejected") verificationPatch.rejectedAt = args.now;
    if (effectiveStatus === "in_review") verificationPatch.reviewedAt = args.now;

    await ctx.db.patch(args.verificationId, verificationPatch);

    const userPatch: Record<string, unknown> = {
      kycVerificationStatus: effectiveStatus,
      kycProvider: "didit",
      identityVerificationId: String(args.verificationId),
      updatedAt: args.now,
    };
    let pendingEmailAuthSyncStatus: "not_attempted" | "synced" | "missing_auth_id" | "failed" = "not_attempted";
    if (args.checkStatuses.emailVerificationStatus) {
      userPatch.emailVerificationStatus = args.checkStatuses.emailVerificationStatus;
    }
    if (effectiveStatus === "verified") {
      userPatch.kycVerifiedAt = args.now;
      if (args.checkStatuses.emailVerificationStatus) userPatch.emailVerifiedAt = args.now;
      const profile = await ctx.db.get(verification.userId);
      if (profile?.pendingEmail) {
        const pendingEmailToSync = String(profile.pendingEmail).trim().toLowerCase();
        const pendingEmailAuthId = profile.authId || null;
        if (pendingEmailAuthId) {
          try {
            await ctx.runMutation(components.betterAuth.adapter.updateOne, {
              input: {
                model: "user",
                where: [{ field: "_id", operator: "eq", value: pendingEmailAuthId }],
                update: {
                  email: pendingEmailToSync,
                  emailVerified: true,
                  updatedAt: args.now,
                },
              },
            });
            userPatch.email = pendingEmailToSync;
            userPatch.pendingEmail = null;
            pendingEmailAuthSyncStatus = "synced";
          } catch {
            pendingEmailAuthSyncStatus = "failed";
          }
        } else {
          pendingEmailAuthSyncStatus = "missing_auth_id";
        }
      }
    }
    await ctx.db.patch(verification.userId, userPatch);
    await ctx.db.insert("zoneAuditEvents", {
      zoneId: "identity",
      module: "kyc",
      actorUid: String(verification.userId),
      action: effectiveStatus === "verified" ? "verified" : effectiveStatus === "rejected" ? "rejected" : effectiveStatus === "expired" ? "expired" : "webhook_received",
      targetType: "identityVerification",
      targetId: String(args.verificationId),
      summary: `Didit KYC status updated to ${effectiveStatus}`,
      details: {
        verificationId: String(args.verificationId),
        provider: "didit",
        role: verification.role,
        status: effectiveStatus,
        decision: args.decision || null,
        rejectionReason: args.rejectionReason || null,
        emailVerificationStatus: args.checkStatuses.emailVerificationStatus || null,
        idVerificationStatus: args.checkStatuses.idVerificationStatus || null,
        livenessStatus: args.checkStatuses.livenessStatus || null,
        faceMatchStatus: args.checkStatuses.faceMatchStatus || null,
        amlStatus: args.checkStatuses.amlStatus || null,
        ipAnalysisStatus: args.checkStatuses.ipAnalysisStatus || null,
        pendingEmailAuthSyncStatus,
      },
      createdAt: args.now,
    });

    if (statusChanged) {
      await notifyKycStatusUpdated(ctx, {
        verificationId: args.verificationId,
        userId: verification.userId,
        role: verification.role,
        status: effectiveStatus,
        now: args.now,
      });

      if (previousStatus !== "in_review" && effectiveStatus === "in_review") {
        await notifySuperAdminsKycReviewNeeded(ctx, {
          verificationId: args.verificationId,
          userId: verification.userId,
          role: verification.role,
          now: args.now,
        });
      }
    }
  },
});

export const recordKycAuditEvent = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    verificationId: v.optional(v.id("identityVerifications")),
    provider: v.literal("didit"),
    role: v.optional(kycRoleValidator),
    action: v.string(),
    status: v.optional(kycStatusValidator),
    timestamp: v.number(),
    details: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const auditEvent: Record<string, unknown> = {
      zoneId: "identity",
      module: "kyc",
      actorUid: args.userId ? String(args.userId) : "system",
      action: args.action,
      targetType: "identityVerification",
      summary: `Didit KYC audit event: ${args.action}`,
      details: {
        verificationId: args.verificationId ? String(args.verificationId) : null,
        provider: args.provider,
        role: args.role || null,
        status: args.status || null,
        ...(args.details || {}),
      },
      createdAt: args.timestamp,
    };
    if (args.verificationId) auditEvent.targetId = String(args.verificationId);
    await ctx.db.insert("zoneAuditEvents", auditEvent as any);
  },
});

export const markProfileImage = mutation({
  args: {
    storageId: v.id("_storage"),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authId = await getAuthIdFromContextOrSessionToken(ctx, args.sessionToken);
    if (!authId) throw new Error("Please sign in to continue.");
    const profile = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authId))
      .unique();
    if (!profile) throw new Error("User profile not found.");
    const metadata = await ctx.db.system.get(args.storageId);
    const contentType = String(metadata?.contentType || "").toLowerCase();
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(contentType)) {
      throw new Error("Upload a JPG, PNG, or WebP image.");
    }
    if (Number(metadata?.size || 0) > 5 * 1024 * 1024) {
      throw new Error("Profile image must be 5MB or smaller.");
    }
    const now = Date.now();
    const fileUrl = await ctx.storage.getUrl(args.storageId);
    await ctx.db.patch(profile._id, {
      profileImageStorageId: args.storageId,
      profileImageUpdatedAt: now,
      ...(fileUrl ? { photoURL: fileUrl } : {}),
      updatedAt: now,
    });
    return true;
  },
});

export const requestEmailChange = mutation({
  args: { email: v.string(), sessionToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const authId = await getAuthIdFromContextOrSessionToken(ctx, args.sessionToken);
    if (!authId) throw new Error("Please sign in to continue.");
    const email = String(args.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    const existing = await ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", email)).unique();
    if (existing) throw new Error("This email is already registered.");
    const profile = await ctx.db.query("users").withIndex("by_authId", (q) => q.eq("authId", authId)).unique();
    if (!profile) throw new Error("User profile not found.");
    await ctx.db.patch(profile._id, {
      pendingEmail: email,
      kycVerificationStatus: "pending",
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const requestPhoneChange = mutation({
  args: {
    phoneE164: v.string(),
    phoneMasked: v.string(),
    phoneHash: v.string(),
    verifiedAt: v.number(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authId = await getAuthIdFromContextOrSessionToken(ctx, args.sessionToken);
    if (!authId) throw new Error("Please sign in to continue.");
    const existing = await ctx.db.query("users").withIndex("by_phone", (q) => q.eq("phone", args.phoneE164)).unique();
    if (existing) throw new Error("This phone number is already registered.");
    const profile = await ctx.db.query("users").withIndex("by_authId", (q) => q.eq("authId", authId)).unique();
    if (!profile) throw new Error("User profile not found.");
    await ctx.db.patch(profile._id, {
      pendingPhone: null,
      phone: args.phoneE164,
      phoneOtpVerified: true,
      phoneOtpVerifiedAt: args.verifiedAt,
      phoneNumberMasked: args.phoneMasked,
      phoneNumberHash: args.phoneHash,
      updatedAt: Date.now(),
    });
    return true;
  },
});
