import type { MutationCtx } from "../_generated/server";

export type NotificationInput = {
  type: string;
  fromUid?: string | null;
  fromUsername?: string | null;
  toUid: string;
  status?: string;
  isRead?: boolean;
  title?: string | null;
  message?: string | null;
  reason?: string | null;
  content?: string | null;
  entityKey?: string | null;
  meta?: any;
  expiresAt?: number | null;
};

export async function sendNotification(ctx: MutationCtx, input: NotificationInput) {
  const now = Date.now();
  return await ctx.db.insert("notifications", {
    type: input.type,
    fromUid: input.fromUid ?? undefined,
    fromUsername: input.fromUsername ?? undefined,
    toUid: input.toUid,
    status: input.status ?? "pending",
    isRead: input.isRead ?? false,
    title: input.title ?? undefined,
    message: input.message ?? undefined,
    reason: input.reason ?? undefined,
    content: input.content ?? undefined,
    entityKey: input.entityKey ?? undefined,
    meta: input.meta ?? undefined,
    createdAt: now,
    updatedAt: now,
    expiresAt: input.expiresAt ?? undefined,
  });
}
