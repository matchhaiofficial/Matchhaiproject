"use node";

import { v } from "convex/values";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || process.env.EXPO_PUBLIC_SUPPORT_EMAIL || "admin@matchhai.com";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "MatchHai Support <support@matchhai.com>";

function formatExcerpt(messages: Array<{ role: string; text: string }>) {
  return messages
    .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.text}`)
    .join("\n\n");
}

type SupportEmailResult = {
  emailSent: boolean;
  emailStatus: "sent" | "failed" | "not_configured";
};

type SupportEmailPayload = {
  ticketId: Id<"supportTickets">;
  reference: string;
  issueSummary: string;
  priority: string;
  category: string;
  userRole: string;
  conversationExcerpt: Array<{ role: string; text: string }>;
};

export const sendSupportTicketEmail = action({
  args: {
    ticketId: v.id("supportTickets"),
  },
  handler: async (ctx, args): Promise<SupportEmailResult> => {
    const payload: SupportEmailPayload = await ctx.runQuery((api as any).support.getSupportTicketEmailPayload, {
      ticketId: args.ticketId,
    });

    if (!RESEND_API_KEY) {
      await ctx.runMutation((api as any).support.markSupportTicketEmailStatus, {
        ticketId: args.ticketId,
        emailStatus: "not_configured",
      });
      return { emailSent: false, emailStatus: "not_configured" as const };
    }

    const subject: string = `[${payload.priority.toUpperCase()}] MatchHai Support ${payload.reference}`;
    const text: string = [
      `Reference: ${payload.reference}`,
      `Role: ${payload.userRole}`,
      `Category: ${payload.category}`,
      `Priority: ${payload.priority}`,
      "",
      "Issue summary:",
      payload.issueSummary,
      "",
      "Conversation excerpt:",
      formatExcerpt(payload.conversationExcerpt),
    ].join("\n");

    const response: Response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [SUPPORT_EMAIL],
        subject,
        text,
      }),
    });

    const emailStatus = response.ok ? "sent" : "failed";
    await ctx.runMutation((api as any).support.markSupportTicketEmailStatus, {
      ticketId: args.ticketId,
      emailStatus,
    });

    return { emailSent: response.ok, emailStatus };
  },
});
