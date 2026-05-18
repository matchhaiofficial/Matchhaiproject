export interface Env {
  DEEPSEEK_API_KEY: string;
  DEEPSEEK_MODEL?: string;
  DEEPSEEK_BASE_URL?: string;
  SUPPORT_AI_SHARED_SECRET: string;
  SUPPORT_AGENT_TOOLS_URL: string;
  SUPPORT_ALLOWED_ORIGIN?: string;
  SUPPORT_EMAIL?: string;
}

type AgentActionStatus = "executed" | "denied" | "failed" | "rate_limited";
type AgentAction = {
  type: string;
  reason?: string;
  payload?: Record<string, unknown>;
};
type SupportQuestionCategory =
  | "general_policy"
  | "matchroom_issue"
  | "payment_booking_issue"
  | "refund_issue"
  | "team_challenge_issue"
  | "zone_admin_issue"
  | "report_dispute_issue"
  | "ticket_escalation_request";

const MAX_USER_MESSAGE_CHARS = 2000;
const MAX_RECENT_MESSAGES_SENT = 12;
const MAX_TOOL_CALLS_PER_TURN = 5;
const MAX_CONTEXT_CHARS = 12000;
const DEFAULT_MODEL = "deepseek-v4-pro";
const DANGEROUS_ACTIONS = new Set([
  "refund_payment",
  "modify_wallet_balance",
  "ban_user",
  "suspend_user",
  "release_venue_payout",
  "override_match_result",
  "delete_account",
  "cancel_confirmed_matchroom",
]);
const ALLOWED_ACTIONS = new Set([
  "create_support_ticket",
  "create_admin_escalation",
  "create_moderation_report",
  "add_support_ticket_note",
  "prepare_email_draft",
]);

const SYSTEM_PROMPT = [
  "You are MatchHai AI Support Agent.",
  "You help players, zone admins, and super admins with MatchHai app support issues only.",
  "You can inspect only safe tool context provided to you. Never claim you checked data that is not in safe context.",
  "Use retrieved MatchHai knowledge chunks for policy/how-to answers. Use real-time tool results for account-specific answers.",
  "If real-time data is unavailable or does not verify the user's claim, say that clearly and offer ticket creation.",
  "Do not expose knowledge chunk internals, source labels, scores, raw metadata, or tool payloads to users.",
  "Never ask for OTPs, PINs, passwords, tokens, auth headers, CNIC, card numbers, wallet numbers, or payment gateway payloads.",
  "Never perform or recommend direct execution of refunds, wallet balance changes, bans, suspensions, venue payouts, result overrides, account deletion, or confirmed matchroom cancellation. Escalate those.",
  "For low or medium priority ticket creation, ask for user confirmation before creating a ticket.",
  "For urgent deducted-payment or failed-booking issues, you may request create_support_ticket.",
  "For reports about players, teams, venues, zones, cheating, harassment, abuse, unsafe venue behavior, or moderation, collect safe facts and use create_moderation_report when the user clearly wants to file a report.",
  "The support chat cannot upload attachments. Never ask users to attach documents, screenshots, images, videos, receipts, or files. Ask for short text details only.",
  "Format answer as clean short paragraphs with bullets when listing steps. Do not use markdown tables. Keep the tone human, direct, and supportive.",
  "Return only JSON with this shape: {\"answer\":\"...\",\"intent\":\"payment_issue|matchroom_issue|account_issue|zone_admin_issue|general_help|bug_report|dispute|refund_request\",\"confidence\":0.0,\"priority\":\"low|medium|high|urgent\",\"neededFollowUp\":null,\"actions\":[],\"contextPatch\":{}}.",
].join("\n");

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function requestId() {
  return `support-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

function json(body: unknown, status = 200, origin?: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

function getAllowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get("Origin");
  const allowed = String(env.SUPPORT_ALLOWED_ORIGIN || "").trim();
  if (!origin || !allowed) return null;
  return origin === allowed ? origin : null;
}

function redactSupportText(input: string) {
  return String(input || "")
    .replace(/\b(?:otp|pin|password|token|secret)\s*[:=]?\s*[A-Z0-9@#$%^&*._-]{3,}\b/gi, "[redacted-secret]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/(?:\+?92|0)?3[0-9][\s-]?[0-9]{3}[\s-]?[0-9]{4}\b/g, "[redacted-phone]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[redacted-card]")
    .replace(/\b(?:easypaisa|jazzcash|wallet)\s*[:=]?\s*(?:\+?92|0)?3[0-9][\s-]?[0-9]{3}[\s-]?[0-9]{4}\b/gi, "[redacted-wallet]")
    .replace(/\b\d{5}[-\s]?\d{7}[-\s]?\d\b/g, "[redacted-cnic]")
    .replace(/\b(?:EP|TXN|TRX|PAY|ORD|REF)[-_]?(?=[A-Z0-9-]*\d)[A-Z0-9-]{6,}\b/gi, "[redacted-reference]")
    .replace(/\b[A-F0-9]{12,}\b/gi, "[redacted-id]");
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sign(payloadBase64: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadBase64));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function verifySupportToken(token: string, secret: string) {
  const [payloadBase64, signature] = String(token || "").split(".");
  if (!payloadBase64 || !signature) throw new Error("invalid_token");
  if (await sign(payloadBase64, secret) !== signature) throw new Error("invalid_token");
  const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadBase64)));
  if (!payload?.expMs || Number(payload.expMs) <= Date.now()) throw new Error("expired_token");
  return payload;
}

function isAffirmative(message: string) {
  return /^(yes|y|yeah|yep|sure|ok|okay)$/i.test(message.trim());
}

function isOffTopic(message: string, hasContext: boolean) {
  const text = normalize(message);
  if (hasContext) return false;
  const supportTerms = ["matchhai", "account", "profile", "matchroom", "booking", "payment", "wallet", "refund", "zone", "venue", "admin", "report", "notification", "support", "ticket", "login"];
  if (supportTerms.some((term) => text.includes(term))) return false;
  return ["biryani", "recipe", "weather", "movie", "song", "homework", "capital of"].some((term) => text.includes(term));
}

function inferPatch(message: string, context: any) {
  const text = normalize(message);
  const details = { ...(context?.knownNonSensitiveDetails || {}) };
  let category = context?.currentIssueCategory;
  let userRole = context?.userRole;
  if (/\bsuper\s*admin\b/.test(text)) userRole = "super_admin";
  if (/\b(zone owner|zone admin|venue owner|venue)\b/.test(text)) userRole = "zone_admin";
  if (/\b(payment|wallet|refund|deducted|charged|paid|pending|easypaisa)\b/.test(text)) category = "payments_wallet_refunds";
  else if (/\b(matchroom|match room|lobby|captain|result|dispute)\b/.test(text)) category = "matchroom_lobby";
  else if (/\b(zone|venue|branch|pricing|resource|payout)\b/.test(text)) category = "zone_admin";
  else if (/\b(login|account|profile|verification|steam|faceit|psn)\b/.test(text)) category = "account_profile";
  else if (/\b(notification|push|inbox)\b/.test(text)) category = "notifications";
  if (/\b(deducted|charged|money left|debited)\b/.test(text)) details.moneyDeducted = true;
  if (/\b(refund)\b/.test(text)) details.refundRequested = true;
  return {
    userRole,
    currentIssueCategory: category,
    knownNonSensitiveDetails: details,
    currentIssueSummary: category || redactSupportText(message).slice(0, 160),
  };
}

function fallbackAgentAnswer(message: string, context: any, safeContext?: any) {
  const text = normalize(message);
  const patch = inferPatch(message, context);
  if (isOffTopic(message, Boolean(context?.currentIssueCategory))) {
    return {
      answer: "I can help with MatchHai support only. Tell me what is stuck in your account, matchroom, booking, payment, report, notification, or admin screen.",
      contextPatch: { pendingAction: "none" },
      intent: "general_help",
      priority: "low",
    };
  }
  if (/\b(refund|cancel confirmed|ban|wallet balance|payout|override result|delete account)\b/.test(text)) {
    return {
      answer: "I cannot perform that action directly. I can check safe status details and create a support ticket for admin review.",
      contextPatch: { ...patch, pendingAction: "create_ticket", escalationOffered: true },
      intent: text.includes("refund") ? "refund_request" : "general_help",
      priority: "high",
    };
  }
  if (text.includes("deducted") || (text.includes("payment") && text.includes("pending"))) {
    const recentPayment = Array.isArray(safeContext?.recentPayments) ? safeContext.recentPayments[0] : null;
    return {
      answer: [
        "This sounds like a payment sync issue.",
        "",
        recentPayment ? `I can see a recent safe payment summary with status \"${recentPayment.status}\" for ${recentPayment.currency || "PKR"} ${recentPayment.amount}.` : "I do not have a matching payment summary in the safe context available to this chat.",
        "I can create a high-priority support ticket for the MatchHai team if this is still unresolved.",
      ].filter(Boolean).join("\n"),
      contextPatch: { ...patch, pendingAction: "create_ticket", escalationOffered: true },
      intent: "payment_issue",
      priority: "high",
    };
  }
  return {
    answer: "I understand. What screen are you on, and what happens when you try the action?",
    contextPatch: { ...patch, pendingAction: "none" },
    intent: patch.currentIssueCategory || "general_help",
    priority: "medium",
  };
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return "";
}

function isUrgentPaymentIssue(message: string, planner: any) {
  const text = normalize(message);
  return (
    planner?.priority === "urgent" ||
    ((text.includes("deducted") || text.includes("charged") || text.includes("money left")) &&
      (text.includes("payment") || text.includes("matchroom") || text.includes("booking")))
  );
}

function wantsTicket(message: string, context: any) {
  const text = normalize(message);
  return (
    text.includes("create ticket") ||
    text.includes("create a ticket") ||
    text.includes("open ticket") ||
    text.includes("open a ticket") ||
    text.includes("make ticket") ||
    text.includes("make a ticket") ||
    text.includes("support ticket") ||
    text.includes("ticlet") ||
    text.includes("create support request") ||
    text.includes("contact support") ||
    text.includes("send to support") ||
    (isAffirmative(message) && context?.pendingAction === "create_ticket")
  );
}

function claimsTicketCreated(answer: string) {
  const text = normalize(answer);
  return (
    /\b(i'?ve|i have|we'?ve|we have)\s+created\b/.test(text) &&
    /\b(ticket|support request)\b/.test(text)
  );
}

function wantsModerationReport(message: string) {
  const text = normalize(message);
  return /\b(report|complaint|complain|abuse|harassment|toxic|cheat|cheating|unsafe|scam|fraud)\b/.test(text) &&
    /\b(player|user|team|venue|zone|branch|matchroom|captain|opponent|admin)\b/.test(text);
}

function inferReportType(message: string) {
  const text = normalize(message);
  if (/\b(venue|zone|branch)\b/.test(text)) return "zone_complaint";
  if (/\b(matchroom|match room|captain|opponent)\b/.test(text)) return "matchroom_complaint";
  return "user_report";
}

function classifySupportQuestion(message: string, context: any): SupportQuestionCategory {
  const text = normalize(message);
  // Prefer "how-to" / guidance questions over incident triage.
  // Otherwise queries like "how to create matchroom" get misclassified as a matchroom incident.
  if (/\b(how\s+to|how\s+do\s+i|steps?|guide|tutorial|instructions?)\b/.test(text)) {
    return "general_policy";
  }
  if (/\b(create|make|start|set\s*up)\b/.test(text) && /\b(matchroom|match\s*room|team\s*challenge|challenge|wallet|top\s*up|booking|zone|venue)\b/.test(text)) {
    return "general_policy";
  }
  if (wantsTicket(message, context) || /\b(escalate|human support|support ticket|support request|contact admin)\b/.test(text)) {
    return "ticket_escalation_request";
  }
  if (/\b(refund|refunded|money back|returned to wallet|cancelled payment)\b/.test(text)) return "refund_issue";
  if (/\b(payment|paid|deducted|charged|wallet|top[ -]?up|booking|easypaisa|transaction|checkout)\b/.test(text)) {
    return "payment_booking_issue";
  }
  if (/\b(team challenge|challenge|challenged|opponent team|reject challenge|accept challenge|captain)\b/.test(text)) {
    return "team_challenge_issue";
  }
  if (/\b(matchroom|match room|room pending|lobby|slot|join room|player not show|no[- ]?show|venue not confirmed)\b/.test(text)) {
    return "matchroom_issue";
  }
  if (/\b(zone|venue|branch|zone admin|owner|approval|booking request|resource|pricing)\b/.test(text)) {
    return "zone_admin_issue";
  }
  if (/\b(report|dispute|complaint|abuse|harassment|cheat|cheating|unsafe|scam|fraud)\b/.test(text)) {
    return "report_dispute_issue";
  }
  if (context?.currentIssueCategory === "payments_wallet_refunds") return "payment_booking_issue";
  if (context?.currentIssueCategory === "matchroom_lobby") return "matchroom_issue";
  if (context?.currentIssueCategory === "zone_admin") return "zone_admin_issue";
  return "general_policy";
}

function buildContextTools(category: SupportQuestionCategory, userMessage: string): AgentAction[] {
  const tools: AgentAction[] = [
    {
      type: "search_support_knowledge",
      reason: "Retrieve MatchHai support policy and how-to context for this user message.",
      payload: {
        query: userMessage,
        limit: category === "general_policy" ? 6 : 4,
      },
    },
  ];
  if (category === "matchroom_issue") {
    tools.push({ type: "get_my_matchroom_status", reason: "Check safe matchroom status for this authenticated user.", payload: { recentOnly: true } });
  } else if (category === "payment_booking_issue") {
    tools.push({ type: "get_my_payment_booking_status", reason: "Check safe payment and booking status for this authenticated user.", payload: {} });
  } else if (category === "refund_issue") {
    tools.push({ type: "get_my_refund_status", reason: "Check safe refund status for this authenticated user.", payload: {} });
  } else if (category === "team_challenge_issue") {
    tools.push({ type: "get_my_team_challenge_status", reason: "Check safe team challenge status for this authenticated user.", payload: {} });
  } else if (category === "zone_admin_issue") {
    tools.push({ type: "get_my_zone_request_status", reason: "Check safe zone request status for this authenticated user.", payload: {} });
  } else if (category === "ticket_escalation_request") {
    tools.push({ type: "get_my_recent_support_entities", reason: "Gather safe recent entities for support ticket context.", payload: {} });
  }
  return tools.slice(0, MAX_TOOL_CALLS_PER_TURN);
}

function getKnowledgeChunks(toolResults: any[]) {
  const searchResult = toolResults.find((result) => result?.type === "search_support_knowledge" && result?.ok);
  const chunks = searchResult?.data?.chunks || searchResult?.data?.data?.chunks || [];
  return Array.isArray(chunks) ? chunks.slice(0, 6) : [];
}

function getRealtimeToolResults(toolResults: any[]) {
  return toolResults
    .filter((result) => result?.ok && result?.type !== "search_support_knowledge")
    .map((result) => ({
      type: result.type,
      data: result.data,
    }));
}

function trimContext(payload: unknown) {
  const text = JSON.stringify(payload);
  if (text.length <= MAX_CONTEXT_CHARS) return payload;
  return {
    truncated: true,
    questionClassification: (payload as any)?.questionClassification,
    currentSupportContext: (payload as any)?.currentSupportContext,
    inferredPatch: (payload as any)?.inferredPatch,
    retrievedKnowledge: ((payload as any)?.retrievedKnowledge || []).slice(0, 4).map((chunk: any) => ({
      title: chunk.title,
      category: chunk.category,
      sourceLabel: chunk.sourceLabel,
      text: String(chunk.text || "").slice(0, 900),
    })),
    realtimeToolResults: ((payload as any)?.realtimeToolResults || []).slice(0, 3),
    safeAppContext: (payload as any)?.safeAppContext
      ? {
          user: (payload as any).safeAppContext.user,
          recentPayments: ((payload as any).safeAppContext.recentPayments || []).slice(0, 2),
          recentMatchrooms: ((payload as any).safeAppContext.recentMatchrooms || []).slice(0, 2),
          zones: ((payload as any).safeAppContext.zones || []).slice(0, 2),
        }
      : null,
  };
}

async function callToolGateway(env: Env, body: {
  requestId: string;
  identityToken: string;
  ipKey?: string;
  tools: AgentAction[];
}) {
  const response = await fetch(env.SUPPORT_AGENT_TOOLS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Support-Agent-Service": env.SUPPORT_AI_SHARED_SECRET,
    },
    body: JSON.stringify({
      requestId: body.requestId,
      identityToken: body.identityToken,
      ipKey: body.ipKey,
      tools: body.tools.slice(0, MAX_TOOL_CALLS_PER_TURN),
    }),
  });
  if (!response.ok) return { ok: false, rateLimited: false, results: [] as any[] };
  return await response.json() as { ok: boolean; rateLimited?: boolean; results: any[] };
}

async function recordAgentEvent(env: Env, identityToken: string, id: string, actionType: string, actionStatus: AgentActionStatus, reasonCategory: string) {
  await callToolGateway(env, {
    requestId: id,
    identityToken,
    tools: [{ type: "record_agent_event", payload: { actionType, actionStatus, reasonCategory } }],
  }).catch(() => null);
}

async function callDeepSeek(env: Env, messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  const baseUrl = String(env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL || DEFAULT_MODEL,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) throw new Error("deepseek_unavailable");
  const payload = await response.json() as any;
  const raw = String(payload?.choices?.[0]?.message?.content || "").trim();
  const jsonText = extractJsonObject(raw);
  const parsed = JSON.parse(jsonText);
  if (!parsed?.answer) throw new Error("deepseek_invalid_json");
  return parsed;
}

function validateActions(actions: unknown): AgentAction[] {
  if (!Array.isArray(actions)) return [];
  const valid: AgentAction[] = [];
  for (const action of actions.slice(0, MAX_TOOL_CALLS_PER_TURN) as any[]) {
    const type = String(action?.type || "").slice(0, 80);
    if (!type) continue;
    if (DANGEROUS_ACTIONS.has(type)) {
      valid.push({ type, reason: "dangerous_action_blocked", payload: {} });
      continue;
    }
    if (ALLOWED_ACTIONS.has(type)) {
      valid.push({
        type,
        reason: action?.reason ? redactSupportText(String(action.reason)).slice(0, 200) : undefined,
        payload: typeof action?.payload === "object" && action.payload ? action.payload : {},
      });
    }
  }
  return valid;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = getAllowedOrigin(request, env);
    if (request.method === "OPTIONS") return json({}, 200, origin);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

    const id = requestId();
    const auth = request.headers.get("Authorization") || "";
    const identityToken = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
    if (!identityToken || !env.SUPPORT_AI_SHARED_SECRET) return json({ error: "Unauthorized" }, 401, origin);

    let identity: any;
    try {
      identity = await verifySupportToken(identityToken, env.SUPPORT_AI_SHARED_SECRET);
    } catch {
      return json({ error: "Unauthorized" }, 401, origin);
    }

    const body = await request.json().catch(() => null) as {
      message?: string;
      context?: any;
      history?: Array<{ role?: string; text?: string }>;
      supportEmail?: string;
    } | null;
    const userMessage = redactSupportText(String(body?.message || "").trim()).slice(0, MAX_USER_MESSAGE_CHARS);
    if (!userMessage) return json({ error: "Message is required" }, 400, origin);

    const ipKey = request.headers.get("CF-Connecting-IP") || undefined;
    const context = body?.context || {};
    const inferredPatch = inferPatch(userMessage, context);

    const initialTools = await callToolGateway(env, {
      requestId: id,
      identityToken,
      ipKey,
      tools: [
        { type: "check_rate_limit", reason: "new_ai_turn" },
        { type: "get_user_support_context", reason: "safe_context_for_ai" },
      ],
    });
    if (!initialTools.ok || initialTools.rateLimited) {
      return json({
        answer: "Support AI is receiving too many requests right now. Please wait a minute and try again.",
        contextPatch: { pendingAction: "none" },
        agentMeta: { requestId: id, actionStatus: "rate_limited" },
      }, 429, origin);
    }
    const safeContext = initialTools.results?.find((result) => result.type === "get_user_support_context" && result.ok)?.data || null;

    if (isOffTopic(userMessage, Boolean(context?.currentIssueCategory))) {
      await recordAgentEvent(env, identityToken, id, "off_topic", "denied", "support_scope");
      return json({
        answer: "I can help with MatchHai support only. Tell me what is stuck in your account, matchroom, booking, payment, report, notification, or admin screen.",
        contextPatch: { pendingAction: "none" },
        agentMeta: { requestId: id, intent: "general_help", priority: "low" },
      }, 200, origin);
    }

    const questionClassification = classifySupportQuestion(userMessage, context);
    const contextTools = await callToolGateway(env, {
      requestId: id,
      identityToken,
      ipKey,
      tools: buildContextTools(questionClassification, userMessage),
    });
    if (contextTools.rateLimited) {
      await recordAgentEvent(env, identityToken, id, "context_tools", "rate_limited", questionClassification);
    }
    const contextToolResults = contextTools.ok ? contextTools.results || [] : [];
    const retrievedKnowledge = getKnowledgeChunks(contextToolResults);
    const realtimeToolResults = getRealtimeToolResults(contextToolResults);

    const recentHistory = (body?.history || [])
      .slice(-MAX_RECENT_MESSAGES_SENT)
      .map((item) => ({
        role: item.role === "assistant" ? "assistant" as const : "user" as const,
        content: redactSupportText(String(item.text || "")).slice(0, 700),
      }));

    let planner: any;
    try {
      planner = await callDeepSeek(env, [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "system",
          content: [
            "Grounding context for this turn. Answer from retrievedKnowledge for MatchHai policy/how-to details, and from realtimeToolResults for user-specific status. If either is empty or inconclusive, say the system could not verify it and offer ticket creation.",
            JSON.stringify(trimContext({
            currentSupportContext: context,
            inferredPatch,
            questionClassification,
            retrievedKnowledge,
            realtimeToolResults,
            safeAppContext: safeContext,
            supportEmailConfigured: Boolean(String(body?.supportEmail || env.SUPPORT_EMAIL || "").trim()),
            requestLimits: {
              maxRecentMessages: MAX_RECENT_MESSAGES_SENT,
              maxToolCalls: MAX_TOOL_CALLS_PER_TURN,
            },
            })),
          ].join("\n"),
        },
        ...recentHistory,
        { role: "user", content: userMessage },
      ]);
    } catch {
      await recordAgentEvent(env, identityToken, id, "deepseek_call", "failed", "fallback");
      const fallback = fallbackAgentAnswer(userMessage, context, safeContext);
      return json({
        answer: fallback.answer,
        contextPatch: fallback.contextPatch,
        agentMeta: {
          requestId: id,
          intent: fallback.intent,
          priority: fallback.priority,
          fallback: true,
          questionClassification,
          realtimeTools: realtimeToolResults.map((result) => result.type),
          knowledgeSources: retrievedKnowledge.map((chunk: any) => chunk.sourceLabel).filter(Boolean),
        },
      }, 200, origin);
    }

    const priority = ["low", "medium", "high", "urgent"].includes(planner.priority) ? planner.priority : "medium";
    const intent = String(planner.intent || inferredPatch.currentIssueCategory || "general_help").slice(0, 80);
    let actions = validateActions(planner.actions);
    const userRequestedTicket = wantsTicket(userMessage, context);
    if (wantsModerationReport(userMessage) && !actions.some((action) => action.type === "create_moderation_report")) {
      actions.push({
        type: "create_moderation_report",
        reason: "User requested a moderation report through support chat.",
        payload: {
          type: inferReportType(userMessage),
          reason: inferredPatch.currentIssueSummary || "Report submitted through MatchHai support chat",
          description: userMessage,
        },
      });
    }
    const hadDangerousAction = actions.some((action) => DANGEROUS_ACTIONS.has(action.type));
    if (hadDangerousAction) {
      await recordAgentEvent(env, identityToken, id, "dangerous_action", "denied", "dangerous_action_blocked");
      actions = actions.filter((action) => !DANGEROUS_ACTIONS.has(action.type));
    }
    if (userRequestedTicket && !actions.some((action) => action.type === "create_support_ticket" || action.type === "create_admin_escalation")) {
      actions.push({
        type: "create_support_ticket",
        reason: "User explicitly asked MatchHai support to create a support ticket.",
        payload: {},
      });
    }

    actions = actions.map((action) => {
      if (action.type === "create_support_ticket" || action.type === "create_admin_escalation") {
        return {
          ...action,
          payload: {
            ...action.payload,
            intent,
            priority,
            category: inferredPatch.currentIssueCategory || intent,
            issueSummary: inferredPatch.currentIssueSummary || userMessage,
            suggestedAdminAction: action.payload?.suggestedAdminAction || action.reason || "Review safe support context and follow up with the user.",
            safeContextSnapshot: {
              safeAppContext: safeContext,
              questionClassification,
              realtimeToolResults,
              knowledgeSources: retrievedKnowledge.map((chunk: any) => ({
                title: chunk.title,
                category: chunk.category,
                sourceLabel: chunk.sourceLabel,
              })),
            },
          },
        };
      }
      return action;
    });

    const createTicketAction = actions.find((action) => action.type === "create_support_ticket" || action.type === "create_admin_escalation");
    const shouldAutoCreateTicket = Boolean(createTicketAction && (isUrgentPaymentIssue(userMessage, planner) || userRequestedTicket));
    if (createTicketAction && !shouldAutoCreateTicket && (priority === "low" || priority === "medium")) {
      actions = actions.filter((action) => action !== createTicketAction);
      planner.contextPatch = { ...(planner.contextPatch || {}), pendingAction: "create_ticket", escalationOffered: true };
    }

    let executedResults: any[] = [];
    if (actions.length) {
      const toolResult = await callToolGateway(env, {
        requestId: id,
        identityToken,
        ipKey,
        tools: actions,
      });
      executedResults = toolResult.results || [];
    }

    const createdTicket = executedResults.find((result) => result?.reference);
    const createdReport = executedResults.find((result) => result?.type === "create_moderation_report" && result?.ok);
    const baseAnswer = String(planner.answer || "").trim();
    const answerParts = [
      !createdTicket?.reference && claimsTicketCreated(baseAnswer)
        ? "I can create a support ticket for this issue, but I could not confirm that one was created yet. Please try again or ask me to create a support ticket."
        : baseAnswer,
    ];
    if (createdTicket?.reference) {
      answerParts.push("", `Support ticket created: ${createdTicket.reference}`);
      answerParts.push("Email sending is not configured, so this is an in-app support ticket for the MatchHai team.");
    }
    if (createdReport?.reportId) {
      answerParts.push("", createdReport.created === false
        ? "A similar moderation report already exists and is pending review."
        : "Moderation report created and sent to the Super Admin reports queue.");
    } else if (hadDangerousAction) {
      answerParts.push("", "I cannot perform high-risk account, payment, payout, dispute, or matchroom actions directly. I can escalate this for admin review.");
    }

    return json({
      answer: answerParts.filter(Boolean).join("\n"),
      contextPatch: {
        ...inferredPatch,
        ...(typeof planner.contextPatch === "object" && planner.contextPatch ? planner.contextPatch : {}),
        supportTicketReference: createdTicket?.reference,
        supportTicketEmailSent: false,
        moderationReportCreated: Boolean(createdReport?.reportId),
      },
      agentMeta: {
        requestId: id,
        intent,
        priority,
        confidence: Number(planner.confidence || 0),
        questionClassification,
        realtimeTools: realtimeToolResults.map((result) => result.type),
        knowledgeSources: retrievedKnowledge.map((chunk: any) => chunk.sourceLabel).filter(Boolean),
        actions: executedResults.map((result) => ({
          type: result.type,
          ok: Boolean(result.ok),
          denied: Boolean(result.denied),
          reference: result.reference,
          reportId: result.reportId,
        })),
      },
    }, 200, origin);
  },
};
