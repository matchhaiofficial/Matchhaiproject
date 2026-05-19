import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

type KycNotificationStatus = "not_started" | "pending" | "in_progress" | "in_review" | "verified" | "rejected" | "expired";
type KycNotificationRole = "player" | "zone_owner" | "venue_admin" | "high_risk_dispute" | "tournament_organizer";

function getOwnerNotificationTarget(role: KycNotificationRole): { recipientRole: "player" | "zone_admin"; route: string } {
  if (role === "zone_owner" || role === "venue_admin") {
    return { recipientRole: "zone_admin", route: "/zone/profile" };
  }
  return { recipientRole: "player", route: "/auth/verification-required" };
}

function getStatusCopy(status: KycNotificationStatus) {
  if (status === "verified") {
    return {
      title: "Verification approved",
      body: "Your identity verification has been approved.",
    };
  }
  if (status === "rejected") {
    return {
      title: "Verification rejected",
      body: "Your identity verification was rejected. Please review your verification status.",
    };
  }
  if (status === "expired") {
    return {
      title: "Verification failed",
      body: "Your identity verification could not be completed. Please review your verification status.",
    };
  }
  return {
    title: "Verification in review",
    body: "Your identity verification is being reviewed.",
  };
}

async function recordNotificationIssue(ctx: any, input: {
  action: string;
  verificationId: Id<"identityVerifications">;
  userId?: Id<"users">;
  role?: KycNotificationRole;
  status?: KycNotificationStatus;
  reason: string;
  now: number;
}) {
  await ctx.db.insert("zoneAuditEvents", {
    zoneId: "identity",
    module: "kyc",
    actorUid: input.userId ? String(input.userId) : "system",
    action: input.action,
    targetType: "identityVerification",
    targetId: String(input.verificationId),
    summary: `KYC notification issue: ${input.action}`,
    details: {
      verificationId: String(input.verificationId),
      role: input.role || null,
      status: input.status || null,
      reason: input.reason.slice(0, 160),
    },
    createdAt: input.now,
  });
}

export async function notifyKycStatusUpdated(ctx: any, input: {
  verificationId: Id<"identityVerifications">;
  userId?: Id<"users">;
  role: KycNotificationRole;
  status: KycNotificationStatus;
  now: number;
}) {
  if (!input.userId) {
    await recordNotificationIssue(ctx, {
      action: "kyc_status_notification_missing_user",
      verificationId: input.verificationId,
      role: input.role,
      status: input.status,
      reason: "missing_verification_user",
      now: input.now,
    });
    return;
  }

  const target = getOwnerNotificationTarget(input.role);
  const copy = getStatusCopy(input.status);
  const dedupeKey = `kyc.status_updated:${String(input.verificationId)}:${input.status}`;

  try {
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "kyc.status_updated",
      toUid: input.userId,
      recipientRole: target.recipientRole,
      status: "pending",
      dedupeKey,
      dedupePolicy: "replace_active",
      pushPolicy: "eligible",
      route: target.route,
      entity: { kind: "identityVerification", id: String(input.verificationId) },
      entityId: String(input.verificationId),
      title: copy.title,
      body: copy.body,
      data: {
        verificationId: String(input.verificationId),
        kycStatus: input.status,
        role: input.role,
        route: target.route,
        href: target.route,
      },
    });
  } catch (error: any) {
    await recordNotificationIssue(ctx, {
      action: "kyc_status_notification_failed",
      verificationId: input.verificationId,
      userId: input.userId,
      role: input.role,
      status: input.status,
      reason: error?.message || "notification_failed",
      now: input.now,
    });
  }
}

export async function notifySuperAdminsKycReviewNeeded(ctx: any, input: {
  verificationId: Id<"identityVerifications">;
  userId: Id<"users">;
  role: KycNotificationRole;
  now: number;
}) {
  const superAdmins = await ctx.db
    .query("users")
    .withIndex("by_role", (q: any) => q.eq("role", "super-admin"))
    .collect();

  if (superAdmins.length === 0) {
    await recordNotificationIssue(ctx, {
      action: "kyc_review_needed_no_super_admins",
      verificationId: input.verificationId,
      userId: input.userId,
      role: input.role,
      status: "in_review",
      reason: "no_super_admin_recipients",
      now: input.now,
    });
    return;
  }

  const route = "/super-admin/identity-verifications";
  const baseDedupeKey = `kyc.review_needed:${String(input.verificationId)}`;

  for (const admin of superAdmins) {
    try {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "kyc.review_needed",
        toUid: admin._id,
        recipientRole: "super_admin",
        status: "pending",
        dedupeKey: `${baseDedupeKey}:${String(admin._id)}`,
        dedupePolicy: "replace_active",
        pushPolicy: "eligible",
        route,
        entity: { kind: "identityVerification", id: String(input.verificationId) },
        entityId: String(input.verificationId),
        title: "KYC review needed",
        body: "An identity verification requires Super Admin review.",
        data: {
          verificationId: String(input.verificationId),
          baseDedupeKey,
          userId: String(input.userId),
          role: input.role,
          kycStatus: "in_review",
          route,
          href: route,
        },
      });
    } catch (error: any) {
      await recordNotificationIssue(ctx, {
        action: "kyc_review_needed_notification_failed",
        verificationId: input.verificationId,
        userId: admin._id,
        role: input.role,
        status: "in_review",
        reason: error?.message || "notification_failed",
        now: input.now,
      });
    }
  }
}
