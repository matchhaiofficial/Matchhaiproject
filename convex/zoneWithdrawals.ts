import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import {
  KYC_VERIFICATION_REQUIRED_FOR_WITHDRAWAL,
  requireKycVerified,
} from "./kycGate";

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
    console.error("[zoneWithdrawals] Withdrawal email send failed", { status: response.status });
    throw new Error(`Failed to send withdrawal email: ${response.status}`);
  }
}

function normalizeAccountNumber(value: string) {
  return String(value || "").trim().replace(/[^0-9 -]/g, "");
}

function maskAccountNumber(value: string) {
  const cleaned = normalizeAccountNumber(value);
  const compact = cleaned.replace(/[\s-]/g, "");
  if (compact.length < 6 || compact.length > 34) {
    throw new Error("Please enter a valid account number.");
  }
  const last4 = compact.slice(-4);
  const maskedPrefix = "*".repeat(Math.max(2, compact.length - 4));
  return {
    accountNumberRaw: cleaned,
    accountNumberMasked: `${maskedPrefix}${last4}`,
    accountNumberLast4: last4,
  };
}

export const requestZoneWithdrawal = action({
  args: {
    userId: v.id("users"),
    zoneId: v.optional(v.string()),
    branchId: v.string(),
    branchName: v.string(),
    amount: v.number(),
    bankName: v.string(),
    accountNumber: v.string(),
    ownerName: v.optional(v.string()),
    ownerEmail: v.optional(v.string()),
    venueName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ ok: true; reference: string }> => {
    const { profile } = await requireKycVerified(ctx, KYC_VERIFICATION_REQUIRED_FOR_WITHDRAWAL);
    if (!profile) {
      throw new Error("User profile not found.");
    }
    const requester = await ctx.runQuery(api.users.getById, { userId: args.userId });
    if (!requester || String(requester._id) !== String(profile._id)) {
      throw new Error("Not authorized.");
    }

    const bankName = String(args.bankName || "").trim();
    if (!bankName) {
      throw new Error("Please select a bank.");
    }
    const { accountNumberRaw, accountNumberMasked, accountNumberLast4 } = maskAccountNumber(args.accountNumber);
    const result: { reference: string; createdAt: number; walletBalance: number } = await ctx.runMutation(
      api.wallet.createZoneWithdrawalTransaction,
      {
        userId: profile._id,
        zoneId: args.zoneId,
        branchId: args.branchId,
        branchName: args.branchName,
        amount: args.amount,
        bankName,
        accountNumberMasked,
        accountNumberLast4,
        ownerName: args.ownerName,
        ownerEmail: args.ownerEmail,
        venueName: args.venueName,
      },
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
      `Bank: ${bankName}`,
      `Account number: ${accountNumberRaw}`,
      `Account number (masked): ${accountNumberMasked}`,
      `Owner: ${args.ownerName || "Not provided"}`,
      `Owner email: ${args.ownerEmail || "Not provided"}`,
      `User ID: ${String(profile._id)}`,
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
