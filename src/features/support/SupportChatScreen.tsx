import { useRouter } from "expo-router";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import ChatThread from "../chat/ChatThread";
import type { ChatParticipant, ChatThreadMessage } from "../chat/types";
import { useAuth } from "../../context/AuthContext";
import { SUPPORT_RESPONSE_SLA } from "../../config/support";
import { COLORS, FONTS } from "../../theme";
import {
  EMPTY_SUPPORT_CONTEXT,
  SUPPORT_BOT_COPY,
  askSupportAi,
  buildLocalSupportFallback,
  buildRepeatedResponseFallback,
  buildSupportEmailDraft,
  getSupportActionIntent,
  hasMeaningfulSupportIssue,
  isObviousOffTopic,
  isRepeatedResponse,
  isSensitiveInput,
  shouldCallSupportAi,
  updateSupportContext,
  type SupportConversationContext,
} from "./supportAssistant";

type SupportChatScreenProps = {
  moduleLabel: "Player" | "Zone Admin" | "Super Admin";
};

const SUPPORT_BOT_ID = "matchhai-support-ai";
const SUPPORT_TYPING_DELAY_MS = 3000;
const SUPPORT_DEBUG = process.env.EXPO_PUBLIC_SUPPORT_DEBUG === "1";
const CONNECTION_RETRY_DELAY_MS = 900;
const CONNECTION_MAX_AUTO_RETRIES = 8;
const SUPPORT_INACTIVITY_REFRESH_MS = 5 * 60 * 1000;
const QUICK_ACTIONS = [
  "Matchroom pending",
  "Payment deducted",
  "Refund status",
  "Team challenge issue",
  "Zone booking issue",
  "Create support ticket",
];

type ConversationConnectionState = "connecting" | "ready" | "failed";

function createMessage(
  text: string,
  senderUid: string,
  senderName: string,
): ChatThreadMessage {
  return {
    id: `${senderUid}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text,
    senderUid,
    senderName,
    createdAt: Date.now(),
    type: "text",
  };
}

function normalizeMessageSignature(text: string) {
  return String(text || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getMessageSignature(message: Pick<ChatThreadMessage, "senderUid" | "text">) {
  return `${message.senderUid}:${normalizeMessageSignature(message.text)}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function wantsSupportEmail(input: string) {
  return /\b(email|send to support|contact support|contact admin|report)\b/i.test(input);
}

function getSupportWorkLabel(input: string) {
  const text = input.trim().toLowerCase();
  if (/\b(refund|refunded|money back)\b/.test(text)) return "Checking your refund status...";
  if (/\b(payment|paid|deducted|charged|wallet|top[ -]?up|easypaisa|booking)\b/.test(text)) return "Checking your payment status...";
  if (/\b(team challenge|challenge|challenged|opponent team)\b/.test(text)) return "Checking your team challenge...";
  if (/\b(zone|venue|branch|zone booking|booking request)\b/.test(text)) return "Checking your zone booking...";
  if (/\b(matchroom|match room|lobby|slot|room pending)\b/.test(text)) return "Checking your matchroom...";
  return "Checking MatchHai support info...";
}

function buildSupportCards(input: string, answer: string, supportContext: any): ChatThreadMessage["supportCards"] | undefined {
  const text = `${input} ${answer}`.toLowerCase();
  const matchrooms = Array.isArray(supportContext?.recentMatchrooms) ? supportContext.recentMatchrooms : [];
  if (!matchrooms.length) return undefined;
  if (!/\b(matchroom|result|booking|pending|lobby|fc|fifa|valorant|pubg|cs2|4am|4 am|may)\b/.test(text)) return undefined;
  const cards = matchrooms
    .filter((room: any) => {
      const haystack = `${room.title || ""} ${room.game || ""} ${room.status || ""}`.toLowerCase();
      return text.includes("matchroom") || text.includes("result") || text.includes("pending") || haystack.split(/\s+/).some((part) => part.length > 2 && text.includes(part));
    })
    .slice(0, 3)
    .map((room: any) => ({
      id: String(room.id || room._id),
      title: room.title || room.name || "Matchroom",
      game: room.game,
      status: room.status,
      scheduledAt: room.scheduledAt || room.startTime || room.createdAt,
      bookingStatus: room.bookingStatus,
      paymentStatus: room.paymentStatus,
      resultStatus: room.resultStatus || room.verificationStatus,
    }));
  return cards.length ? { matchrooms: cards } : undefined;
}

export default function SupportChatScreen({ moduleLabel }: SupportChatScreenProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { isAuthenticated: convexAuthenticated, isLoading: convexAuthLoading } = useConvexAuth();
  const currentUserId = user?._id || "local-user";
  const supportReady = Boolean(user?._id && convexAuthenticated && !convexAuthLoading);
  const supportContext = useQuery(api.support.getMySupportContext, supportReady ? {} : "skip");
  const createSupportTicket = useMutation(api.support.createSupportTicket);
  const sendSupportTicketEmail = useAction(api.supportEmail.sendSupportTicketEmail);
  const getOrCreateConversation = useMutation(api.support.getOrCreateConversation);
  const appendUserMessage = useMutation(api.support.appendUserMessage);
  const appendAssistantMessage = useMutation(api.support.appendAssistantMessage);
  const issueWorkerToken = useMutation(api.support.issueWorkerToken);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const persistedMessages = useQuery(
    api.support.listConversationMessages,
    supportReady && conversationId ? { conversationId: conversationId as any, limit: 50 } : "skip",
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [supportWorkLabel, setSupportWorkLabel] = useState<string | null>(null);
  const [transientMessages, setTransientMessages] = useState<ChatThreadMessage[]>([]);
  const pendingUserMessageSignaturesRef = useRef(new Set<string>());
  const [conversationRetry, setConversationRetry] = useState(0);
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [connectionState, setConnectionState] = useState<ConversationConnectionState>("connecting");
  const [connectionErrorCategory, setConnectionErrorCategory] = useState<string | null>(null);
  const [conversationContext, setConversationContext] =
    useState<SupportConversationContext>(EMPTY_SUPPORT_CONTEXT);
  const activeConnectionAttemptRef = useRef(0);
  const lastActivityAtRef = useRef(Date.now());
  const module = moduleLabel === "Zone Admin" ? "zone_admin" : moduleLabel === "Super Admin" ? "super_admin" : "player";
  const conversationReady = connectionState === "ready" && Boolean(conversationId);
  const composerDisabled = sending || !conversationReady;

  const refreshAfterInactivity = useCallback(() => {
    setTransientMessages([]);
    setConversationContext(EMPTY_SUPPORT_CONTEXT);
    setConversationId(null);
    setAutoRetryCount(0);
    setConnectionState("connecting");
    setConversationRetry((current) => current + 1);
    if (SUPPORT_DEBUG) {
      console.log("[SupportChat] conversation refreshed after inactivity");
    }
  }, []);

  const markActivity = useCallback(() => {
    lastActivityAtRef.current = Date.now();
  }, []);

  const connectConversation = useCallback(async () => {
    const attempt = activeConnectionAttemptRef.current + 1;
    activeConnectionAttemptRef.current = attempt;
    if (!supportReady) {
      setConnectionState("connecting");
      setConnectionErrorCategory(null);
      if (SUPPORT_DEBUG) {
        console.log("[SupportChat] conversation initialization waiting", {
          reason: "support_not_ready",
          hasUser: Boolean(user?._id),
          convexAuthenticated,
          convexAuthLoading,
        });
      }
      return null;
    }

    setConnectionState("connecting");
    setConnectionErrorCategory(null);
    if (SUPPORT_DEBUG) {
      console.log("[SupportChat] conversation initialization started", {
        attempt,
        module,
        hasUser: Boolean(user?._id),
        convexAuthenticated,
        convexAuthLoading,
      });
    }

    try {
      const result: any = await getOrCreateConversation({ module });
      if (activeConnectionAttemptRef.current !== attempt) {
        if (SUPPORT_DEBUG) {
          console.log("[SupportChat] conversation initialization ignored", { reason: "stale_attempt", attempt });
        }
        return null;
      }
      if (result?.authRequired || !result?.conversationId) {
        setConnectionState("failed");
        setConnectionErrorCategory("auth_not_ready");
        if (SUPPORT_DEBUG) {
          console.log("[SupportChat] conversation initialization failed", {
            category: "auth_not_ready",
            attempt,
            authRequired: Boolean(result?.authRequired),
          });
        }
        return null;
      }

      const nextConversationId = String(result.conversationId);
      setConversationId(nextConversationId);
      setConnectionState("ready");
      setConnectionErrorCategory(null);
      setAutoRetryCount(0);
      if (SUPPORT_DEBUG) {
        console.log("[SupportChat] conversation initialization success", {
          conversationId: nextConversationId,
          attempt,
        });
      }
      return nextConversationId;
    } catch {
      if (activeConnectionAttemptRef.current !== attempt) return null;
      setConnectionState("failed");
      setConnectionErrorCategory("convex_error");
      if (SUPPORT_DEBUG) {
        console.log("[SupportChat] conversation initialization failed", {
          category: "convex_error",
          attempt,
        });
      }
      return null;
    }
  }, [convexAuthLoading, convexAuthenticated, getOrCreateConversation, module, supportReady, user?._id]);

  useEffect(() => {
    let cancelled = false;
    if (!supportReady) {
      setConversationId(null);
      if (!convexAuthLoading && user?._id && !convexAuthenticated) {
        setConnectionState("failed");
        setConnectionErrorCategory("auth_not_ready");
        if (SUPPORT_DEBUG) {
          console.log("[SupportChat] conversation initialization blocked", {
            reason: "convex_auth_not_authenticated",
            hasUser: Boolean(user?._id),
            convexAuthenticated,
            convexAuthLoading,
          });
        }
      } else {
        setConnectionState("connecting");
        setConnectionErrorCategory(null);
      }
      return;
    }
    void connectConversation().then((nextConversationId) => {
      if (cancelled || nextConversationId) return;
    });
    return () => {
      cancelled = true;
    };
  }, [connectConversation, conversationRetry, convexAuthLoading, convexAuthenticated, supportReady, user?._id]);

  useEffect(() => {
    if (conversationReady || connectionState !== "failed" || !supportReady) return;
    if (autoRetryCount >= CONNECTION_MAX_AUTO_RETRIES) return;
    const retryTimer = setTimeout(() => {
      if (SUPPORT_DEBUG) {
        console.log("[SupportChat] conversation initialization retry scheduled", {
          nextRetry: autoRetryCount + 1,
          category: connectionErrorCategory || "unknown",
        });
      }
      setAutoRetryCount((current) => current + 1);
      setConversationRetry((current) => current + 1);
    }, CONNECTION_RETRY_DELAY_MS);
    return () => clearTimeout(retryTimer);
  }, [autoRetryCount, connectionErrorCategory, connectionState, conversationReady, supportReady]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() - lastActivityAtRef.current >= SUPPORT_INACTIVITY_REFRESH_MS) {
        lastActivityAtRef.current = Date.now();
        refreshAfterInactivity();
      }
    }, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && Date.now() - lastActivityAtRef.current >= SUPPORT_INACTIVITY_REFRESH_MS) {
        lastActivityAtRef.current = Date.now();
        refreshAfterInactivity();
      }
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refreshAfterInactivity]);

  useEffect(() => {
    const rows = Array.isArray(persistedMessages) ? persistedMessages : [];
    if (!rows.length || pendingUserMessageSignaturesRef.current.size === 0) return;
    const persistedSignatures = new Set(
      rows
        .filter((message: any) => message.role === "user")
        .map((message: any) => `${currentUserId}:${normalizeMessageSignature(String(message.textRedacted || ""))}`),
    );
    const hasPersistedPendingMessage = Array.from(pendingUserMessageSignaturesRef.current)
      .some((signature) => persistedSignatures.has(signature));
    if (!hasPersistedPendingMessage) return;
    setTransientMessages((current) =>
      current.filter((message) => {
        if (message.senderUid !== currentUserId) return true;
        const signature = getMessageSignature(message);
        if (!pendingUserMessageSignaturesRef.current.has(signature) || !persistedSignatures.has(signature)) {
          return true;
        }
        pendingUserMessageSignaturesRef.current.delete(signature);
        return false;
      }),
    );
  }, [currentUserId, persistedMessages]);

  const messages = useMemo<ChatThreadMessage[]>(() => {
    const rows = Array.isArray(persistedMessages) ? persistedMessages : [];
    const mapped = rows.map((message: any) => ({
      id: String(message._id),
      text: String(message.textRedacted || ""),
      senderUid: message.role === "user" ? currentUserId : SUPPORT_BOT_ID,
      senderName: message.role === "user" ? user?.fullName || user?.username || "You" : SUPPORT_BOT_COPY.botName,
      createdAt: Number(message.createdAt || Date.now()),
      type: "text" as const,
      supportCards: message.metadata?.supportCards,
    }));

    const persistedOutgoingSignatures = new Set(
      mapped
        .filter((message) => message.senderUid === currentUserId)
        .map(getMessageSignature),
    );

    const visibleTransientMessages = transientMessages.filter((message) => {
      if (message.senderUid !== currentUserId) return true;
      return !persistedOutgoingSignatures.has(getMessageSignature(message));
    });

    if (mapped.length) return [...mapped, ...visibleTransientMessages];
    return [
      createMessage(
        SUPPORT_BOT_COPY.initialGreeting,
        SUPPORT_BOT_ID,
        SUPPORT_BOT_COPY.botName,
      ),
      ...visibleTransientMessages,
    ];
  }, [currentUserId, persistedMessages, transientMessages, user?.fullName, user?.username]);

  const participants = useMemo<ChatParticipant[]>(
    () => [
      {
        uid: SUPPORT_BOT_ID,
        label: SUPPORT_BOT_COPY.botName,
      },
      {
        uid: currentUserId,
        label: user?.fullName || user?.username || moduleLabel,
        photoURL: user?.photoURL || null,
      },
    ],
    [currentUserId, moduleLabel, user?.fullName, user?.photoURL, user?.username],
  );

  const rememberExchange = (
    userText: string,
    assistantText: string,
    baseContext: SupportConversationContext,
    contextPatch?: Partial<SupportConversationContext>,
    agentMeta?: Record<string, unknown>,
    targetConversationId?: string | null,
  ) => {
    setConversationContext(
      updateSupportContext(baseContext, userText, assistantText, contextPatch, { moduleLabel }),
    );
    const activeConversationId = targetConversationId || conversationId;
    if (activeConversationId) {
      void appendAssistantMessage({
        conversationId: activeConversationId as any,
        text: assistantText,
        metadata: agentMeta,
      }).catch(() => null);
    } else {
      setTransientMessages((current) => [
        ...current,
        createMessage(assistantText, SUPPORT_BOT_ID, SUPPORT_BOT_COPY.botName),
      ]);
    }
  };

  const createTicketForContext = async (
    context: SupportConversationContext,
    targetConversationId?: string | null,
    options?: { emailRequested?: boolean },
  ) => {
    if (!hasMeaningfulSupportIssue(context)) {
      return SUPPORT_BOT_COPY.missingIssueForTicket;
    }

    if (SUPPORT_DEBUG) {
      console.log("[SupportChat] creating support ticket", {
        category: context.currentIssueCategory,
        subIssue: context.subIssue,
        historyLength: context.recentMessages.length,
      });
    }

    const result = await createSupportTicket({
      userRole: context.userRole,
      category: context.currentIssueCategory,
      subcategory: context.subIssue,
      intent: context.lastUserIntent,
      priority: "medium",
      issueSummary: context.currentIssueSummary || "MatchHai support issue",
      conversationExcerpt: context.recentMessages.slice(-8),
      conversationId: targetConversationId ? targetConversationId as any : conversationId ? conversationId as any : undefined,
      metadata: {
        knownNonSensitiveDetails: context.knownNonSensitiveDetails,
        safeSupportContext: supportContext || null,
      },
    });

    let emailStatus: "sent" | "failed" | "not_configured" | undefined;
    if (options?.emailRequested) {
      try {
        const emailResult = await sendSupportTicketEmail({ ticketId: result.ticketId as any });
        emailStatus = emailResult.emailStatus;
      } catch {
        emailStatus = "failed";
      }
    }

    return [
      `Done - I created a support request for this issue.`,
      "",
      `Reference: ${result.reference}`,
      "",
      emailStatus === "sent"
        ? "I also emailed it to MatchHai Support."
        : emailStatus === "failed"
          ? "I could not send the email, but the in-app ticket is available for the MatchHai team."
          : "Email sending is not configured or was not requested, so this was created as an in-app support ticket for the MatchHai team.",
    ].join("\n");
  };

  const ensureConversationId = async () => {
    if (conversationId) return conversationId;
    return await connectConversation();
  };

  const sendText = async () => {
    const trimmed = input.trim();
    if (!trimmed || composerDisabled) return;
    markActivity();

    setInput("");
    setSending(true);
    const localUserMessage = createMessage(
      trimmed,
      currentUserId,
      user?.fullName || user?.username || "You",
    );
    const localUserMessageSignature = getMessageSignature(localUserMessage);
    pendingUserMessageSignaturesRef.current.add(localUserMessageSignature);
    setTransientMessages((current) => [...current, localUserMessage]);

    const startedAt = Date.now();

    try {
      const activeConversationId = await ensureConversationId();
      if (!activeConversationId) {
        setTransientMessages((current) => current.filter((message) => message.id !== localUserMessage.id));
        return;
      }

      await appendUserMessage({ conversationId: activeConversationId as any, text: trimmed });

      const nextContext = updateSupportContext(conversationContext, trimmed, undefined, undefined, { moduleLabel });
      let assistantText = "";
      let responseContext = nextContext;
      let contextPatch: Partial<SupportConversationContext> | undefined;
      let agentMeta: Record<string, unknown> | undefined;
      const actionIntent = getSupportActionIntent(trimmed, conversationContext);

      if (SUPPORT_DEBUG) {
        console.log("[SupportChat] message received", {
          actionIntent,
          currentIssueCategory: nextContext.currentIssueCategory,
          subIssue: nextContext.subIssue,
          historyLength: nextContext.recentMessages.length,
        });
      }

      if (actionIntent === "draft_email") {
        if (hasMeaningfulSupportIssue(nextContext)) {
          assistantText = buildSupportEmailDraft(nextContext);
        } else {
          assistantText = SUPPORT_BOT_COPY.missingIssueForEmail;
        }
        contextPatch = { pendingAction: "none", lastAssistantQuestion: undefined };
      } else if (actionIntent === "create_ticket") {
        if (!hasMeaningfulSupportIssue(nextContext)) {
          assistantText = SUPPORT_BOT_COPY.missingIssueForTicket;
          contextPatch = { pendingAction: "none", escalationOffered: false, lastAssistantQuestion: undefined };
        } else if (conversationContext.supportTicketReference) {
          assistantText = [
            `This support request is already created: ${conversationContext.supportTicketReference}.`,
            "",
            conversationContext.supportTicketEmailSent
              ? "It was also sent to MatchHai Support."
              : "Email sending is not configured yet, so I cannot truthfully say it was emailed. The in-app support request is available for the MatchHai team to review.",
          ].join("\n");
          contextPatch = { pendingAction: "none", escalationOffered: false, lastAssistantQuestion: undefined };
        } else {
          const ticketText = await createTicketForContext(nextContext, activeConversationId, {
            emailRequested: wantsSupportEmail(trimmed),
          });
          const referenceMatch = ticketText.match(/Reference:\s*(MH-SUP-[A-Z0-9]+)/);
          assistantText = ticketText;
          contextPatch = {
            pendingAction: "none",
            escalationOffered: false,
            lastAssistantQuestion: undefined,
            supportTicketReference: referenceMatch?.[1],
            supportTicketEmailSent: ticketText.includes("I also sent it"),
          };
        }
      } else if (isSensitiveInput(trimmed)) {
        assistantText = SUPPORT_BOT_COPY.sensitiveReminder;
        contextPatch = { pendingAction: "none" };
      } else if (isObviousOffTopic(trimmed, conversationContext)) {
        assistantText = SUPPORT_BOT_COPY.offTopic;
        contextPatch = { pendingAction: "none" };
      } else {
        if (shouldCallSupportAi(trimmed, nextContext)) {
          setSupportWorkLabel(getSupportWorkLabel(trimmed));
          if (SUPPORT_DEBUG) {
            console.log("[SupportChat] Worker call started");
          }
          const token = await issueWorkerToken({ module, conversationId: activeConversationId as any });
          const ai = await askSupportAi(trimmed, nextContext, {
            token: String((token as any).token),
            conversationId: activeConversationId,
          });
          assistantText = ai.answer;
          contextPatch = ai.contextPatch;
          agentMeta = {
            ...(ai.agentMeta || {}),
            supportCards: buildSupportCards(trimmed, ai.answer, supportContext),
          };
          if (SUPPORT_DEBUG) {
            console.log("[SupportChat] Worker call success", { status: 200 });
          }

          if (isRepeatedResponse(conversationContext, assistantText)) {
            assistantText = [
              "I have that context noted.",
              "",
              "To move forward, answer the last question with the missing detail, or say \"create support request\" and I will open a ticket for the MatchHai team.",
            ].join("\n");
            contextPatch = { pendingAction: "create_ticket", escalationOffered: true };
          }
        } else {
          if (SUPPORT_DEBUG) {
            console.log("[SupportChat] using local fallback", {
              category: nextContext.currentIssueCategory,
              subIssue: nextContext.subIssue,
              historyLength: nextContext.recentMessages.length,
            });
          }
          assistantText = buildLocalSupportFallback(trimmed, nextContext);
          agentMeta = {
            supportCards: buildSupportCards(trimmed, assistantText, supportContext),
          };
          contextPatch = { pendingAction: "none" };
        }
      }

      if (assistantText && isRepeatedResponse(conversationContext, assistantText)) {
        assistantText = buildRepeatedResponseFallback({ ...responseContext, ...(contextPatch || {}) });
        contextPatch = { ...(contextPatch || {}), pendingAction: "none", lastAssistantQuestion: "clarify_without_repeating" };
      }

      const elapsed = Date.now() - startedAt;
      if (elapsed < SUPPORT_TYPING_DELAY_MS) {
        await delay(SUPPORT_TYPING_DELAY_MS - elapsed);
      }
      rememberExchange(trimmed, assistantText, responseContext, contextPatch, agentMeta, activeConversationId);
    } catch (error) {
      pendingUserMessageSignaturesRef.current.delete(localUserMessageSignature);
      setTransientMessages((current) => current.filter((message) => message.id !== localUserMessage.id));
      if (SUPPORT_DEBUG) {
        const status = typeof (error as any)?.status === "number" ? (error as any).status : "unknown";
        console.log("[SupportChat] Worker call failure", { status });
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed < SUPPORT_TYPING_DELAY_MS) {
        await delay(SUPPORT_TYPING_DELAY_MS - elapsed);
      }
      const fallbackContext = updateSupportContext(conversationContext, trimmed, undefined, undefined, { moduleLabel });
      const fallbackAnswer = buildLocalSupportFallback(trimmed, fallbackContext);
      const fallbackText = isRepeatedResponse(conversationContext, fallbackAnswer)
        ? buildRepeatedResponseFallback(fallbackContext)
        : fallbackAnswer;
      rememberExchange(
        trimmed,
        fallbackText,
        conversationContext,
        { pendingAction: "none" },
        { supportCards: buildSupportCards(trimmed, fallbackText, supportContext) },
        conversationId,
      );
    } finally {
      setSupportWorkLabel(null);
      setSending(false);
    }
  };

  const contextCard = (
    <>
      <Text style={styles.contextEyebrow}>
        {moduleLabel} support
      </Text>
      <Text style={styles.contextTitle}>
        {SUPPORT_BOT_COPY.contextTitle}
      </Text>
      <Text style={styles.contextSafety}>
        {SUPPORT_BOT_COPY.contextSafety}
      </Text>
      {conversationContext.supportTicketReference ? (
        <View style={styles.ticketBanner}>
          <Text style={styles.ticketBannerTitle}>Support ticket created</Text>
          <Text style={styles.ticketBannerText}>Reference: {conversationContext.supportTicketReference}</Text>
          <Text style={styles.ticketBannerMeta}>Status: Open | {SUPPORT_RESPONSE_SLA}</Text>
        </View>
      ) : null}
      <View style={styles.quickActions}>
        {QUICK_ACTIONS.map((label) => (
          <Pressable
            key={label}
            style={({ pressed }) => [styles.quickChip, pressed && styles.quickChipPressed]}
            onPress={() => {
              markActivity();
              setInput(label);
            }}
            disabled={composerDisabled}
          >
            <Text style={styles.quickChipText}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );

  const composerStatus = !conversationReady ? (
    <View style={connectionState === "failed" ? styles.connectionBannerError : styles.connectionBanner}>
      <Text style={styles.connectionText}>
        {connectionState === "failed"
          ? "Couldn't connect to support. Please retry."
          : "Connecting to MatchHai Support..."}
      </Text>
      {connectionState === "failed" ? (
        <Pressable
          onPress={() => {
            setAutoRetryCount(0);
            setConversationRetry((current) => current + 1);
          }}
          style={({ pressed }) => [styles.retryButton, pressed && styles.quickChipPressed]}
        >
          <Text style={styles.retryButtonText}>Retry connecting</Text>
        </Pressable>
      ) : null}
      {SUPPORT_DEBUG && connectionErrorCategory ? (
        <Text style={styles.connectionDebugText}>Debug: {connectionErrorCategory}</Text>
      ) : null}
    </View>
  ) : supportWorkLabel ? (
    <View style={styles.connectionBanner}>
      <Text style={styles.connectionText}>{supportWorkLabel}</Text>
    </View>
  ) : null;

  return (
    <ChatThread
      title={SUPPORT_BOT_COPY.title}
      subtitle={SUPPORT_BOT_COPY.subtitle}
      currentUserId={currentUserId}
      messages={messages}
      participants={participants}
      input={input}
      onInputChange={(value) => {
        markActivity();
        setInput(value);
      }}
      onBack={() => router.back()}
      onSendText={sendText}
      onToggleRecording={() => undefined}
      sending={sending}
      typingNames={sending ? [SUPPORT_BOT_COPY.botName] : []}
      showComposer
      composerDisabled={composerDisabled}
      composerPlaceholder={conversationReady ? "Type message..." : "Connecting to support..."}
      composerStatus={composerStatus}
      contextCard={contextCard}
      emptyTitle={SUPPORT_BOT_COPY.emptyTitle}
      emptySubtitle={SUPPORT_BOT_COPY.emptySubtitle}
    />
  );
}

const styles = StyleSheet.create({
  contextEyebrow: {
    color: COLORS.accent,
    fontFamily: FONTS.heading,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  contextTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 18,
    marginTop: 4,
  },
  contextSafety: {
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  ticketBanner: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.overlayLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.accent,
  },
  ticketBannerText: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 12,
  },
  ticketBannerTitle: {
    color: COLORS.accent,
    fontFamily: FONTS.heading,
    fontSize: 13,
  },
  ticketBannerMeta: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardDark,
  },
  quickChipPressed: {
    opacity: 0.85,
  },
  quickChipText: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 12,
  },
  connectionBanner: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: COLORS.overlayLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.cardBorder,
  },
  connectionBannerError: {
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: COLORS.overlayLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.error,
  },
  connectionText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.interSemiBold,
    fontSize: 12,
  },
  connectionDebugText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 6,
  },
  retryButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
  },
  retryButtonText: {
    color: COLORS.background,
    fontFamily: FONTS.interSemiBold,
    fontSize: 12,
  },
});
