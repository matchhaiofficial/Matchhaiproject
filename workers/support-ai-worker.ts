export interface Env {
  CLOUDFLARE_ACCOUNT_ID: string;
  CLOUDFLARE_WORKERS_AI_API_TOKEN: string;
  SUPPORT_AI_MODEL?: string;
  SUPPORT_EMAIL?: string;
}

type AgentContextPatch = {
  userRole?: "player" | "zone_admin" | "super_admin" | "unknown";
  currentIssueCategory?: string;
  currentIssueSummary?: string;
  knownNonSensitiveDetails?: Record<string, string | number | boolean>;
  lastAssistantQuestion?: string;
  escalationOffered?: boolean;
  pendingAction?: "none" | "create_ticket" | "send_email";
};

const SYSTEM_PROMPT = [
  "You are MatchHai Support Assistant.",
  "You help players, zone admins, and super admins with MatchHai app issues.",
  "You are not a generic chatbot. Refuse off-topic requests briefly, then invite the user back to MatchHai support.",
  "Understand the issue naturally from the current message, conversation history, safe app context, and user role.",
  "Reason silently. Do not expose chain of thought.",
  "Do not repeat templates or the same answer from earlier messages.",
  "Ask only 1-2 focused follow-up questions at a time.",
  "Do not dump long generic checklists unless the user asks for a summary or email draft.",
  "Never ask for OTPs, PINs, passwords, tokens, raw provider payloads, checkout tokens, auth tokens, or internal debug data.",
  "Do not claim you checked database, payment, account, or admin status unless the safe app context explicitly contains that information.",
  "If safe app context is unavailable or insufficient, say what the user can check and offer to create a support request.",
  "For payment deducted, account access/profile sync, backend-sync, missing matchroom, or admin dashboard data issues, offer to create a support request when unresolved.",
  "If the user asks to write/draft an email, generate a draft only.",
  "If the user asks to send/email directly/contact support/create ticket, set pendingAction to create_ticket and ask for confirmation unless the user has already clearly confirmed.",
  "Format mobile chat replies with short paragraphs and bullets only when helpful.",
  "Return only valid JSON with shape: {\"answer\":\"...\",\"contextPatch\":{...}}.",
].join("\n");

const SUPPORT_TOPICS = [
  "matchhai",
  "help",
  "support",
  "user",
  "player",
  "owner",
  "account",
  "login",
  "profile",
  "password",
  "register",
  "registration",
  "signup",
  "matchroom",
  "match room",
  "lobby",
  "booking",
  "payment",
  "wallet",
  "refund",
  "money",
  "deducted",
  "pending",
  "paid",
  "report",
  "moderation",
  "notification",
  "zone",
  "admin",
  "super admin",
  "venue",
  "branch",
  "approval",
  "dashboard",
  "ticket",
  "email",
  "send",
  "issue",
  "problem",
  "stuck",
  "error",
  "bug",
  "not working",
  "unable",
];

const OFF_TOPIC_HINTS = [
  "biryani",
  "recipe",
  "weather",
  "movie",
  "song",
  "homework",
  "capital of",
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

function isSupportTopic(message: string, hasSupportContext: boolean) {
  const text = normalize(message);
  if (hasSupportContext && isContextualFollowUp(message)) return true;
  return SUPPORT_TOPICS.some((topic) => text.includes(topic));
}

function isContextualFollowUp(message: string) {
  const text = normalize(message);
  return /\b(it|this|that|same|still|again|yes|no|yesterday|today|tomorrow|around|for|was|doesn'?t|didn'?t|write|send|directly|login|profile|account)\b/.test(text);
}

function isOffTopic(message: string, hasSupportContext: boolean) {
  const text = normalize(message);
  if (isSupportTopic(message, hasSupportContext)) return false;
  return OFF_TOPIC_HINTS.some((hint) => text.includes(hint));
}

function isAmbiguous(message: string) {
  const text = normalize(message).replace(/[.!?]+$/g, "");
  return text.length <= 2 || /^(hi|hello|hey|help|support|i need help|need help)$/.test(text);
}

function isRoleOnly(message: string) {
  const text = normalize(message).replace(/[.!?]+$/g, "");
  return /^(i am|i'm|im|as)\s+(a\s+)?(user|player|zone owner|zone admin|venue owner|super admin)$/.test(text);
}

function isAffirmative(message: string) {
  const text = normalize(message);
  return /^(yes|y|yeah|yep|sure|ok|okay)$/.test(text);
}

function isGreeting(message: string) {
  const text = normalize(message).replace(/[.!?]+$/g, "");
  return /^(hi|hello|hey|salam|assalamualaikum|asalamualaikum|assalamu alaikum|how are you|how r u|how are u)$/.test(text);
}

function isCorrection(message: string) {
  const text = normalize(message);
  return (
    /\b(no|nope|nah)\b.*\b(not what i wanted|not what i meant|wrong|misunderstood)\b/.test(text) ||
    /\b(that'?s wrong|you misunderstood|not what i wanted|not what i meant)\b/.test(text)
  );
}

function wantsDraft(message: string) {
  const text = normalize(message);
  return (
    /\b(write|draft|compose)\b.*\b(email|message)\b/.test(text) ||
    text.includes("what should i send") ||
    text.includes("what do i send")
  );
}

function wantsDirectAction(message: string) {
  const text = normalize(message);
  return (
    text.includes("email it directly") ||
    text.includes("send it directly") ||
    text.includes("send to support") ||
    text.includes("send this to support") ||
    text.includes("contact admin") ||
    text.includes("contact support") ||
    text.includes("create ticket") ||
    text.includes("create support request") ||
    text.includes("support request")
  );
}

function inferPatch(message: string, context: any): AgentContextPatch {
  const text = normalize(message);
  const details = { ...(context?.knownNonSensitiveDetails || {}) };
  let userRole = context?.userRole;
  let category = context?.currentIssueCategory;

  if (/\bsuper\s*admin\b/.test(text)) userRole = "super_admin";
  else if (/\b(zone owner|zone admin|venue owner)\b/.test(text)) userRole = "zone_admin";
  else if (/\b(user|player)\b/.test(text)) userRole = userRole || "player";

  if (/\b(payment|wallet|refund|deducted|money|paid|pending|easypaisa)\b/.test(text)) category = "payments_wallet_refunds";
  if (/\b(matchroom|match room|lobby|slot|invite|team)\b/.test(text)) {
    category = category === "payments_wallet_refunds" ? "payments_matchroom" : "matchroom_lobby";
    details.paymentType = "matchroom";
  }
  if (/\b(super admin|dashboard|filters)\b/.test(text)) category = "super_admin";
  if (/\b(zone|venue|branch|approval|register a new zone)\b/.test(text)) category = "zone_admin";
  if (/\b(login|log in|account|profile|password)\b/.test(text)) {
    category = category === "zone_admin" ? "zone_admin_onboarding_account" : "account_profile";
  }
  if (/\b(notifications?|push|inbox|alert)\b/.test(text)) category = "notifications";
  if (/\b(report|moderation|complaint)\b/.test(text)) category = "reports_moderation";

  if (/\b(deducted|debited|charged|money left)\b/.test(text)) details.moneyDeducted = true;
  if (/\b(profile missing|empty profile|account missing)\b/.test(text)) details.profileMissing = true;
  const timeMatch = message.match(/\b(yesterday|today|last night|this morning|this evening|around\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
  if (timeMatch) details.approximateTime = timeMatch[0];
  if (/\b(cs2|counter[-\s]?strike|counter strike)\b/.test(text)) details.game = "CS2";

  const summaryParts = [
    category,
    details.paymentType ? `${details.paymentType} flow` : null,
    details.moneyDeducted ? "money deducted" : null,
    details.profileMissing ? "profile/account missing" : null,
    details.game,
    details.approximateTime,
  ].filter(Boolean);

  return {
    userRole,
    currentIssueCategory: category,
    currentIssueSummary: summaryParts.length ? summaryParts.join(", ") : context?.currentIssueSummary,
    knownNonSensitiveDetails: details,
  };
}

function hasMeaningfulIssue(context: any) {
  const details = Object.keys(context?.knownNonSensitiveDetails || {});
  if (details.length > 0) return true;
  const category = String(context?.currentIssueCategory || "");
  if (category && category !== "unknown") return true;
  const summary = normalize(String(context?.currentIssueSummary || ""));
  if (!summary || summary === "matchhai support issue") return false;
  if (/^(hi|hello|hey|salam|assalamualaikum|how are you|user|player|zone owner|zone admin|super admin)$/.test(summary)) {
    return false;
  }
  return summary.length >= 12 && /\b(issue|problem|stuck|error|not working|can't|cant|cannot|unable|missing|deducted|pending|login|profile|payment|matchroom|booking|notification|report|zone|admin)\b/.test(summary);
}

function buildDraft(context: any, supportEmail?: string) {
  const email = String(supportEmail || "").trim();
  if (!email) {
    return "Support email is not configured yet. I can still help create a support request in the app.";
  }

  const details = context?.knownNonSensitiveDetails || {};
  const detailLines = Object.entries(details)
    .slice(0, 8)
    .map(([key, value]) => `• ${key}: ${String(value)}`)
    .join("\n");

  return [
    "Sure - here's a draft:",
    "",
    "Subject:",
    `MatchHai ${context?.currentIssueCategory || "support"} request`,
    "",
    "Body:",
    "Hi MatchHai Support,",
    "",
    `I need help with this issue: ${context?.currentIssueSummary || "MatchHai support issue"}.`,
    context?.userRole ? `Account role: ${context.userRole}` : "",
    "",
    "Known details:",
    detailLines || "• No extra details captured yet",
    "",
    "Please check and advise on the next step.",
    "",
    "Send to:",
    email,
  ].filter(Boolean).join("\n");
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return "";
}

function fallbackAgentAnswer(message: string, context: any, appContext: any, supportEmail?: string) {
  const text = normalize(message);
  const patch = inferPatch(message, context);
  const nextContext = { ...context, ...patch };

  if (isGreeting(message)) {
    return {
      answer: "Hi, I'm MatchHai Support. What's stuck in the app?",
      contextPatch: { ...patch, pendingAction: "none" },
    };
  }

  if (isCorrection(message)) {
    return {
      answer: "Sorry, I misunderstood. Please tell me the issue you're facing in MatchHai, and I'll guide you.",
      contextPatch: { ...patch, pendingAction: "none", lastAssistantQuestion: "clarify_issue" },
    };
  }

  if (wantsDraft(message)) {
    if (!hasMeaningfulIssue(nextContext)) {
      return {
        answer: "Sure - what issue should the email be about?",
        contextPatch: { ...patch, pendingAction: "none", lastAssistantQuestion: "email_issue_scope" },
      };
    }
    return { answer: buildDraft(nextContext, supportEmail), contextPatch: { ...patch, pendingAction: "none" } };
  }

  if (wantsDirectAction(message)) {
    if (!hasMeaningfulIssue(nextContext)) {
      return {
        answer: "I can create a support request after I understand the issue. What is stuck in MatchHai?",
        contextPatch: { ...patch, pendingAction: "none", lastAssistantQuestion: "ticket_issue_scope" },
      };
    }
    return {
      answer: "I can create a support request for the MatchHai team with this conversation. Should I do that?",
      contextPatch: { ...patch, pendingAction: "create_ticket", escalationOffered: true, lastAssistantQuestion: "confirm_create_ticket" },
    };
  }

  if (isAmbiguous(message) || isRoleOnly(message)) {
    return {
      answer: "Sure - what MatchHai issue are you facing right now?",
      contextPatch: { ...patch, pendingAction: "none" },
    };
  }

  const recentPayments = Array.isArray(appContext?.recentPayments) ? appContext.recentPayments : [];
  const recentMatchrooms = Array.isArray(appContext?.recentMatchrooms) ? appContext.recentMatchrooms : [];
  if (text.includes("deducted") || (text.includes("payment") && text.includes("pending"))) {
    const pendingPayment = recentPayments.find((payment: any) => ["created", "redirected", "token_received", "pending"].includes(String(payment.status)));
    const pendingRoom = recentMatchrooms.find((room: any) => String(room.paymentStatus || "").toLowerCase() !== "paid");
    return {
      answer: [
        "This sounds like a payment-to-matchroom sync issue.",
        "",
        pendingPayment
          ? `I can see a recent safe payment summary with status "${pendingPayment.status}" for PKR ${pendingPayment.amount}.`
          : "I do not have a matching pending payment summary in the safe context available to this chat.",
        pendingRoom
          ? `I also see a recent matchroom summary: ${pendingRoom.title || pendingRoom.game || pendingRoom.id}, payment status "${pendingRoom.paymentStatus || "unknown"}".`
          : "",
        "",
        "This may need support review. I can create a support request for you. Should I do that?",
      ].filter(Boolean).join("\n"),
      contextPatch: { ...patch, pendingAction: "create_ticket", escalationOffered: true, lastAssistantQuestion: "confirm_create_ticket" },
    };
  }

  if (patch.currentIssueCategory === "super_admin") {
    return {
      answer: "For a Super Admin payments view issue, first check whether a date/status filter is active. Are payments missing from the dashboard total, the transaction list, or only after applying filters?",
      contextPatch: { ...patch, pendingAction: "none", lastAssistantQuestion: "super_admin_payment_scope" },
    };
  }

  if (patch.currentIssueCategory === "zone_admin" && /\b(register|registration|new zone|create zone)\b/.test(text)) {
    return {
      answer: "Got it - you are trying to register a new zone. What is stuck right now: account/login, venue details, branch/location, resources/pricing, or final submission?",
      contextPatch: { ...patch, pendingAction: "none", lastAssistantQuestion: "zone_registration_step" },
    };
  }

  if (patch.currentIssueCategory === "notifications") {
    return {
      answer: "Got it - notifications are not coming through. Are you missing push notifications on the phone, in-app inbox notifications, or both?",
      contextPatch: { ...patch, pendingAction: "none", lastAssistantQuestion: "notification_scope" },
    };
  }

  if (detailsIndicateProfileSync(patch.knownNonSensitiveDetails)) {
    return {
      answer: "Got it. Since you mentioned the account/profile is missing, this sounds more like an account sync/profile issue than a password issue. Are you logged in but seeing an empty profile, or can you not access the account at all?",
      contextPatch: { ...patch, pendingAction: "none", lastAssistantQuestion: "profile_sync_scope" },
    };
  }

  return {
    answer: "I understand. What screen are you on, and what happens when you try the action?",
    contextPatch: { ...patch, pendingAction: "none" },
  };
}

function detailsIndicateProfileSync(details: any) {
  return Boolean(details?.profileMissing);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return json({});
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const body = await request.json().catch(() => null) as {
      message?: string;
      context?: any;
      appContext?: any;
      supportEmail?: string;
      history?: Array<{ role?: string; text?: string }>;
    } | null;

    const message = String(body?.message || "").trim().slice(0, 2000);
    if (!message) return json({ error: "Message is required" }, 400);

    const context = body?.context || {};
    const appContext = body?.appContext || null;
    const supportEmail = body?.supportEmail || env.SUPPORT_EMAIL;
    const hasSupportContext = Boolean(context.currentIssueCategory || context.currentIssueSummary);
    const inferredPatch = inferPatch(message, context);

    if (isOffTopic(message, hasSupportContext)) {
      return json({
        answer: "I can help with MatchHai support only. Tell me what is stuck in your account, matchroom, booking, payment, report, notification, or admin screen.",
        contextPatch: { pendingAction: "none" },
      });
    }

    if (wantsDraft(message) || wantsDirectAction(message)) {
      return json(fallbackAgentAnswer(message, context, appContext, supportEmail));
    }

    const needsLocalAgentGuardrail =
      isRoleOnly(message) ||
      inferredPatch.currentIssueCategory === "super_admin" ||
      inferredPatch.currentIssueCategory === "notifications" ||
      (inferredPatch.currentIssueCategory === "zone_admin" && /\b(register|registration|new zone|create zone)\b/.test(normalize(message))) ||
      detailsIndicateProfileSync(inferredPatch.knownNonSensitiveDetails) ||
      normalize(message).includes("deducted") ||
      (normalize(message).includes("payment") && normalize(message).includes("pending"));

    if (needsLocalAgentGuardrail) {
      return json(fallbackAgentAnswer(message, context, appContext, supportEmail));
    }

    const accountId = env.CLOUDFLARE_ACCOUNT_ID;
    const token = env.CLOUDFLARE_WORKERS_AI_API_TOKEN;
    const model = env.SUPPORT_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct";
    if (!accountId || !token) return json(fallbackAgentAnswer(message, context, appContext, supportEmail));

    const aiResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "system",
            content: JSON.stringify({
              currentSupportContext: context,
              inferredPatch,
              safeAppContext: appContext,
              supportEmailConfigured: Boolean(String(supportEmail || "").trim()),
            }),
          },
          ...(body?.history || []).slice(-8).map((item) => ({
            role: item.role === "assistant" ? "assistant" : "user",
            content: String(item.text || "").slice(0, 700),
          })),
          { role: "user", content: message },
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) return json(fallbackAgentAnswer(message, context, appContext, supportEmail));

    const payload = await aiResponse.json() as any;
    const raw = String(payload?.result?.response || payload?.result?.text || "").trim();
    const jsonText = extractJsonObject(raw);

    try {
      const parsed = JSON.parse(jsonText);
      const answer = String(parsed?.answer || "").trim();
      if (!answer) throw new Error("Missing answer");
      return json({
        answer,
        contextPatch: {
          ...inferredPatch,
          ...(typeof parsed.contextPatch === "object" && parsed.contextPatch ? parsed.contextPatch : {}),
        },
      });
    } catch {
      const fallback = fallbackAgentAnswer(message, context, appContext, supportEmail);
      return json(fallback);
    }
  },
};
