import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

const SUPER_ADMIN_WITHDRAWAL_ROUTE = "/super-admin/withdrawals";
const ZONE_ADMIN_WITHDRAWAL_ROUTE = "/zone/profile";

export async function notifySuperAdminsWithdrawalReviewNeeded(ctx: any, input: {
  withdrawalId: Id<"walletTransactions">;
}) {
  const superAdmins = await ctx.db
    .query("users")
    .withIndex("by_role", (q: any) => q.eq("role", "super-admin"))
    .collect();

  const baseDedupeKey = `withdrawal.review_needed:${String(input.withdrawalId)}`;

  for (const admin of superAdmins) {
    try {
      await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
        type: "withdrawal.review_needed",
        toUid: admin._id,
        recipientRole: "super_admin",
        status: "pending",
        dedupeKey: `${baseDedupeKey}:${String(admin._id)}`,
        dedupePolicy: "replace_active",
        pushPolicy: "eligible",
        route: SUPER_ADMIN_WITHDRAWAL_ROUTE,
        entity: { kind: "walletTransaction", id: String(input.withdrawalId) },
        entityId: String(input.withdrawalId),
        title: "Withdrawal review needed",
        body: "A withdrawal request is waiting for Super Admin review.",
        data: {
          withdrawalId: String(input.withdrawalId),
          baseDedupeKey,
          route: SUPER_ADMIN_WITHDRAWAL_ROUTE,
          href: SUPER_ADMIN_WITHDRAWAL_ROUTE,
        },
      });
    } catch (error: any) {
      console.warn("[withdrawalNotifications] review notification failed", {
        withdrawalId: String(input.withdrawalId),
        superAdminId: String(admin._id),
        message: error?.message || "notification_failed",
      });
    }
  }
}

export async function notifyZoneAdminWithdrawalRequested(ctx: any, input: {
  withdrawalId: Id<"walletTransactions">;
  zoneAdminUserId: Id<"users">;
}) {
  try {
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type: "withdrawal.requested",
      toUid: input.zoneAdminUserId,
      recipientRole: "zone_admin",
      status: "pending",
      dedupeKey: `withdrawal.requested:${String(input.withdrawalId)}:${String(input.zoneAdminUserId)}`,
      dedupePolicy: "replace_active",
      pushPolicy: "eligible",
      route: ZONE_ADMIN_WITHDRAWAL_ROUTE,
      entity: { kind: "walletTransaction", id: String(input.withdrawalId) },
      entityId: String(input.withdrawalId),
      title: "Withdrawal request received",
      body: "Your withdrawal request has been submitted for review.",
      data: {
        withdrawalId: String(input.withdrawalId),
        route: ZONE_ADMIN_WITHDRAWAL_ROUTE,
        href: ZONE_ADMIN_WITHDRAWAL_ROUTE,
      },
    });
  } catch (error: any) {
    console.warn("[withdrawalNotifications] requested notification failed", {
      withdrawalId: String(input.withdrawalId),
      zoneAdminUserId: String(input.zoneAdminUserId),
      message: error?.message || "notification_failed",
    });
  }
}

export async function notifyZoneAdminWithdrawalDecision(ctx: any, input: {
  withdrawalId: Id<"walletTransactions">;
  zoneAdminUserId: Id<"users">;
  decision: "approved" | "rejected";
}) {
  const type = input.decision === "approved" ? "withdrawal.approved" : "withdrawal.rejected";
  const title = input.decision === "approved" ? "Withdrawal approved" : "Withdrawal rejected";
  const body = input.decision === "approved"
    ? "Your withdrawal request has been approved."
    : "Your withdrawal request was not approved. Review your wallet status.";

  try {
    await ctx.runMutation(internal.notifications.createCanonicalFromServer, {
      type,
      toUid: input.zoneAdminUserId,
      recipientRole: "zone_admin",
      status: "pending",
      dedupeKey: `${type}:${String(input.withdrawalId)}`,
      dedupePolicy: "replace_active",
      pushPolicy: "eligible",
      route: ZONE_ADMIN_WITHDRAWAL_ROUTE,
      entity: { kind: "walletTransaction", id: String(input.withdrawalId) },
      entityId: String(input.withdrawalId),
      title,
      body,
      data: {
        withdrawalId: String(input.withdrawalId),
        decision: input.decision,
        route: ZONE_ADMIN_WITHDRAWAL_ROUTE,
        href: ZONE_ADMIN_WITHDRAWAL_ROUTE,
      },
    });
  } catch (error: any) {
    console.warn("[withdrawalNotifications] decision notification failed", {
      withdrawalId: String(input.withdrawalId),
      zoneAdminUserId: String(input.zoneAdminUserId),
      decision: input.decision,
      message: error?.message || "notification_failed",
    });
  }
}
