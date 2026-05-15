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
  const authUser = await authComponent.getAuthUser(ctx);
  if (!authUser?.userId) {
    throw new Error("Please sign in to continue.");
  }
  const authId = authUser.userId;

  const profile =
    "db" in ctx
      ? await ctx.db
          .query("users")
          .withIndex("by_authId", (q) => q.eq("authId", authId))
          .unique()
      : await ctx.runQuery(api.users.getByAuthId, { authId });

  assertKycAccessAllowed(profile, message);

  return { authUser, profile };
}
