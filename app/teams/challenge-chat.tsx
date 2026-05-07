import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Text } from "react-native";

import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import ChatThread from "../../src/features/chat/ChatThread";
import type { ChatThreadMessage } from "../../src/features/chat/types";
import { formatChatPresenceLabel, formatVoiceDuration, useRelativeNow } from "../../src/features/chat/utils";
import { useAuth } from "../../src/context/AuthContext";
import { useChatTyping } from "../../src/hooks/useChatTyping";
import { usePresenceHeartbeat } from "../../src/hooks/usePresenceHeartbeat";
import { useRouteLogger } from "../../src/hooks/useRouteLogger";
import { useToast } from "../../src/hooks/useToast";
import { uploadFileToConvex } from "../../src/services/convex/storageService";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";

export default function TeamChallengeChatScreen() {
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();
    const chatId = Array.isArray(params.id) ? params.id[0] : params.id;

    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [replyTo, setReplyTo] = useState<ChatThreadMessage | null>(null);
    const [editingMessage, setEditingMessage] = useState<ChatThreadMessage | null>(null);
    const [uploadingVoice, setUploadingVoice] = useState(false);
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    useRouteLogger("TeamChallengeChatScreen", { chatId, userId: user?._id });

    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(recorder, 250);
    const nowMs = useRelativeNow(60_000);

    const accessState = useQuery(
        api.teamChallengeChat.getAccess,
        chatId ? { chatId } : "skip"
    );
    const chatData = useQuery(
        api.teamChallengeChat.getChat,
        chatId && accessState?.status === "ok" ? { chatId } : "skip"
    );
    const challengeData = useQuery(
        api.teamChallenges.getById,
        chatData?.challengeId ? { challengeId: chatData.challengeId } : "skip"
    );
    const rawMessages = useQuery(
        api.teamChallengeChat.listMessages,
        chatId && accessState?.status === "ok" ? { chatId } : "skip"
    );

    const captainUserIds = useMemo<Id<"users">[]>(
        () => ((chatData?.participantUids || []) as string[])
            .filter(Boolean)
            .map((uid) => uid as Id<"users">),
        [chatData?.participantUids]
    );
    const captainUsers = useQuery(
        api.users.getMany,
        captainUserIds.length > 0 ? { userIds: captainUserIds } : "skip"
    );
    const captainPhotoByUid = useMemo(() => {
        const map: Record<string, string | null> = {};
        (captainUsers || []).forEach((entry: any) => {
            if (!entry) return;
            map[String(entry._id)] = entry.photoURL || null;
        });
        return map;
    }, [captainUsers]);

    const sendMessageMutation = useMutation(api.teamChallengeChat.sendMessage);
    const markReadMutation = useMutation(api.teamChallengeChat.markRead);
    const toggleReactionMutation = useMutation(api.teamChallengeChat.toggleReaction);
    const editMessageMutation = useMutation(api.teamChallengeChat.editMessage);
    const pinMessageMutation = useMutation(api.teamChallengeChat.pinMessage);
    const unpinMessageMutation = useMutation(api.teamChallengeChat.unpinMessage);

    // Typing indicator
    const { typingNames, onInputActivity } = useChatTyping(chatId);

    // Presence heartbeat
    usePresenceHeartbeat(Boolean(user?._id));

    const loading =
        !!chatId &&
        (
            accessState === undefined ||
            (accessState?.status === "ok" && chatData === undefined && rawMessages === undefined)
        );

    const messages = useMemo<ChatThreadMessage[]>(
        () => {
            const mapped = (rawMessages || []).map((message: any) => ({
                id: message._id,
                text: message.text || "",
                senderUid: String(message.senderUid),
                senderName: message.senderName || "Captain",
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
        },
        [rawMessages]
    );

    const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
        try {
            await toggleReactionMutation({
                messageId: messageId as Id<"teamChallengeChatMessages">,
                emoji,
            });
        } catch (error) {
            Logger.warn("TeamChallengeChat", "Failed to toggle reaction", error);
        }
    }, [toggleReactionMutation]);

    const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
        try {
            await editMessageMutation({
                messageId: messageId as Id<"teamChallengeChatMessages">,
                newContent,
            });
            setEditingMessage(null);
        } catch (error: any) {
            Logger.warn("TeamChallengeChat", "Failed to edit message", error);
            showToast({ type: "error", title: "Edit failed", message: error?.message || "Unable to edit message." });
        }
    }, [editMessageMutation, showToast]);

    const handlePinMessage = useCallback(async (messageId: string) => {
        if (!chatId) return;
        try {
            await pinMessageMutation({ chatId, messageId });
        } catch (error: any) {
            Logger.warn("TeamChallengeChat", "Failed to pin message", error);
            showToast({ type: "error", title: "Pin failed", message: error?.message || "Unable to pin message." });
        }
    }, [chatId, pinMessageMutation, showToast]);

    const handleUnpinMessage = useCallback(async (messageId: string) => {
        if (!chatId) return;
        try {
            await unpinMessageMutation({ chatId, messageId });
        } catch (error: any) {
            Logger.warn("TeamChallengeChat", "Failed to unpin message", error);
        }
    }, [chatId, unpinMessageMutation]);

    const handleSwipeReply = useCallback((message: ChatThreadMessage) => {
        setEditingMessage(null);
        setReplyTo(message);
    }, []);

    const pinnedMessageIds: string[] = (chatData?.pinnedMessageIds as string[]) || [];
    const pinnedMessages = useMemo(
        () => messages.filter((m) => pinnedMessageIds.includes(m.id)),
        [messages, pinnedMessageIds]
    );

    // Presence label for 1:1 captain chat
    const otherCaptainUser = useMemo(() => {
        if (!captainUsers || !user?._id) return null;
        return (captainUsers as any[]).find((u: any) => u && String(u._id) !== user._id) || null;
    }, [captainUsers, user?._id]);

    const presenceLabel = useMemo(() => {
        return formatChatPresenceLabel(otherCaptainUser?.lastActiveAt, otherCaptainUser?.isOnline, nowMs);
    }, [nowMs, otherCaptainUser?.isOnline, otherCaptainUser?.lastActiveAt]);

    const isCaptain = useMemo(() => {
        if (!user?._id || !challengeData) return false;
        return String(challengeData.captainAUid) === user._id || String(challengeData.captainBUid) === user._id;
    }, [challengeData, user?._id]);

    const handleInputChange = useCallback((value: string) => {
        setDraft(value);
        onInputActivity();
    }, [onInputActivity]);

    useEffect(() => {
        if (!chatId || !user?._id || messages.length === 0) return;
        void markReadMutation({ chatId }).catch((error: any) => {
            Logger.warn("TeamChallengeChat", "Failed to mark challenge chat as read", error);
        });
    }, [chatId, markReadMutation, messages.length, user?._id]);

    const senderNameMap = useMemo(() => {
        const result: Record<string, string> = {};
        (rawMessages || []).forEach((message: any) => {
            if (!message?.senderUid) return;
            result[String(message.senderUid)] = message.senderName || "Captain";
        });
        return result;
    }, [rawMessages]);

    const participants = useMemo(
        () => ((chatData?.participantUids || []) as string[]).map((uid) => {
            const resolvedName =
                challengeData?.captainAUid === uid
                    ? challengeData?.captainAName
                    : challengeData?.captainBUid === uid
                        ? challengeData?.captainBName
                        : senderNameMap[uid];
            return {
                uid,
                label: uid === user?._id ? "You" : resolvedName || "Captain",
                photoURL: captainPhotoByUid[uid] || null,
            };
        }),
        [captainPhotoByUid, challengeData?.captainAName, challengeData?.captainAUid, challengeData?.captainBName, challengeData?.captainBUid, chatData?.participantUids, senderNameMap, user?._id]
    );

    const seenReceiptsByMessageId = useMemo(() => {
        const result: Record<string, Array<{ uid: string; name: string; readAt: number }>> = {};
        const lastReadBy = (chatData?.lastReadBy || {}) as Record<string, number>;
        messages.forEach((message) => {
            if (message.senderUid !== user?._id) return;
            result[message.id] = Object.entries(lastReadBy)
                .filter(([uid, timestamp]) => uid !== user?._id && Number(timestamp) >= message.createdAt)
                .map(([uid, timestamp]) => ({
                    uid,
                    name: senderNameMap[uid] || "Captain",
                    readAt: Number(timestamp),
                }));
        });
        return result;
    }, [chatData?.lastReadBy, messages, senderNameMap, user?._id]);

    const sendTextMessage = async () => {
        if (!chatId || !user?._id || !draft.trim() || sending) return;

        // Handle editing mode
        if (editingMessage) {
            await handleEditMessage(editingMessage.id, draft.trim());
            setDraft("");
            return;
        }

        setSending(true);
        try {
            await sendMessageMutation({
                chatId,
                text: draft.trim(),
                type: "text",
                clientMessageId: `${user._id}_${Date.now()}_text`,
                replyTo: replyTo
                    ? {
                        messageId: replyTo.id,
                        senderName: replyTo.senderName,
                        text: replyTo.type === "voice" ? "Voice message" : replyTo.text.slice(0, 80),
                    }
                    : undefined,
            });
            setDraft("");
            setReplyTo(null);
        } catch (error) {
            Logger.error("TeamChallengeChat", "Failed to send text message", error);
            showToast({ type: "error", title: "Send failed", message: "Unable to send message right now." });
        } finally {
            setSending(false);
        }
    };

    const toggleRecording = async () => {
        if (!chatId || !user?._id) return;

        if (recorderState.isRecording) {
            try {
                setUploadingVoice(true);
                await recorder.stop();
                const status = recorder.getStatus();
                const uri = recorder.uri || status.url;
                if (!uri) throw new Error("Recording file missing.");

                const durationMs = status.durationMillis || recorderState.durationMillis || 0;
                const uploaded = await uploadFileToConvex({
                    uri,
                    mimeType: "audio/m4a",
                    fileName: `challenge_voice_${user._id}_${Date.now()}.m4a`,
                });

                await sendMessageMutation({
                    chatId,
                    text: "",
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
            } catch (error) {
                Logger.error("TeamChallengeChat", "Failed to send voice message", error);
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
            Logger.error("TeamChallengeChat", "Failed to start recording", error);
            showToast({ type: "error", title: "Recording unavailable", message: "Unable to start recording right now." });
        }
    };

    const handlePickImage = useCallback(async () => {
        if (!chatId || !user?._id) return;
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

            await sendMessageMutation({
                chatId,
                text: "",
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
                    ? { messageId: replyTo.id, senderName: replyTo.senderName, text: replyTo.type === "voice" ? "Voice message" : replyTo.text.slice(0, 80) }
                    : undefined,
            });
            setReplyTo(null);
        } catch (error) {
            Logger.error("TeamChallengeChat", "Failed to send image", error);
            showToast({ type: "error", title: "Image failed", message: "Unable to send image." });
        } finally {
            setUploadingAttachment(false);
        }
    }, [chatId, replyTo, sendMessageMutation, showToast, user?._id]);

    const handlePickFile = useCallback(async () => {
        if (!chatId || !user?._id) return;
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

            await sendMessageMutation({
                chatId,
                text: "",
                type: "file",
                attachment: {
                    storageId: uploaded.storageId,
                    fileName: asset.name || `file_${Date.now()}`,
                    mimeType: asset.mimeType || "application/octet-stream",
                    sizeBytes: asset.size,
                },
                clientMessageId: `${user._id}_${Date.now()}_file`,
                replyTo: replyTo
                    ? { messageId: replyTo.id, senderName: replyTo.senderName, text: replyTo.type === "voice" ? "Voice message" : replyTo.text.slice(0, 80) }
                    : undefined,
            });
            setReplyTo(null);
        } catch (error) {
            Logger.error("TeamChallengeChat", "Failed to send file", error);
            showToast({ type: "error", title: "File failed", message: "Unable to send file." });
        } finally {
            setUploadingAttachment(false);
        }
    }, [chatId, replyTo, sendMessageMutation, showToast, user?._id]);

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
                            setDraft(message.text);
                        },
                    }
                    : undefined,
                isCaptain
                    ? isPinned
                        ? {
                            text: "Unpin",
                            onPress: () => void handleUnpinMessage(message.id),
                        }
                        : {
                            text: "Pin",
                            onPress: () => void handlePinMessage(message.id),
                        }
                    : undefined,
                { text: "Cancel", style: "cancel" },
            ].filter(Boolean) as any
        );
    };

    const contextCard = (
        <>
            <Text style={{ color: COLORS.accent, fontFamily: "Montserrat_700Bold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8 }}>
                Challenge room
            </Text>
            <Text style={{ color: COLORS.text, fontFamily: "Montserrat_700Bold", fontSize: 18, marginTop: 4 }}>
                {challengeData?.challengerTeamName && challengeData?.opponentTeamName
                    ? `${challengeData.challengerTeamName} vs ${challengeData.opponentTeamName}`
                    : "Captains coordination"}
            </Text>
            <Text style={{ color: COLORS.textSecondary, marginTop: 4 }}>
                Use this chat to agree venue, timing, and match details.
            </Text>
        </>
    );

    if (chatId && accessState?.status === "unauthenticated") {
        return (
            <ChatThread
                title="Captains chat"
                subtitle="Sign in required"
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

    if (chatId && accessState?.status === "forbidden") {
        return (
            <ChatThread
                title="Captains chat"
                subtitle="Access restricted"
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
                emptySubtitle="Only challenge captains can access this chat."
            />
        );
    }

    if (chatId && accessState?.status === "locked") {
        return (
            <ChatThread
                title="Captains chat"
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
                emptySubtitle="This challenge chat is locked for the current challenge status."
            />
        );
    }

    if (chatId && accessState?.status === "not_found") {
        return (
            <ChatThread
                title="Captains chat"
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
                emptySubtitle="This challenge could not be found or no longer supports chat."
            />
        );
    }

    return (
        <ChatThread
            title={
                challengeData?.challengerTeamName && challengeData?.opponentTeamName
                    ? `${challengeData.challengerTeamName} vs ${challengeData.opponentTeamName}`
                    : "Captains chat"
            }
            subtitle={
                challengeData?.status
                    ? String(challengeData.status).replace(/_/g, " ")
                    : "Captains chat"
            }
            currentUserId={user?._id}
            messages={messages}
            participants={participants}
            loading={loading}
            input={draft}
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
            emptyTitle="No captain messages yet"
            emptySubtitle="Start coordinating the challenge details here."
            onPickImage={handlePickImage}
            onPickFile={handlePickFile}
            typingNames={typingNames}
            onSwipeReply={handleSwipeReply}
            editingMessage={editingMessage}
            onClearEdit={() => { setEditingMessage(null); setDraft(""); }}
            pinnedMessages={pinnedMessages}
            onPinMessage={handlePinMessage}
            onUnpinMessage={handleUnpinMessage}
            canUnpin={isCaptain}
            presenceLabel={presenceLabel}
        />
    );
}
