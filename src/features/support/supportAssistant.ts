import { SUPPORT_AI_ENABLED, SUPPORT_AI_ENDPOINT, SUPPORT_EMAIL, SUPPORT_RESPONSE_SLA } from "../../config/support";

export type SupportUserRole = "player" | "zone_admin" | "super_admin" | "unknown";

export type SupportConversationContext = {
  userRole?: SupportUserRole;
  currentIssueCategory?: string;
  currentIssueSummary?: string;
  knownNonSensitiveDetails: Record<string, string | number | boolean>;
  lastUserIntent?: string;
  lastAssistantQuestion?: string;
  escalationOffered?: boolean;
  pendingAction?: "none" | "create_ticket" | "send_email";
  supportTicketReference?: string;
  supportTicketEmailSent?: boolean;
  recentMessages: Array<{
    role: "user" | "assistant";
    text: string;
  }>;
  recentResponseFingerprints: string[];
};

export type SupportAgentResponse = {
  answer: string;
  contextPatch?: Partial<SupportConversationContext>;
};

export type SupportActionIntent = "draft_email" | "create_ticket" | "none";

export const EMPTY_SUPPORT_CONTEXT: SupportConversationContext = {
  knownNonSensitiveDetails: {},
  pendingAction: "none",
  recentMessages: [],
  recentResponseFingerprints: [],
};

const BULLET = "\u2022";

function lines(parts: Array<string | null | undefined | false>) {
  return parts
    .filter((part): part is string => part !== null && part !== undefined && part !== false)
    .join("\n");
}

function bullets(items: string[]) {
  return items.map((item) => `${BULLET} ${item}`).join("\n");
}

export const SUPPORT_BOT_COPY = {
  botName: "MatchHai Support",
  title: "Help & Support",
  subtitle: "Support assistant",
  initialGreeting: lines([
    "Hi, I'm MatchHai Support.",
    "",
    "Tell me what is stuck in MatchHai and I will guide you.",
  ]),
  contextTitle: "MatchHai Support",
  contextSafety:
    "Ask about account, matchrooms, payments, reports, notifications, or admin usage.\n\nNever share OTPs, PINs, passwords, tokens, or raw payment/provider payloads.",
  emptyTitle: "Ask a MatchHai support question",
  emptySubtitle: "Account, matchroom, payment, report, booking, notification, or admin usage.",
  unavailablePrefix: "Support AI unavailable.",
  greetingFallback: "Hi, I'm MatchHai Support. What's stuck in the app?",
  clarificationFallback: "Tell me what issue you're facing in MatchHai and I'll guide you.",
  correctionFallback: "Sorry, I misunderstood. Please tell me the issue you're facing in MatchHai, and I'll guide you.",
  missingIssueForEmail: "Sure - what issue should the email be about?",
  missingIssueForTicket: "I can create a support request after I understand the issue. What is stuck in MatchHai?",
  offTopic: "I can help with MatchHai support only. Tell me what is stuck in your account, matchroom, booking, payment, report, notification, or admin screen.",
  sensitiveReminder: "Please do not share OTPs, PINs, passwords, tokens, raw provider payloads, or secrets.",
  missingEmail: "Support email is not configured yet. I can still create a support request if you want human review.",
};

const SUPPORT_TOPICS = [
  "matchhai",
  "help",
  "issue",
  "problem",
  "stuck",
  "error",
  "bug",
  "not working",
  "can't",
  "cant",
  "cannot",
  "unable",
  "user",
  "player",
  "account",
  "login",
  "profile",
  "password",
  "register",
  "registration",
  "signup",
  "zone",
  "owner",
  "admin",
  "super admin",
  "venue",
  "branch",
  "approval",
  "matchroom",
  "match room",
  "lobby",
  "invite",
  "team",
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
  "support",
  "ticket",
  "email",
];

const OFF_TOPIC_HINTS = [
  "biryani",
  "weather",
  "movie",
  "recipe",
  "song",
  "news",
  "capital of",
  "homework",
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function isGreeting(input: string) {
  const text = normalize(input).replace(/[.!?]+$/g, "");
  return /^(hi|hello|hey|salam|assalamualaikum|asalamualaikum|assalamu alaikum|how are you|how r u|how are u)$/.test(text);
}

export function isCorrection(input: string) {
  const text = normalize(input);
  return (
    /\b(no|nope|nah)\b.*\b(not what i wanted|not what i meant|wrong|misunderstood)\b/.test(text) ||
    /\b(that'?s wrong|you misunderstood|not what i wanted|not what i meant)\b/.test(text)
  );
}

function roleFromModuleLabel(moduleLabel?: "Player" | "Zone Admin" | "Super Admin"): SupportUserRole | undefined {
  switch (moduleLabel) {
    case "Player":
      return "player";
    case "Zone Admin":
      return "zone_admin";
    case "Super Admin":
      return "super_admin";
    default:
      return undefined;
  }
}

function roleFromText(input: string): SupportUserRole | undefined {
  const text = normalize(input);
  if (/\bsuper\s*admin\b/.test(text)) return "super_admin";
  if (/\b(zone owner|zone admin|venue owner)\b/.test(text)) return "zone_admin";
  if (/\b(user|player)\b/.test(text)) return "player";
  return undefined;
}

function detectCategory(input: string, previous?: string) {
  const text = normalize(input);
  if (/\b(payment|wallet|refund|deducted|paid|money|pending|easypaisa)\b/.test(text)) return "payments_wallet_refunds";
  if (/\b(matchroom|match room|lobby|invite|team|slot)\b/.test(text)) return "matchroom_lobby";
  if (/\b(zone|venue|branch|zone owner|zone admin|approval)\b/.test(text)) return "zone_admin";
  if (/\b(super admin|dashboard|filters|payments are not showing)\b/.test(text)) return "super_admin";
  if (/\b(login|log in|password|account|profile|signup|register)\b/.test(text)) return "account_profile";
  if (/\b(booking|book)\b/.test(text)) return "booking";
  if (/\b(notification|push|inbox|alert)\b/.test(text)) return "notifications";
  if (/\b(report|moderation|complaint)\b/.test(text)) return "reports_moderation";
  if (/\b(crash|bug|error|not working|submit button)\b/.test(text)) return "technical_issue";
  return previous;
}

function detectIntent(input: string, context?: SupportConversationContext) {
  const text = normalize(input);
  if (getSupportActionIntent(input, context) === "create_ticket") return "create_ticket";
  if (getSupportActionIntent(input, context) === "draft_email") return "draft_email";
  if (/^(yes|y|yeah|yep|sure|ok|okay)$/.test(text)) return "affirm";
  if (/^(no|n|not now|cancel)$/.test(text)) return "decline";
  if (isGreeting(input)) return "greeting";
  return "describe_issue";
}

function detectDetails(input: string, existing: Record<string, string | number | boolean>) {
  const text = normalize(input);
  const details = { ...existing };
  const timeMatch = input.match(/\b(yesterday|today|last night|this morning|this evening|around\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
  if (timeMatch) details.approximateTime = timeMatch[0];
  if (/\b(cs2|counter[-\s]?strike|counter strike)\b/.test(text)) details.game = "CS2";
  if (/\b(valorant|valo)\b/.test(text)) details.game = "Valorant";
  if (/\b(pubg)\b/.test(text)) details.game = "PUBG";
  if (/\b(fifa|fc 24|fc24|fc 25|fc25|fc26|fc 26)\b/.test(text)) details.game = "EA FC";
  if (/\b(matchroom|match room)\b/.test(text)) details.paymentType = "matchroom";
  if (/\b(wallet)\b/.test(text)) details.paymentType = "wallet";
  if (/\b(booking)\b/.test(text)) details.paymentType = "booking";
  if (/\b(deducted|debited|charged|money left)\b/.test(text)) details.moneyDeducted = true;
  if (/\b(profile missing|empty profile|account missing)\b/.test(text)) details.profileMissing = true;
  return details;
}

function summarizeIssue(category?: string, details: Record<string, string | number | boolean> = {}, latest?: string) {
  const parts = [
    category,
    details.paymentType ? `${details.paymentType} flow` : null,
    details.moneyDeducted ? "money deducted" : null,
    details.profileMissing ? "profile/account missing" : null,
    details.game ? String(details.game) : null,
    details.approximateTime ? String(details.approximateTime) : null,
  ].filter(Boolean);

  if (parts.length) return parts.join(", ");
  return redactSupportText(latest || "").slice(0, 160) || "MatchHai support issue";
}

export function hasMeaningfulSupportIssue(context?: SupportConversationContext) {
  if (!context) return false;
  const details = Object.keys(context.knownNonSensitiveDetails || {});
  if (details.length > 0) return true;
  const category = context.currentIssueCategory;
  if (category && category !== "unknown") return true;
  const summary = normalize(context.currentIssueSummary || "");
  if (!summary || summary === "matchhai support issue") return false;
  if (/^(hi|hello|hey|salam|assalamualaikum|how are you|user|player|zone owner|zone admin|super admin)$/.test(summary)) {
    return false;
  }
  return summary.length >= 12 && /\b(issue|problem|stuck|error|not working|can't|cant|cannot|unable|missing|deducted|pending|login|profile|payment|matchroom|booking|notification|report|zone|admin)\b/.test(summary);
}

export function isObviousOffTopic(input: string, context?: SupportConversationContext) {
  if (context?.currentIssueCategory) return false;
  const text = normalize(input);
  if (SUPPORT_TOPICS.some((topic) => text.includes(topic))) return false;
  return OFF_TOPIC_HINTS.some((hint) => text.includes(hint));
}

export function isSensitiveInput(input: string) {
  return /\b(?:otp|pin|password|token|secret)\s*[:=]?\s*[A-Z0-9@#$%^&*._-]{3,}\b/i.test(input);
}

export function getSupportActionIntent(input: string, context?: SupportConversationContext): SupportActionIntent {
  const text = normalize(input);
  const asksDraft =
    /\b(write|draft|compose)\b.*\b(email|message)\b/.test(text) ||
    text.includes("what should i send") ||
    text.includes("what do i send");
  if (asksDraft) return "draft_email";

  const asksDirectAction =
    text.includes("email it directly") ||
    text.includes("send it directly") ||
    text.includes("send to support") ||
    text.includes("send this to support") ||
    text.includes("contact admin") ||
    text.includes("contact support") ||
    text.includes("create ticket") ||
    text.includes("create support request") ||
    text.includes("support request");
  if (asksDirectAction) return "create_ticket";

  if (/^(yes|y|yeah|yep|sure|ok|okay)$/.test(text) && context?.pendingAction === "create_ticket") {
    return "create_ticket";
  }

  return "none";
}

export function updateSupportContext(
  context: SupportConversationContext,
  userMessage: string,
  assistantMessage?: string,
  patch?: Partial<SupportConversationContext>,
  meta?: { moduleLabel?: "Player" | "Zone Admin" | "Super Admin" },
): SupportConversationContext {
  const userRole = patch?.userRole || roleFromText(userMessage) || context.userRole || roleFromModuleLabel(meta?.moduleLabel) || "unknown";
  const currentIssueCategory = patch?.currentIssueCategory || detectCategory(userMessage, context.currentIssueCategory);
  const knownNonSensitiveDetails = {
    ...detectDetails(userMessage, context.knownNonSensitiveDetails),
    ...(patch?.knownNonSensitiveDetails || {}),
  };
  const currentIssueSummary =
    patch?.currentIssueSummary ||
    summarizeIssue(currentIssueCategory, knownNonSensitiveDetails, userMessage);

  const recentMessages = [
    ...context.recentMessages,
    { role: "user" as const, text: redactSupportText(userMessage) },
    ...(assistantMessage ? [{ role: "assistant" as const, text: redactSupportText(assistantMessage) }] : []),
  ].slice(-10);

  const nextFingerprint = assistantMessage ? fingerprintResponse(assistantMessage) : null;
  const recentResponseFingerprints = nextFingerprint
    ? [...context.recentResponseFingerprints, nextFingerprint].slice(-5)
    : context.recentResponseFingerprints;

  return {
    ...context,
    ...patch,
    userRole,
    currentIssueCategory,
    currentIssueSummary,
    knownNonSensitiveDetails,
    lastUserIntent: patch?.lastUserIntent || detectIntent(userMessage, context),
    recentMessages,
    recentResponseFingerprints,
  };
}

export function shouldCallSupportAi(input: string, context?: SupportConversationContext) {
  if (isSensitiveInput(input)) return false;
  if (isObviousOffTopic(input, context)) return false;
  if (isGreeting(input) || isCorrection(input)) return false;
  return SUPPORT_AI_ENABLED && Boolean(SUPPORT_AI_ENDPOINT.trim());
}

export function fingerprintResponse(input: string) {
  return normalize(input)
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .slice(0, 140);
}

export function isRepeatedResponse(context: SupportConversationContext, answer: string) {
  const fingerprint = fingerprintResponse(answer);
  return Boolean(fingerprint && context.recentResponseFingerprints.slice(-2).includes(fingerprint));
}

export function buildSupportEmailDraft(context: SupportConversationContext) {
  const configuredEmail = SUPPORT_EMAIL.trim();
  if (!configuredEmail) return SUPPORT_BOT_COPY.missingEmail;

  const subject = `MatchHai ${context.currentIssueCategory || "support"} request`;
  const body = lines([
    "Hi MatchHai Support,",
    "",
    `I need help with this issue: ${context.currentIssueSummary || "MatchHai support issue"}.`,
    context.userRole ? `Account role: ${context.userRole}` : "",
    "",
    "Known details:",
    bullets(
      Object.entries(context.knownNonSensitiveDetails)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .slice(0, 8),
    ) || "No extra details captured yet.",
    "",
    "Please check and advise on the next step.",
  ]);

  return lines([
    "Sure - here's a draft:",
    "",
    "Subject:",
    subject,
    "",
    "Body:",
    body,
    "",
    SUPPORT_RESPONSE_SLA,
    "",
    "Send to:",
    configuredEmail,
  ]);
}

export function buildSupportEmailGuidance(context: SupportConversationContext = EMPTY_SUPPORT_CONTEXT) {
  return buildSupportEmailDraft(context);
}

export function buildLocalSupportFallback(input: string, context: SupportConversationContext = EMPTY_SUPPORT_CONTEXT) {
  const text = normalize(input);

  if (isGreeting(input)) return SUPPORT_BOT_COPY.greetingFallback;
  if (isCorrection(input)) return SUPPORT_BOT_COPY.correctionFallback;

  if (/^(help|i need help|can you help|please help)$/.test(text)) {
    return SUPPORT_BOT_COPY.clarificationFallback;
  }

  if (/^(yes|y|yeah|yep|sure|ok|okay|no|nope|nah)$/.test(text) && context.pendingAction !== "create_ticket") {
    return SUPPORT_BOT_COPY.clarificationFallback;
  }

  const category = detectCategory(input, context.currentIssueCategory);
  const role = roleFromText(input) || context.userRole;

  if (role && !category && !hasMeaningfulSupportIssue(context)) {
    return "Got it. What MatchHai issue are you facing with that account?";
  }

  if (category === "payments_wallet_refunds" || (text.includes("money") && text.includes("pending"))) {
    return lines([
      "This sounds like a payment issue.",
      "",
      "Please check whether the payment is showing in Wallet, Booking Status, or the matchroom screen.",
      "",
      "Did the money leave your account, or is it only showing pending inside MatchHai?",
    ]);
  }

  if (category === "matchroom_lobby") {
    return "Got it - this sounds related to a matchroom or lobby. What exactly changed: the matchroom disappeared, joining failed, invite failed, or payment is pending?";
  }

  if (category === "zone_admin") {
    return "Got it - this sounds like a zone admin issue. Which step is stuck: login/account, zone registration, venue details, branch setup, resources, pricing, or approval?";
  }

  if (category === "super_admin") {
    return "For a Super Admin issue, which screen is affected: dashboard, users, zones, reports, payments, or support tickets?";
  }

  if (category === "account_profile") {
    return "Got it - this sounds like an account or profile issue. Are you logged in but seeing the wrong/missing profile, or can you not access the account at all?";
  }

  if (category === "notifications") {
    return "Got it - are notifications missing from your phone push alerts, the in-app inbox, or both?";
  }

  if (category === "reports_moderation") {
    return "Got it - is this about reporting a player, checking a report status, or an admin moderation action?";
  }

  return SUPPORT_BOT_COPY.clarificationFallback;
}

export function redactSupportText(input: string) {
  return input
    .replace(/\b(?:otp|pin|password|token|secret)\s*[:=]?\s*[A-Z0-9@#$%^&*._-]{3,}\b/gi, "[redacted-secret]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/(?:\+?92|0)?3[0-9][\s-]?[0-9]{3}[\s-]?[0-9]{4}\b/g, "[redacted-phone]")
    .replace(/\b\d{5}[-\s]?\d{7}[-\s]?\d\b/g, "[redacted-cnic]")
    .replace(/\b(?:EP|TXN|TRX|PAY|ORD|REF)[-_]?[A-Z0-9-]{6,}\b/gi, "[redacted-reference]")
    .replace(/\b[A-F0-9]{12,}\b/gi, "[redacted-id]");
}

export async function askSupportAi(
  input: string,
  context: SupportConversationContext = EMPTY_SUPPORT_CONTEXT,
  appContext?: unknown,
): Promise<SupportAgentResponse> {
  if (!SUPPORT_AI_ENABLED || !SUPPORT_AI_ENDPOINT.trim()) {
    throw new Error("Support AI unavailable");
  }

  const response = await fetch(SUPPORT_AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: redactSupportText(input),
      scope: "MatchHai app support only",
      context: {
        userRole: context.userRole,
        currentIssueCategory: context.currentIssueCategory,
        currentIssueSummary: context.currentIssueSummary,
        knownNonSensitiveDetails: context.knownNonSensitiveDetails,
        lastUserIntent: context.lastUserIntent,
        lastAssistantQuestion: context.lastAssistantQuestion,
        escalationOffered: context.escalationOffered,
        pendingAction: context.pendingAction,
      },
      supportEmail: SUPPORT_EMAIL.trim(),
      appContext,
      history: context.recentMessages.slice(-8).map((message) => ({
        role: message.role,
        text: redactSupportText(message.text).slice(0, 700),
      })),
    }),
  });

  if (!response.ok) throw new Error("Support AI unavailable");

  const payload = await response.json();
  const answer = typeof payload?.answer === "string" ? payload.answer.trim() : "";
  if (!answer) throw new Error("Support AI unavailable");
  return {
    answer,
    contextPatch: typeof payload?.contextPatch === "object" && payload.contextPatch
      ? payload.contextPatch
      : undefined,
  };
}
