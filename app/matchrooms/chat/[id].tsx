import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, View, Text } from "react-native";

import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import ChatThread from "../../../src/features/chat/ChatThread";
import type { ChatThreadMessage } from "../../../src/features/chat/types";
import { formatVoiceDuration } from "../../../src/features/chat/utils";
import { useAuth } from "../../../src/context/AuthContext";
import { useChatTyping } from "../../../src/hooks/useChatTyping";
import { usePresenceHeartbeat } from "../../../src/hooks/usePresenceHeartbeat";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useToast } from "../../../src/hooks/useToast";
import { uploadFileToConvex } from "../../../src/services/convex/storageService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";

const GAME_LABELS: Record<string, string> = {
    cs2: "CS2",
    cs16: "CS 1.6",
    valorant: "Valorant",
    fc26: "FC26",
    tekken8: "Tekken 8",
    // Physical sports are temporarily disabled.
    // futsal: "Futsal",
    // indoor_cricket: "Indoor Cricket",
    // padel: "Padel",
    // pickleball: "Pickleball",
};

function formatTimeToken(value?: string | null) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (/[ap]\.?m\.?/i.test(text)) {
        return text
            .replace(/\s+/g, " ")
            .replace(/a\.?m\.?/i, "AM")
            .replace(/p\.?m\.?/i, "PM");
    }

    const match = text.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return text;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return text;

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

function formatScheduleTime(value?: string | null) {
    const text = String(value || "").trim();
    if (!text) return "Time TBD";
    return text
        .split(/\s*-\s*/)
        .map((token) => formatTimeToken(token))
        .join(" - ");
}

export default function MatchroomChatScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [replyTo, setReplyTo] = useState<ChatThreadMessage | null>(null);
    const [editingMessage, setEditingMessage] = useState<ChatThreadMessage | null>(null);
    const [uploadingVoice, setUploadingVoice] = useState(false);
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    useRouteLogger("MatchroomChatScreen", { matchroomKey: id, userId: user?._id });

    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(recorder, 250);

    const rawId = typeof id === "string" ? id : "";

    const matchroomById = useQuery(
        api.matchrooms.getById,
        rawId ? { matchroomId: rawId } : "skip"
    );
    const matchroomByCode = useQuery(
        api.matchrooms.getByMatchCode,
        rawId && matchroomById === null ? { matchCode: rawId } : "skip"
    );
    const roomMeta = matchroomById || matchroomByCode;
    const matchroomId = roomMeta?._id;
    const matchroomLookupComplete = matchroomById !== undefined && (matchroomById !== null || matchroomByCode !== undefined);
    const accessState = useQuery(
        api.chat.getMatchroomAccess,
        matchroomId
            ? { matchroomId: matchroomId as Id<"matchrooms"> }
            : "skip"
    );

    const chatroom = useQuery(
        api.chat.getByMatchroom,
        matchroomId && accessState?.status === "ok"
            ? { matchroomId: matchroomId as Id<"matchrooms"> }
            : "skip"
    );
    const rawMessages = useQuery(
        api.chat.listMessagesForMatchroom,
        matchroomId && accessState?.status === "ok"
            ? { matchroomId: matchroomId as Id<"matchrooms">, limit: 200 }
            : "skip"
    );

    const participantUserIds = useMemo(
        () => (chatroom?.participantUids || []).filter(Boolean).map((uid) => uid as Id<"users">),
        [chatroom?.participantUids]
    );
    const participantUsers = useQuery(
        api.users.getMany,
        participantUserIds.length > 0 ? { userIds: participantUserIds } : "skip"
    );

    const getOrCreateChatroom = useMutation(api.chat.getOrCreateForMatchroom);
    const sendMessageToMatchroomMutation = useMutation(api.chat.sendMessageToMatchroom);
    const deleteForMeMutation = useMutation(api.chat.deleteForMe);
    const markReadMutation = useMutation(api.chat.markRead);
    const toggleReactionMutation = useMutation(api.chat.toggleReaction);
    const editMessageMutation = useMutation(api.chat.editMessage);
    const pinMessageMutation = useMutation(api.chat.pinMessage);
    const unpinMessageMutation = useMutation(api.chat.unpinMessage);

    // Typing indicator
    const chatKeyForTyping = chatroom?._id ? String(chatroom._id) : null;
    const { typingNames, onInputActivity } = useChatTyping(chatKeyForTyping);

    // Presence heartbeat
    usePresenceHeartbeat(Boolean(user?._id));

    const authorized = accessState?.status === "ok";

    useEffect(() => {
        if (!matchroomId) return;
        Logger.info("MatchroomChat", "Chat auth state snapshot", {
            matchroomId,
            localUserId: user?._id ?? null,
            accessStatus: accessState?.status ?? null,
            hasChatroom: Boolean(chatroom?._id),
            hasMessages: Array.isArray(rawMessages) ? rawMessages.length : null,
        });
    }, [accessState?.status, chatroom?._id, matchroomId, rawMessages, user?._id]);

    useEffect(() => {
        if (!matchroomId || !user?._id || !roomMeta) return;
        if (accessState?.status !== "ok" || chatroom !== null) return;

        const participantUids = Array.from(
            new Set([
                roomMeta.hostUid,
                ...(((roomMeta as any).playerUids || []) as string[]),
                ...((roomMeta as any).zoneOwnerUid ? [(roomMeta as any).zoneOwnerUid] : []),
            ].filter(Boolean))
        );

        void getOrCreateChatroom({
            matchroomId: matchroomId as Id<"matchrooms">,
            participantUids,
            zoneId: (roomMeta as any).zoneId,
        }).catch((error: any) => {
            Logger.warn("MatchroomChat", "Failed to create chatroom", error);
        });
    }, [accessState?.status, chatroom, getOrCreateChatroom, matchroomId, roomMeta, user?._id]);

    const participantNameMap = useMemo(() => {
        const map: Record<string, string> = {};
        (participantUsers || []).forEach((entry: any) => {
            if (!entry) return;
            map[entry._id] = entry.username || entry.fullName || "Player";
        });
        return map;
    }, [participantUsers]);

    const participants = useMemo(
        () => (participantUsers || [])
            .filter(Boolean)
            .map((entry: any) => ({
                uid: String(entry._id),
                label: entry.username || entry.fullName || "Player",
                photoURL: entry.photoURL || null,
            })),
        [participantUsers]
    );

    const messages = useMemo<ChatThreadMessage[]>(() => {
        const mapped = [...(rawMessages || [])]
            .sort((a: any, b: any) => a.createdAt - b.createdAt)
            .map((message: any) => ({
                id: message._id,
                text: message.content || "",
                senderUid: String(message.senderUid),
                senderName: message.senderUsername || participantNameMap[String(message.senderUid)] || "Player",
                createdAt: message.createdAt || 0,
                type: message.type || (message.audioStorageId ? "voice" : "text"),
                audioUrl: message.audioUrl || null,
                audioDurationMs: message.audioDurationMs || null,
                attachment: message.attachment || null,
                reactions: message.reactions || [],
                editedAt: message.editedAt || null,
                replyTo: message.replyTo
                    ? {
                        messageId: message.replyTo.messageId,
                        senderName: message.replyTo.senderName,
                        snippet: message.replyTo.text,
                    }
                    : undefined,
                deletedFor: message.deletedFor,
            }));
        return mapped;
    }, [participantNameMap, rawMessages]);

    const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
        try {
            await toggleReactionMutation({
                messageId: messageId as Id<"chatMessages">,
                emoji,
            });
        } catch (error) {
            Logger.warn("MatchroomChat", "Failed to toggle reaction", error);
        }
    }, [toggleReactionMutation]);

    const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
        try {
            await editMessageMutation({
                messageId: messageId as Id<"chatMessages">,
                newContent,
            });
            setEditingMessage(null);
        } catch (error: any) {
            Logger.warn("MatchroomChat", "Failed to edit message", error);
            showToast({ type: "error", title: "Edit failed", message: error?.message || "Unable to edit message." });
        }
    }, [editMessageMutation, showToast]);

    const handlePinMessage = useCallback(async (messageId: string) => {
        if (!chatroom?._id) return;
        try {
            await pinMessageMutation({ chatroomId: chatroom._id, messageId });
        } catch (error: any) {
            Logger.warn("MatchroomChat", "Failed to pin message", error);
            showToast({ type: "error", title: "Pin failed", message: error?.message || "Unable to pin message." });
        }
    }, [chatroom?._id, pinMessageMutation, showToast]);

    const handleUnpinMessage = useCallback(async (messageId: string) => {
        if (!chatroom?._id) return;
        try {
            await unpinMessageMutation({ chatroomId: chatroom._id, messageId });
        } catch (error: any) {
            Logger.warn("MatchroomChat", "Failed to unpin message", error);
        }
    }, [chatroom?._id, unpinMessageMutation]);

    const handleSwipeReply = useCallback((message: ChatThreadMessage) => {
        setEditingMessage(null);
        setReplyTo(message);
    }, []);

    const pinnedMessageIds: string[] = (chatroom?.pinnedMessageIds as string[]) || [];
    const pinnedMessages = useMemo(
        () => messages.filter((m) => pinnedMessageIds.includes(m.id)),
        [messages, pinnedMessageIds]
    );

    const handleInputChange = useCallback((value: string) => {
        setInput(value);
        onInputActivity();
    }, [onInputActivity]);

    const seenReceiptsByMessageId = useMemo(() => {
        const result: Record<string, Array<{ uid: string; name: string; readAt: number }>> = {};
        const lastReadBy = (chatroom?.lastReadBy || {}) as Record<string, number>;
        messages.forEach((message) => {
            if (message.senderUid !== user?._id) return;
            result[message.id] = Object.entries(lastReadBy)
                .filter(([uid, timestamp]) => uid !== user?._id && Number(timestamp) >= message.createdAt)
                .map(([uid, timestamp]) => ({
                    uid,
                    name: participantNameMap[uid] || "Player",
                    readAt: Number(timestamp),
                }));
        });
        return result;
    }, [chatroom?.lastReadBy, messages, participantNameMap, user?._id]);

    const markRead = useCallback(async () => {
        if (!chatroom?._id || !user?._id) return;
        try {
            await markReadMutation({
                chatroomId: chatroom._id,
            });
        } catch (error) {
            Logger.warn("MatchroomChat", "Failed to mark chat as read", error);
        }
    }, [chatroom?._id, markReadMutation, user?._id]);

    useEffect(() => {
        if (!authorized || messages.length === 0) return;
        void markRead();
    }, [authorized, markRead, messages.length]);

    const sendTextMessage = async () => {
        if (!matchroomId || !user?._id || !input.trim()) return;

        // Handle editing mode
        if (editingMessage) {
            await handleEditMessage(editingMessage.id, input.trim());
            setInput("");
            return;
        }

        setSending(true);
        try {
            await sendMessageToMatchroomMutation({
                matchroomId: matchroomId as Id<"matchrooms">,
                content: input.trim(),
                type: "text",
                clientMessageId: `${user._id}_${Date.now()}_text`,
                replyTo: replyTo
                    ? {
                        messageId: replyTo.id,
                        senderName: replyTo.senderName,
                        text: replyTo.text.slice(0, 80),
                    }
                    : undefined,
            });
            setInput("");
            setReplyTo(null);
            void markRead();
        } catch (error) {
            Logger.error("MatchroomChat", "Failed to send text message", error);
            showToast({ type: "error", title: "Send failed", message: "Unable to send message right now." });
        } finally {
            setSending(false);
        }
    };

    const toggleRecording = async () => {
        if (!user?._id || !matchroomId) return;

        if (recorderState.isRecording) {
            try {
                setUploadingVoice(true);
                await recorder.stop();
                const recorderStatus = recorder.getStatus();
                const uri = recorder.uri || recorderStatus.url;
                if (!uri) {
                    throw new Error("Recording file was not created.");
                }

                const durationMs = recorderStatus.durationMillis || recorderState.durationMillis || 0;
                const uploaded = await uploadFileToConvex({
                    uri,
                    mimeType: "audio/m4a",
                    fileName: `voice_${user._id}_${Date.now()}.m4a`,
                });

                await sendMessageToMatchroomMutation({
                    matchroomId: matchroomId as Id<"matchrooms">,
                    content: "",
                    type: "voice",
                    audioStorageId: uploaded.storageId,
                    audioDurationMs: durationMs,
                    clientMessageId: `${user._id}_${Date.now()}_voice`,
                    replyTo: replyTo
                        ? {
                            messageId: replyTo.id,
                            senderName: replyTo.senderName,
                            text: replyTo.type === "voice" ? "Voice message" : replyTo.text.slice(0, 80),
                        }
                        : undefined,
                });

                setReplyTo(null);
                await setAudioModeAsync({
                    allowsRecording: false,
                    playsInSilentMode: true,
                });
                void markRead();
            } catch (error) {
                Logger.error("MatchroomChat", "Failed to send voice message", error);
                showToast({ type: "error", title: "Voice message failed", message: "Unable to record or upload the voice message." });
            } finally {
                setUploadingVoice(false);
            }
            return;
        }

        try {
            const permission = await requestRecordingPermissionsAsync();
            if (!permission.granted) {
                showToast({ type: "warning", title: "Microphone access required", message: "Enable microphone permission to send voice messages." });
                return;
            }

            await setAudioModeAsync({
                allowsRecording: true,
                playsInSilentMode: true,
            });
            await recorder.prepareToRecordAsync();
            recorder.record();
        } catch (error) {
            Logger.error("MatchroomChat", "Failed to start recording", error);
            showToast({ type: "error", title: "Recording unavailable", message: "Unable to start recording right now." });
        }
    };

    const handlePickImage = useCallback(async () => {
        if (!matchroomId || !user?._id) return;
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                quality: 0.8,
            });
            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];

            setUploadingAttachment(true);
            const uploaded = await uploadFileToConvex({
                uri: asset.uri,
                mimeType: asset.mimeType || "image/jpeg",
                fileName: asset.fileName || `photo_${Date.now()}.jpg`,
            });

            await sendMessageToMatchroomMutation({
                matchroomId: matchroomId as Id<"matchrooms">,
                content: "",
                type: "image",
                attachment: {
                    storageId: uploaded.storageId,
                    fileName: asset.fileName || `photo_${Date.now()}.jpg`,
                    mimeType: asset.mimeType || "image/jpeg",
                    width: asset.width,
                    height: asset.height,
                },
                clientMessageId: `${user._id}_${Date.now()}_image`,
                replyTo: replyTo
                    ? { messageId: replyTo.id, senderName: replyTo.senderName, text: replyTo.text.slice(0, 80) }
                    : undefined,
            });
            setReplyTo(null);
            void markRead();
        } catch (error) {
            Logger.error("MatchroomChat", "Failed to send image", error);
            showToast({ type: "error", title: "Image failed", message: "Unable to send image." });
        } finally {
            setUploadingAttachment(false);
        }
    }, [markRead, matchroomId, replyTo, sendMessageToMatchroomMutation, showToast, user?._id]);

    const handlePickFile = useCallback(async () => {
        if (!matchroomId || !user?._id) return;
        try {
            const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];

            setUploadingAttachment(true);
            const uploaded = await uploadFileToConvex({
                uri: asset.uri,
                mimeType: asset.mimeType || "application/octet-stream",
                fileName: asset.name || `file_${Date.now()}`,
            });

            await sendMessageToMatchroomMutation({
                matchroomId: matchroomId as Id<"matchrooms">,
                content: "",
                type: "file",
                attachment: {
                    storageId: uploaded.storageId,
                    fileName: asset.name || `file_${Date.now()}`,
                    mimeType: asset.mimeType || "application/octet-stream",
                    sizeBytes: asset.size,
                },
                clientMessageId: `${user._id}_${Date.now()}_file`,
                replyTo: replyTo
                    ? { messageId: replyTo.id, senderName: replyTo.senderName, text: replyTo.text.slice(0, 80) }
                    : undefined,
            });
            setReplyTo(null);
            void markRead();
        } catch (error) {
            Logger.error("MatchroomChat", "Failed to send file", error);
            showToast({ type: "error", title: "File failed", message: "Unable to send file." });
        } finally {
            setUploadingAttachment(false);
        }
    }, [markRead, matchroomId, replyTo, sendMessageToMatchroomMutation, showToast, user?._id]);

    const handleMessageLongPress = (message: ChatThreadMessage) => {
        const isMine = message.senderUid === user?._id;
        const canEdit = isMine && message.type !== "voice" && (Date.now() - message.createdAt < 15 * 60 * 1000);
        const isPinned = pinnedMessageIds.includes(message.id);

        Alert.alert(
            "Message options",
            "",
            [
                {
                    text: "Reply",
                    onPress: () => {
                        setEditingMessage(null);
                        setReplyTo(message);
                    },
                },
                message.type === "text"
                    ? {
                        text: "Copy",
                        onPress: async () => {
                            await Clipboard.setStringAsync(message.text || "");
                        },
                    }
                    : undefined,
                canEdit
                    ? {
                        text: "Edit",
                        onPress: () => {
                            setReplyTo(null);
                            setEditingMessage(message);
                            setInput(message.text);
                        },
                    }
                    : undefined,
                isPinned
                    ? {
                        text: "Unpin",
                        onPress: () => void handleUnpinMessage(message.id),
                    }
                    : {
                        text: "Pin",
                        onPress: () => void handlePinMessage(message.id),
                    },
                {
                    text: "Delete for me",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteForMeMutation({
                                messageId: message.id as Id<"chatMessages">,
                            });
                        } catch (error) {
                            Logger.warn("MatchroomChat", "Delete for me failed", error);
                        }
                    },
                },
                { text: "Cancel", style: "cancel" },
            ].filter(Boolean) as any
        );
    };

    const title = roomMeta?.title || "Matchroom Chat";
    const subtitle = roomMeta
        ? `${GAME_LABELS[(roomMeta as any).game] || String((roomMeta as any).game || "Chat").toUpperCase()} chat`
        : "Match chat";
    const canComposeInMatchroom = accessState?.status === "ok";

    const contextCard = roomMeta ? (
        <>
            <Text style={{ color: COLORS.accent, fontFamily: "Montserrat_700Bold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Match chat
            </Text>
            <Text style={{ color: COLORS.text, fontFamily: "Montserrat_700Bold", fontSize: 18, marginTop: 4 }}>
                {(roomMeta as any).location || "Venue TBD"}
            </Text>
            <Text style={{ color: COLORS.textSecondary, marginTop: 4 }}>
                {String((roomMeta as any).scheduledDate || "Date TBD")} · {formatScheduleTime((roomMeta as any).scheduledTime)}
            </Text>
        </>
    ) : undefined;

    if (matchroomLookupComplete && !roomMeta) {
        return (
            <ChatThread
                title="Matchroom chat"
                subtitle="Unavailable"
                currentUserId={user?._id}
                messages={[]}
                loading={false}
                input=""
                onInputChange={() => undefined}
                onBack={() => router.back()}
                onSendText={() => undefined}
                onToggleRecording={() => undefined}
                showComposer={false}
                emptyTitle="Chat unavailable"
                emptySubtitle="This matchroom could not be found or is no longer available."
            />
        );
    }

    if (roomMeta && accessState?.status === "forbidden") {
        return (
            <ChatThread
                title={title}
                subtitle={subtitle}
                currentUserId={user?._id}
                messages={[]}
                loading={false}
                input=""
                onInputChange={() => undefined}
                onBack={() => router.back()}
                onSendText={() => undefined}
                onToggleRecording={() => undefined}
                showComposer={false}
                emptyTitle="Access restricted"
                emptySubtitle="Only matchroom participants and the venue owner can view this chat."
            />
        );
    }

    if (roomMeta && accessState?.status === "unauthenticated") {
        Logger.warn("MatchroomChat", "Received unauthenticated access state while local user exists", {
            matchroomId,
            localUserId: user?._id ?? null,
            roomMetaId: roomMeta?._id ?? null,
        });
        return (
            <ChatThread
                title={title}
                subtitle={subtitle}
                currentUserId={user?._id}
                messages={[]}
                loading={false}
                input=""
                onInputChange={() => undefined}
                onBack={() => router.back()}
                onSendText={() => undefined}
                onToggleRecording={() => undefined}
                showComposer={false}
                emptyTitle="Sign in required"
                emptySubtitle="Refresh your session and reopen this chat."
            />
        );
    }

    return (
        <ChatThread
            title={title}
            subtitle={subtitle}
            currentUserId={user?._id}
            messages={messages}
            participants={participants}
            loading={
                (matchroomById === undefined && matchroomByCode === undefined) ||
                (Boolean(matchroomId) && accessState === undefined)
            }
            input={input}
            onInputChange={handleInputChange}
            onBack={() => router.back()}
            onSendText={sendTextMessage}
            onToggleRecording={toggleRecording}
            sending={sending || uploadingVoice || uploadingAttachment}
            recording={recorderState.isRecording}
            recordingDurationLabel={formatVoiceDuration(recorderState.durationMillis)}
            onMessageLongPress={handleMessageLongPress}
            onToggleReaction={handleToggleReaction}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
            seenReceiptsByMessageId={seenReceiptsByMessageId}
            contextCard={contextCard}
            emptyTitle="No messages yet"
            emptySubtitle="Use the chat to coordinate arrivals, setup, and updates."
            showComposer={Boolean(matchroomId) && (Boolean(chatroom?._id) || canComposeInMatchroom)}
            onPickImage={handlePickImage}
            onPickFile={handlePickFile}
            typingNames={typingNames}
            onSwipeReply={handleSwipeReply}
            editingMessage={editingMessage}
            onClearEdit={() => { setEditingMessage(null); setInput(""); }}
            pinnedMessages={pinnedMessages}
            onPinMessage={handlePinMessage}
            onUnpinMessage={handleUnpinMessage}
            canUnpin
        />
    );
}




