import { api } from "./_generated/api";
import { ActionCtx, MutationCtx } from "./_generated/server";
import { authComponent } from "./auth";

export const KYC_VERIFICATION_REQUIRED_MESSAGE =
  "Please complete CNIC & face verification to unlock MatchHai features.";

export const KYC_VERIFICATION_REQUIRED_FOR_WITHDRAWAL =
  "Please complete CNIC & face verification before requesting withdrawal.";

export function isKycVerificationBypassEnabled(): boolean {
  return (
    String(process.env.SKIP_KYC_VERIFICATION || "").trim() === "1" ||
    String(process.env.SKIP_PHONE_OTP || "").trim() === "1"
  );
}

export function isKycAccessAllowed(status?: string | null): boolean {
  return (
    status === "verified" ||
    status === "pending" ||
    status === "in_progress" ||
    status === "in_review"
  );
}

export function assertKycAccessAllowed(
  profile?: {
    kycVerificationStatus?: string | null;
    accountStatus?: string | null;
    suspendedUntil?: number | null;
  } | null,
  message = KYC_VERIFICATION_REQUIRED_MESSAGE,
) {
  if (!profile) {
    throw new Error("User profile not found.");
  }

  if (profile.accountStatus === "suspended") {
    const suspendedUntil =
      typeof profile.suspendedUntil === "number" ? profile.suspendedUntil : null;
    if (!suspendedUntil || suspendedUntil > Date.now()) {
      throw new Error("Your MatchHai account is suspended. Please contact support.");
    }
  }

  // Safe dev/demo bypass; never bypass suspension checks.
  if (isKycVerificationBypassEnabled()) return;

  if (!isKycAccessAllowed(profile.kycVerificationStatus)) {
    throw new Error(message);
  }
}

export async function requireKycVerified(
  ctx: ActionCtx | MutationCtx,
  message = KYC_VERIFICATION_REQUIRED_MESSAGE,
) {
  let authUser: Awaited<ReturnType<typeof authComponent.getAuthUser>> | null = null;
  try {
    authUser = await authComponent.getAuthUser(ctx);
  } catch {
    authUser = null;
  }

  // Better Auth's user document carries both the auth record id (`_id`) and an
  // optional linked app user id (`userId`). `userId` is null for accounts that
  // were never explicitly linked, so resolve the profile by trying both.
  const rawIds: Array<string | null | undefined> = [authUser?.userId, authUser?._id];

  // Convex JWT identity fallback: works in both actions and mutations via ctx.auth.
  // Required when authComponent.getAuthUser returns null/empty (e.g. the mobile
  // Convex token is valid but Better Auth session lookup returns no userId/_id).
  if (!rawIds.some((id) => typeof id === "string" && id.trim())) {
    try {
      const identity = await ctx.auth.getUserIdentity();
      if (identity) {
        rawIds.push(identity.subject, identity.tokenIdentifier);
        for (const raw of [identity.subject, identity.tokenIdentifier]) {
          if (raw?.includes("|")) rawIds.push(raw.split("|").pop());
        }
      }
    } catch {}
  }

  const candidateAuthIds = rawIds
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value, index, array) => Boolean(value) && array.indexOf(value) === index);

  if (!candidateAuthIds.length) {
    throw new Error("Please sign in to continue.");
  }

  let profile: Awaited<ReturnType<typeof getProfileByAuthId>> = null;
  for (const authId of candidateAuthIds) {
    profile = await getProfileByAuthId(ctx, authId);
    if (profile) break;
  }

  assertKycAccessAllowed(profile as any, message);

  return { authUser, profile };
}

async function getProfileByAuthId(ctx: ActionCtx | MutationCtx, authId: string) {
  return "db" in ctx
    ? await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", authId))
        .unique()
    : await ctx.runQuery(api.users.getByAuthId, { authId });
}
