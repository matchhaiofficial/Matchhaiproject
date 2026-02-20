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
import AppHeader from "../../../src/components/AppHeader";
import Screen from "../../../src/components/Screen";
import { useScreenPadding } from "../../../src/hooks/useScreenPadding";
import { useAuth } from "../../../src/context/AuthContext";
import { addDocToCollection, arrayUnionValue, fetchDoc, fetchDocs, serverTimestampValue, setDocByPath, subscribeDoc, subscribeDocs, updateDocByPath } from "../../../src/services/firestoreService";
import { COLORS, SPACING } from "../../../src/theme";
import styles from "./chat.styles";
import Logger from "../../../src/utils/logger";
import * as Clipboard from "expo-clipboard";

type ChatMessage = {
  id: string;
  text: string;
  senderUid: string;
  senderName: string;
  createdAt?: any;
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

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [roomTitle, setRoomTitle] = useState<string>("Matchroom Chat");
  const [roomMeta, setRoomMeta] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [roomDocId, setRoomDocId] = useState<string>("");
  const [chatMeta, setChatMeta] = useState<any>(null);
  const [participantNames, setParticipantNames] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const lastReadMessageId = useRef<string | null>(null);
  const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';

  const chatroomId = typeof id === "string" ? id : "";
  const activeRoomId = roomDocId || chatroomId;

  const checkAuthorization = useCallback(async () => {
    if (!chatroomId || !user?.uid) return;
    setLoading(true);
    try {
      Logger.info("MatchroomChat", "Access check start", { chatroomId, uid: user.uid });
      let resolvedId = chatroomId;
      let roomSnap = await fetchDoc<any>(["matchrooms", resolvedId]);
      if (!roomSnap.exists) {
        const qs = await fetchDocs({
          collectionPath: ["matchrooms"],
          where: [{ field: "matchCode", op: "==", value: chatroomId }],
          limit: 1,
        });
        if (qs.length > 0) {
          resolvedId = qs[0].id;
          roomSnap = { exists: true, id: qs[0].id, data: qs[0].data };
          setRoomDocId(resolvedId);
          Logger.info("MatchroomChat", "Resolved matchCode to docId", { chatroomId, resolvedId });
        } else {
          Logger.warn("MatchroomChat", "No matchroom found for code", { chatroomId });
        }
      }
      if (!roomSnap.exists) {
        setAuthorized(false);
        setLoading(false);
        Logger.warn("MatchroomChat", "Room not found", { chatroomId, resolvedId });
        return;
      }
      const roomData: any = roomSnap.data;
      setRoomTitle(roomData.title || "Matchroom Chat");
      setRoomMeta(roomData);

      const tryGetChatroom = async () => {
        try {
          return await fetchDoc<any>(["chatrooms", resolvedId]);
        } catch (err) {
          Logger.warn("MatchroomChat", "Chatroom read failed", { resolvedId, err });
          return null;
        }
      };

      let chatSnap = await tryGetChatroom();
      if ((!chatSnap || !chatSnap.exists) && (roomData.hostUid === user.uid || roomData.zoneOwnerUid === user.uid)) {
        try {
          const participantUids = Array.from(new Set([
            roomData.hostUid,
            ...(roomData.playerUids || []),
            ...(roomData.zoneOwnerUid ? [roomData.zoneOwnerUid] : []),
          ].filter(Boolean)));
          await setDocByPath(["chatrooms", resolvedId], {
            matchroomId: resolvedId,
            zoneId: roomData.zoneId || null,
            participantUids,
            lastMessage: null,
            lastReadBy: {},
            createdAt: serverTimestampValue(),
            updatedAt: serverTimestampValue(),
          }, { merge: true });
          Logger.info("MatchroomChat", "Chatroom created by host/venue owner", { resolvedId });
        } catch (err) {
          Logger.warn("MatchroomChat", "Chatroom create failed", { resolvedId, err });
        }
        chatSnap = await tryGetChatroom();
      }

      if (!chatSnap || !chatSnap.exists) {
        setAuthorized(false);
        Logger.warn("MatchroomChat", "Chatroom missing after sync", { resolvedId });
        return;
      }

      let participantUids: string[] = chatSnap.data?.participantUids || [];
      let isParticipant = participantUids.includes(user.uid);
      setAuthorized(isParticipant);
      Logger.info("MatchroomChat", "Access check result", {
        resolvedId,
        isParticipant,
        participantUidsCount: participantUids.length,
        hostUid: roomData.hostUid,
        zoneOwnerUid: roomData.zoneOwnerUid,
      });
    } catch (error) {
      setAuthorized(false);
      Logger.error("MatchroomChat", "Access check failed", error);
    } finally {
      setLoading(false);
    }
  }, [chatroomId, user?.uid]);

  useEffect(() => {
    checkAuthorization();
  }, [checkAuthorization]);

  useEffect(() => {
    if (!activeRoomId || !authorized) return;
    const unsubscribe = subscribeDocs(
      {
        collectionPath: ["chatrooms", activeRoomId, "messages"],
        orderBy: [{ field: "createdAt", direction: "desc" }],
      },
      (docs) => {
        const list: ChatMessage[] = docs.map((docSnap) => {
          const data: any = docSnap.data;
          return {
            id: docSnap.id,
            text: data.text || "",
            senderUid: data.senderUid,
            senderName: data.senderName || "Player",
            createdAt: data.createdAt,
            replyTo: data.replyTo,
            deletedFor: data.deletedFor,
          };
        });
        setMessages(list);
      },
    );
    return () => unsubscribe();
  }, [activeRoomId, authorized]);

  useEffect(() => {
    if (!activeRoomId || !authorized) return;
    const unsubscribe = subscribeDoc(
      ["chatrooms", activeRoomId],
      (snap) => {
        setChatMeta(snap.exists ? snap.data : null);
      },
    );
    return () => unsubscribe();
  }, [activeRoomId, authorized]);

  useEffect(() => {
    const participantUids = Array.isArray(chatMeta?.participantUids) ? chatMeta.participantUids.filter(Boolean) : [];
    if (!participantUids.length) {
      setParticipantNames({});
      return;
    }

    let cancelled = false;

    const loadParticipantNames = async () => {
      try {
        const uniqueUids = Array.from(new Set(participantUids));
        const names: Record<string, string> = {};

        for (let index = 0; index < uniqueUids.length; index += 10) {
          const batch = uniqueUids.slice(index, index + 10);
          const usersSnap = await fetchDocs({
            collectionPath: ["users"],
            where: [{ field: "__name__", op: "in", value: batch }],
          });
          usersSnap.forEach((userDoc) => {
            const data: any = userDoc.data;
            names[userDoc.id] =
              data?.username ||
              data?.displayName ||
              data?.fullName ||
              "Player";
          });
        }

        if (!cancelled) {
          if (user?.uid && !names[user.uid]) {
            names[user.uid] = user.displayName || "You";
          }
          setParticipantNames(names);
        }
      } catch (error) {
        Logger.warn("MatchroomChat", "Failed to load participant names", error);
      }
    };

    loadParticipantNames();

    return () => {
      cancelled = true;
    };
  }, [chatMeta?.participantUids, user?.uid, user?.displayName]);

  const markRead = useCallback(async () => {
    if (!activeRoomId || !user?.uid) return;
    try {
      await setDocByPath(
        ["chatrooms", activeRoomId],
        {
          lastReadBy: {
            [user.uid]: serverTimestampValue(),
          },
          updatedAt: serverTimestampValue(),
        },
        { merge: true }
      );
    } catch (error) {
      Logger.warn("MatchroomChat", "Failed to update lastReadBy", error);
    }
  }, [activeRoomId, user?.uid]);

  useEffect(() => {
    if (!authorized || !messages.length || !user?.uid) return;
    const latest = messages[0];
    if (!latest) return;
    if (latest.id !== lastReadMessageId.current) {
      lastReadMessageId.current = latest.id;
      markRead();
    }
  }, [messages, authorized, markRead, user?.uid]);

  useEffect(() => {
    if (!authorized || !activeRoomId) return;
    markRead();
  }, [authorized, activeRoomId, markRead]);

  const sendMessage = async (overrideText?: string) => {
    if (!activeRoomId || !user?.uid) {
      Logger.warn("MatchroomChat", "Send skipped due to missing context", {
        activeRoomId,
        uid: user?.uid,
      });
      return;
    }
    const trimmed = (overrideText ?? input).trim();
    if (!trimmed) return;
    setSending(true);
    try {
      Logger.debug("MatchroomChat", "Send start", {
        roomId: activeRoomId,
        uid: user.uid,
        viaQuickChip: Boolean(overrideText),
        length: trimmed.length,
      });
      const payload: any = {
        type: "text",
        text: trimmed,
        senderUid: user.uid,
        senderName: user.displayName || "Player",
        createdAt: serverTimestampValue(),
        clientMessageId: `${user.uid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      };
      if (replyTo) {
        payload.replyTo = {
          messageId: replyTo.id,
          senderName: replyTo.senderName || "Player",
          snippet: (replyTo.text || "").slice(0, 80),
        };
      }
      await addDocToCollection(["chatrooms", activeRoomId, "messages"], payload);
      try {
        await updateDocByPath(["chatrooms", activeRoomId], {
          lastMessage: {
            type: "text",
            text: trimmed,
            senderUid: user.uid,
            createdAt: serverTimestampValue(),
          },
          updatedAt: serverTimestampValue(),
        });
      } catch (e) {
        Logger.warn("MatchroomChat", "Failed to update lastMessage", e);
      }
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
    if (!activeRoomId || !user?.uid) return;
    try {
      await updateDocByPath(["chatrooms", activeRoomId, "messages", messageId], {
        deletedFor: arrayUnionValue(user.uid),
        updatedAt: serverTimestampValue(),
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
    if (!user?.uid) return null;
    return messages.find((m) => m.senderUid === user.uid)?.id || null;
  }, [messages, user?.uid]);

  const contextCard = useMemo(() => {
    if (!roomMeta) return null;
    const gameLabel = GAME_LABELS[roomMeta.game] || (roomMeta.game ? String(roomMeta.game).toUpperCase() : "Matchroom");
    const dateText = roomMeta.scheduledDate ? String(roomMeta.scheduledDate) : "Date TBD";
    const timeText = roomMeta.scheduledTime ? String(roomMeta.scheduledTime) : "Time TBD";
    const status = roomMeta.status ? String(roomMeta.status).replace('-', ' ') : 'open';
    return (
      <View style={styles.contextCard}>
        <View style={styles.contextTopRow}>
          <Text style={styles.contextGame}>{gameLabel}</Text>
          <View style={styles.contextStatusPill}>
            <Text style={styles.contextStatusText}>{status}</Text>
          </View>
        </View>
        <Text style={styles.contextVenue}>{roomMeta.location || "Venue TBD"}</Text>
        <Text style={styles.contextTime}>{dateText} · {timeText}</Text>
      </View>
    );
  }, [roomMeta]);

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isMine = item.senderUid === user?.uid;
    const bubbleStyle = isMine ? styles.bubbleOutgoing : styles.bubbleIncoming;
    const isLastOutgoing = isMine && item.id === lastOutgoingId;
    let seen = false;
    let seenByNames: string[] = [];
    if (isLastOutgoing && chatMeta?.lastReadBy && item.createdAt?.toDate) {
      const sentAt = item.createdAt.toDate();
      const seenEntries = Object.entries(chatMeta.lastReadBy).filter(([uid, ts]: any) => {
        if (uid === user?.uid) return false;
        if (!ts?.toDate) return false;
        return ts.toDate() >= sentAt;
      });
      seen = seenEntries.length > 0;
      seenByNames = seenEntries.map(([uid]) => participantNames[uid] || "Player");
    }
    const seenLabel = seenByNames.length > 0
      ? (seenByNames.length <= 2
        ? `Seen by ${seenByNames.join(", ")}`
        : `Seen by ${seenByNames.slice(0, 2).join(", ")} +${seenByNames.length - 2}`)
      : "";
    const isDeletedForMe = Array.isArray(item.deletedFor) && !!user?.uid && item.deletedFor.includes(user.uid);
    const avatarLetter = (item.senderName || "P").trim().charAt(0).toUpperCase();
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
              {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
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
