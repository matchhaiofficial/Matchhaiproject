import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import AppHeader from "../../../src/components/AppHeader";
import Screen from "../../../src/components/Screen";
import { useScreenPadding } from "../../../src/hooks/useScreenPadding";
import { useAuth } from "../../../src/context/AuthContext";
import { COLORS, SPACING } from "../../../src/theme";
import styles from "./chat.styles";
import Logger from "../../../src/utils/logger";
import * as Clipboard from "expo-clipboard";

type ChatMessage = {
  id: string;
  text: string;
  senderUid: string;
  senderName: string;
  createdAt?: number;
  replyTo?: {
    messageId: string;
    senderName: string;
    snippet: string;
  };
  deletedFor?: string[];
};

const GAME_LABELS: Record<string, string> = {
  cs2: "CS2",
  fc26: "FC 26",
  tekken8: "Tekken 8",
  futsal: "Futsal",
  indoor_cricket: "Indoor Cricket",
  padel: "Padel",
  pickleball: "Pickleball",
};

const QUICK_MESSAGES = [
  "On my way",
  "Running late 10m",
  "Start match",
];

export default function MatchroomChat() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const screenPadding = useScreenPadding();

  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [resolvedMatchroomId, setResolvedMatchroomId] = useState<string | null>(null);
  const lastReadMessageId = useRef<string | null>(null);
  const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';

  const chatroomId = typeof id === "string" ? id : "";

  // Try to get matchroom by ID first
  const matchroomById = useQuery(
    api.matchrooms.getById,
    chatroomId ? { matchroomId: chatroomId } : "skip"
  );

  // If not found by ID, try by matchCode
  const matchroomByCode = useQuery(
    api.matchrooms.getByMatchCode,
    chatroomId && matchroomById === null ? { matchCode: chatroomId } : "skip"
  );

  const roomMeta = matchroomById || matchroomByCode;
  const matchroomId = roomMeta?._id;

  // Update resolvedMatchroomId when we find the matchroom
  useEffect(() => {
    if (matchroomId) {
      setResolvedMatchroomId(matchroomId);
    }
  }, [matchroomId]);

  // Get chatroom for this matchroom (real-time)
  const chatroom = useQuery(
    api.chat.getByMatchroom,
    matchroomId ? { matchroomId: matchroomId as Id<"matchrooms"> } : "skip"
  );

  // Get messages for this matchroom (real-time - replaces onSnapshot)
  const rawMessages = useQuery(
    api.chat.listMessagesForMatchroom,
    matchroomId ? { matchroomId: matchroomId as Id<"matchrooms">, limit: 100 } : "skip"
  );

  // Get participant user data
  const participantUids = chatroom?.participantUids || [];
  const participantUserIds = useMemo(
    () => participantUids.filter(Boolean).map((uid) => uid as Id<"users">),
    [participantUids]
  );
  const participantUsers = useQuery(
    api.users.getMany,
    participantUserIds.length > 0 ? { userIds: participantUserIds } : "skip"
  );

  const participantNames = useMemo(() => {
    const names: Record<string, string> = {};
    if (participantUsers) {
      for (const u of participantUsers) {
        if (u) {
          names[u._id] = u.username || u.fullName || "Player";
        }
      }
    }
    if (user?._id && !names[user._id]) {
      names[user._id] = user.fullName || "You";
    }
    return names;
  }, [participantUsers, user?._id, user?.fullName]);

  // Mutations
  const getOrCreateChatroom = useMutation(api.chat.getOrCreateForMatchroom);
  const sendMessageMutation = useMutation(api.chat.sendMessage);
  const deleteForMeMutation = useMutation(api.chat.deleteForMe);
  const markReadMutation = useMutation(api.chat.markRead);

  // Authorization check
  const authorized = useMemo(() => {
    if (!chatroom || !user?._id) return false;
    return chatroom.participantUids.includes(user._id);
  }, [chatroom, user?._id]);

  // Loading state
  const loading = matchroomById === undefined && matchroomByCode === undefined;

  // Auto-create chatroom if host/owner and no chatroom exists
  useEffect(() => {
    if (!matchroomId || !user?._id || !roomMeta) return;
    if (chatroom !== null) return; // Chatroom exists or still loading

    const isHostOrOwner = roomMeta.hostUid === user._id ||
      (roomMeta as any).zoneOwnerUid === user._id;

    if (!isHostOrOwner) return;

    const participantUids = Array.from(new Set([
      roomMeta.hostUid,
      ...((roomMeta as any).playerUids || []),
      ...((roomMeta as any).zoneOwnerUid ? [(roomMeta as any).zoneOwnerUid] : []),
    ].filter(Boolean)));

    getOrCreateChatroom({
      matchroomId: matchroomId as Id<"matchrooms">,
      participantUids,
      zoneId: (roomMeta as any).zoneId,
    }).catch((err: any) => {
      Logger.warn("MatchroomChat", "Chatroom create failed", err);
    });
  }, [matchroomId, user?._id, roomMeta, chatroom]);

  // Transform messages to ChatMessage format
  const messages: ChatMessage[] = useMemo(() => {
    if (!rawMessages) return [];
    return rawMessages.map((msg) => ({
      id: msg._id,
      text: msg.content || "",
      senderUid: msg.senderUid,
      senderName: msg.senderUsername || "Player",
      createdAt: msg.createdAt,
      replyTo: msg.replyTo ? {
        messageId: msg.replyTo.messageId,
        senderName: msg.replyTo.senderName,
        snippet: msg.replyTo.text,
      } : undefined,
      deletedFor: msg.deletedFor,
    }));
  }, [rawMessages]);

  // Mark as read
  const markRead = useCallback(async () => {
    if (!chatroom?._id || !user?._id) return;
    try {
      await markReadMutation({
        chatroomId: chatroom._id,
        userId: user._id,
      });
    } catch (error) {
      Logger.warn("MatchroomChat", "Failed to update lastReadBy", error);
    }
  }, [chatroom?._id, user?._id, markReadMutation]);

  useEffect(() => {
    if (!authorized || !messages.length || !user?._id) return;
    const latest = messages[0];
    if (!latest) return;
    if (latest.id !== lastReadMessageId.current) {
      lastReadMessageId.current = latest.id;
      markRead();
    }
  }, [messages, authorized, markRead, user?._id]);

  useEffect(() => {
    if (!authorized || !chatroom?._id) return;
    markRead();
  }, [authorized, chatroom?._id, markRead]);

  // Send message
  const sendMessage = async (overrideText?: string) => {
    if (!chatroom?._id || !user?._id) {
      Logger.warn("MatchroomChat", "Send skipped due to missing context", {
        chatroomId: chatroom?._id,
        uid: user?._id,
      });
      return;
    }
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed) return;
    setSending(true);
    try {
      const clientMessageId = `${user._id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      await sendMessageMutation({
        chatroomId: chatroom._id,
        senderUid: user._id as Id<"users">,
        senderUsername: user.fullName || user.username || "Player",
        content: trimmed,
        clientMessageId,
        replyTo: replyTo ? {
          messageId: replyTo.id,
          senderName: replyTo.senderName || "Player",
          text: (replyTo.text || "").slice(0, 80),
        } : undefined,
      });

      if (!overrideText) {
        setInput("");
      }
      setReplyTo(null);
    } catch (error) {
      Logger.error("MatchroomChat", "Send failed", error);
      Alert.alert("Send failed", "Unable to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const deleteForMe = async (messageId: string) => {
    if (!user?._id) return;
    try {
      await deleteForMeMutation({
        messageId: messageId as Id<"chatMessages">,
        userId: user._id,
      });
    } catch (error) {
      Logger.warn("MatchroomChat", "deleteForMe failed", error);
    }
  };

  const handleMessageActions = (item: ChatMessage) => {
    Alert.alert(
      "Message options",
      "",
      [
        {
          text: "Reply",
          onPress: () => setReplyTo(item),
        },
        {
          text: "Copy",
          onPress: async () => {
            try {
              await Clipboard.setStringAsync(item.text || "");
            } catch (error) {
              Logger.warn("MatchroomChat", "Copy failed", error);
            }
          },
        },
        {
          text: "Delete for me",
          style: "destructive",
          onPress: () => deleteForMe(item.id),
        },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const lastOutgoingId = useMemo(() => {
    if (!user?._id) return null;
    return messages.find((m) => m.senderUid === user._id)?.id || null;
  }, [messages, user?._id]);

  const roomTitle = roomMeta?.title || "Matchroom Chat";

  const contextCard = useMemo(() => {
    if (!roomMeta) return null;
    const gameLabel = GAME_LABELS[(roomMeta as any).game] || ((roomMeta as any).game ? String((roomMeta as any).game).toUpperCase() : "Matchroom");
    const dateText = (roomMeta as any).scheduledDate ? String((roomMeta as any).scheduledDate) : "Date TBD";
    const timeText = (roomMeta as any).scheduledTime ? String((roomMeta as any).scheduledTime) : "Time TBD";
    const status = (roomMeta as any).status ? String((roomMeta as any).status).replace('-', ' ') : 'open';
    return (
      <View style={styles.contextCard}>
        <View style={styles.contextTopRow}>
          <Text style={styles.contextGame}>{gameLabel}</Text>
          <View style={styles.contextStatusPill}>
            <Text style={styles.contextStatusText}>{status}</Text>
          </View>
        </View>
        <Text style={styles.contextVenue}>{(roomMeta as any).location || "Venue TBD"}</Text>
        <Text style={styles.contextTime}>{dateText} · {timeText}</Text>
      </View>
    );
  }, [roomMeta]);

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMine = item.senderUid === user?._id;
    const bubbleStyle = isMine ? styles.bubbleOutgoing : styles.bubbleIncoming;
    const isLastOutgoing = isMine && item.id === lastOutgoingId;
    let seen = false;
    let seenByNames: string[] = [];
    if (isLastOutgoing && chatroom?.lastReadBy && item.createdAt) {
      const sentAt = item.createdAt;
      const lastReadBy = chatroom.lastReadBy as Record<string, number>;
      const seenEntries = Object.entries(lastReadBy).filter(([uid, ts]) => {
        if (uid === user?._id) return false;
        if (typeof ts !== 'number') return false;
        return ts >= sentAt;
      });
      seen = seenEntries.length > 0;
      seenByNames = seenEntries.map(([uid]) => participantNames[uid] || "Player");
    }
    const seenLabel = seenByNames.length > 0
      ? (seenByNames.length <= 2
        ? `Seen by ${seenByNames.join(", ")}`
        : `Seen by ${seenByNames.slice(0, 2).join(", ")} +${seenByNames.length - 2}`)
      : "";
    const isDeletedForMe = Array.isArray(item.deletedFor) && !!user?._id && item.deletedFor.includes(user._id);
    const avatarLetter = (item.senderName || "P").trim().charAt(0).toUpperCase();
    const timeString = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : "";
    return (
      <View style={[styles.bubbleRow, isMine ? styles.bubbleRowOutgoing : styles.bubbleRowIncoming]}>
        {!isMine && (
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
        )}
        <View style={[styles.bubbleContainer, isMine ? styles.bubbleContainerOutgoing : styles.bubbleContainerIncoming]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => handleMessageActions(item)}
            style={styles.bubbleTouchable}
          >
            <View style={bubbleStyle}>
            {item.replyTo && (
              <View style={styles.replyChip}>
                <Text style={styles.replyLabel}>Replying to {item.replyTo.senderName}</Text>
                <Text style={styles.replySnippet} numberOfLines={1}>{item.replyTo.snippet}</Text>
              </View>
            )}
            {isDeletedForMe ? (
              <Text style={styles.deletedText}>Message deleted</Text>
            ) : (
              <Text style={styles.bubbleText}>{item.text}</Text>
            )}
            <Text style={isLastOutgoing && seen ? styles.bubbleStatus : styles.bubbleTime}>
              {timeString}
              {isLastOutgoing && seen ? " · Seen" : ""}
            </Text>
            {isLastOutgoing && seen && seenLabel ? (
              <Text style={styles.seenByText}>{seenLabel}</Text>
            ) : null}
            </View>
          </TouchableOpacity>
        </View>
        {isMine && (
          <View style={[styles.avatarWrap, styles.avatarWrapRight]}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen
      style={styles.screen}
      scroll={false}
      debugTag="MatchroomChat"
      contentStyle={styles.screenContent}
    >
      <View style={[styles.headerWrap, { paddingHorizontal: screenPadding }]}>
        <AppHeader title={roomTitle} onBack={() => router.back()} inlineTitle />
      </View>

      {loading ? (
        <View style={styles.content}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : !authorized ? (
        <View style={styles.content}>
          <View style={styles.infoBanner}>
            <Text style={styles.infoTitle}>Access restricted</Text>
            <Text style={styles.infoSubtitle}>Only matchroom participants and the venue owner can view this chat.</Text>
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <FlatList
            contentContainerStyle={[
              styles.messageList,
              {
                paddingTop: SPACING.xs,
                paddingBottom: SPACING.sm,
                paddingHorizontal: screenPadding,
              },
            ]}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            inverted
            keyboardShouldPersistTaps="always"
            ListFooterComponent={contextCard ? <View style={styles.contextWrapper}>{contextCard}</View> : null}
          />

          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
            <View style={styles.inputInner}>
              {replyTo && (
              <View style={styles.replyBar}>
                <View style={styles.replyContent}>
                  <Text style={styles.replyTitle}>Replying to {replyTo.senderName || "Player"}</Text>
                  <Text style={styles.replyText} numberOfLines={1}>{replyTo.text}</Text>
                </View>
                <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyClose}>
                  <MaterialIcons name="close" size={16} color={COLORS.muted} />
                </TouchableOpacity>
              </View>
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickChips}
                keyboardShouldPersistTaps="handled"
              >
              {QUICK_MESSAGES.map((msg) => (
                <TouchableOpacity
                  key={msg}
                  style={styles.quickChip}
                  onPressIn={() => {
                    if (touchDebugEnabled) {
                      Logger.debug("TouchDebug", "pressIn", { tag: "chat_quick_chip", text: msg });
                    }
                  }}
                  onPress={() => {
                    if (touchDebugEnabled) {
                      Logger.debug("TouchDebug", "press", { tag: "chat_quick_chip", text: msg });
                    }
                    sendMessage(msg);
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={styles.quickChipText}>{msg}</Text>
                </TouchableOpacity>
              ))}
              </ScrollView>
              <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Message"
                placeholderTextColor={COLORS.muted}
                value={input}
                onChangeText={setInput}
                multiline
              />
              <Pressable
                style={({ pressed }) => [
                  styles.sendButton,
                  pressed && !sending && styles.sendButtonPressed,
                  sending && styles.sendButtonDisabled,
                ]}
                onPressIn={() => {
                  if (touchDebugEnabled) {
                    Logger.debug("TouchDebug", "pressIn", { tag: "chat_send_button" });
                  }
                }}
                onPress={() => {
                  if (touchDebugEnabled) {
                    Logger.debug("TouchDebug", "press", { tag: "chat_send_button" });
                  }
                  sendMessage();
                }}
                disabled={sending}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="send" size={18} color={COLORS.backgroundDark} />
              </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
