import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "MatchHai <no-reply@matchhai.com>";
const WITHDRAWAL_REQUEST_EMAIL = "admin@matchhai.com";

async function sendResendEmail(input: { to: string; subject: string; text: string; html?: string }) {
  if (!RESEND_API_KEY) {
    console.warn("[zoneWithdrawals] RESEND_API_KEY is not configured; withdrawal email skipped");
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[zoneWithdrawals] Withdrawal email send failed", { status: response.status, body });
    throw new Error(`Failed to send withdrawal email: ${response.status}`);
  }
}

export const requestZoneWithdrawal = action({
  args: {
    userId: v.id("users"),
    zoneId: v.optional(v.string()),
    branchId: v.string(),
    branchName: v.string(),
    amount: v.number(),
    ownerName: v.optional(v.string()),
    ownerEmail: v.optional(v.string()),
    venueName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: true; reference: string }> => {
    const result: { reference: string; createdAt: number; walletBalance: number } = await ctx.runMutation(
      api.wallet.createZoneWithdrawalTransaction,
      args,
    );
    const requestedAt = new Date(result.createdAt).toLocaleString("en-PK", {
      timeZone: "Asia/Karachi",
      dateStyle: "medium",
      timeStyle: "short",
    });
    const lines = [
      "Zone admin withdrawal request",
      `Time: ${requestedAt}`,
      `Amount: PKR ${Math.round(args.amount).toLocaleString("en-US")}`,
      `Venue: ${args.venueName || "Not provided"}`,
      `Branch: ${args.branchName} (${args.branchId})`,
      `Owner: ${args.ownerName || "Not provided"}`,
      `Owner email: ${args.ownerEmail || "Not provided"}`,
      `User ID: ${String(args.userId)}`,
      `Zone ID: ${args.zoneId || "Not provided"}`,
      `Reference: ${result.reference}`,
    ];

    await sendResendEmail({
      to: WITHDRAWAL_REQUEST_EMAIL,
      subject: `Withdrawal request: ${args.venueName || args.ownerName || "Zone Admin"} - PKR ${Math.round(args.amount).toLocaleString("en-US")}`,
      text: lines.join("\n"),
      html: `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap">${lines.join("\n")}</pre>`,
    });

    return { ok: true, reference: result.reference };
  },
});
