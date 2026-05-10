import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import React, { useMemo, useState } from "react";
import { Text } from "react-native";

import { api } from "../../../convex/_generated/api";
import ChatThread from "../chat/ChatThread";
import type { ChatParticipant, ChatThreadMessage } from "../chat/types";
import { useAuth } from "../../context/AuthContext";
import { COLORS } from "../../theme";
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SupportChatScreen({ moduleLabel }: SupportChatScreenProps) {
  const router = useRouter();
  const { user } = useAuth();
  const currentUserId = user?._id || "local-user";
  const supportContext = useQuery(api.support.getMySupportContext, user?._id ? {} : "skip");
  const createSupportTicket = useMutation(api.support.createSupportTicket);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationContext, setConversationContext] =
    useState<SupportConversationContext>(EMPTY_SUPPORT_CONTEXT);
  const [messages, setMessages] = useState<ChatThreadMessage[]>([
    createMessage(
      SUPPORT_BOT_COPY.initialGreeting,
      SUPPORT_BOT_ID,
      SUPPORT_BOT_COPY.botName,
    ),
  ]);

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

  const appendBotMessage = (text: string) => {
    setMessages((current) => [
      ...current,
      createMessage(text, SUPPORT_BOT_ID, SUPPORT_BOT_COPY.botName),
    ]);
  };

  const rememberExchange = (
    userText: string,
    assistantText: string,
    baseContext: SupportConversationContext,
    contextPatch?: Partial<SupportConversationContext>,
  ) => {
    setConversationContext(
      updateSupportContext(baseContext, userText, assistantText, contextPatch, { moduleLabel }),
    );
    appendBotMessage(assistantText);
  };

  const createTicketForContext = async (context: SupportConversationContext) => {
    if (!hasMeaningfulSupportIssue(context)) {
      return SUPPORT_BOT_COPY.missingIssueForTicket;
    }

    if (SUPPORT_DEBUG) {
      console.log("[SupportChat] creating support ticket", {
        category: context.currentIssueCategory,
        subIssue: context.subIssue,
        summary: context.currentIssueSummary,
        historyLength: context.recentMessages.length,
      });
    }

    const result = await createSupportTicket({
      userRole: context.userRole,
      category: context.currentIssueCategory,
      issueSummary: context.currentIssueSummary || "MatchHai support issue",
      conversationExcerpt: context.recentMessages.slice(-8),
      metadata: {
        knownNonSensitiveDetails: context.knownNonSensitiveDetails,
        safeSupportContext: supportContext || null,
      },
    });

    return [
      `Done - I created a support request for this issue.`,
      "",
      `Reference: ${result.reference}`,
      "",
      result.emailSent
        ? "I also sent it to MatchHai Support."
        : "Email sending is not configured in the app yet, so this was created as an in-app support ticket for the MatchHai team.",
    ].join("\n");
  };

  const sendText = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setInput("");
    setSending(true);
    setMessages((current) => [
      ...current,
      createMessage(trimmed, currentUserId, user?.fullName || user?.username || "You"),
    ]);

    const startedAt = Date.now();

    try {
      const nextContext = updateSupportContext(conversationContext, trimmed, undefined, undefined, { moduleLabel });
      let assistantText = "";
      let responseContext = nextContext;
      let contextPatch: Partial<SupportConversationContext> | undefined;
      const actionIntent = getSupportActionIntent(trimmed, conversationContext);

      if (SUPPORT_DEBUG) {
        console.log("[SupportChat] message received", {
          message: trimmed,
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
          const ticketText = await createTicketForContext(nextContext);
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
          if (SUPPORT_DEBUG) {
            console.log("[SupportChat] calling support worker", {
              endpointConfigured: true,
              category: nextContext.currentIssueCategory,
              subIssue: nextContext.subIssue,
              historyLength: nextContext.recentMessages.length,
            });
          }
          const ai = await askSupportAi(trimmed, nextContext, supportContext || null);
          assistantText = ai.answer;
          contextPatch = ai.contextPatch;
          if (SUPPORT_DEBUG) {
            console.log("[SupportChat] worker response received", {
              answerLength: assistantText.length,
              contextPatchKeys: ai.contextPatch ? Object.keys(ai.contextPatch) : [],
            });
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
      rememberExchange(trimmed, assistantText, responseContext, contextPatch);
    } catch {
      const elapsed = Date.now() - startedAt;
      if (elapsed < SUPPORT_TYPING_DELAY_MS) {
        await delay(SUPPORT_TYPING_DELAY_MS - elapsed);
      }
      const fallbackContext = updateSupportContext(conversationContext, trimmed, undefined, undefined, { moduleLabel });
      rememberExchange(
        trimmed,
        buildLocalSupportFallback(trimmed, fallbackContext),
        conversationContext,
        { pendingAction: "none" },
      );
    } finally {
      setSending(false);
    }
  };

  const contextCard = (
    <>
      <Text style={{ color: COLORS.accent, fontFamily: "Montserrat_700Bold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>
        {moduleLabel} support
      </Text>
      <Text style={{ color: COLORS.text, fontFamily: "Montserrat_700Bold", fontSize: 18, marginTop: 4 }}>
        {SUPPORT_BOT_COPY.contextTitle}
      </Text>
      <Text style={{ color: COLORS.textSecondary, marginTop: 4, lineHeight: 18 }}>
        {SUPPORT_BOT_COPY.contextSafety}
      </Text>
    </>
  );

  return (
    <ChatThread
      title={SUPPORT_BOT_COPY.title}
      subtitle={SUPPORT_BOT_COPY.subtitle}
      currentUserId={currentUserId}
      messages={messages}
      participants={participants}
      input={input}
      onInputChange={setInput}
      onBack={() => router.back()}
      onSendText={sendText}
      onToggleRecording={() => undefined}
      sending={sending}
      typingNames={sending ? [SUPPORT_BOT_COPY.botName] : []}
      showComposer
      contextCard={contextCard}
      emptyTitle={SUPPORT_BOT_COPY.emptyTitle}
      emptySubtitle={SUPPORT_BOT_COPY.emptySubtitle}
    />
  );
}
