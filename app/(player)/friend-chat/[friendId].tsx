import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import ReportIssueModal from "../../../src/components/ReportIssueModal";
import ChatThread from "../../../src/features/chat/ChatThread";
import type { ChatThreadMessage } from "../../../src/features/chat/types";
import { formatChatPresenceLabel, formatVoiceDuration, useRelativeNow } from "../../../src/features/chat/utils";
import { useAuth } from "../../../src/context/AuthContext";
import { useChatTyping } from "../../../src/hooks/useChatTyping";
import { usePresenceHeartbeat } from "../../../src/hooks/usePresenceHeartbeat";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useToast } from "../../../src/hooks/useToast";
import { submitFriendChatMessageReport } from "../../../src/services/convex/reportService";
import { uploadFileToConvex } from "../../../src/services/convex/storageService";
import Logger from "../../../src/utils/logger";

const CHAT_REPORT_REASONS = ["Harassment or abuse", "Hate speech", "Scam or spam", "Threats or unsafe behavior", "Other"];

export default function FriendChatScreen() {
    const { friendId } = useLocalSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();

    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [replyTo, setReplyTo] = useState<ChatThreadMessage | null>(null);
    const [editingMessage, setEditingMessage] = useState<ChatThreadMessage | null>(null);
    const [reportMessage, setReportMessage] = useState<ChatThreadMessage | null>(null);
    const [reportReason, setReportReason] = useState("");
    const [reportDescription, setReportDescription] = useState("");
    const [submittingReport, setSubmittingReport] = useState(false);
    const [uploadingVoice, setUploadingVoice] = useState(false);
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const [chatroomId, setChatroomId] = useState<Id<"chatrooms"> | null>(null);
    useRouteLogger("FriendChatScreen", { friendId, userId: user?._id });

    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(recorder, 250);
    const nowMs = useRelativeNow(60_000);

    const rawFriendId = typeof friendId === "string" ? friendId : "";

    // Get friend profile
    const friendProfile = useQuery(
        api.users.getById,
        rawFriendId ? { userId: rawFriendId as Id<"users"> } : "skip"
    );

    // Check DM access / existing chatroom
    const dmAccess = useQuery(
        api.friendChat.getDMAccess,
        rawFriendId ? { friendId: rawFriendId as Id<"users"> } : "skip"
    );

    // Get or create chatroom on mount
    const getOrCreateDM = useMutation(api.friendChat.getOrCreateDM);

    useEffect(() => {
        if (!rawFriendId || !user?._id || dmAccess?.status !== "ok") return;

        if (dmAccess.chatroomId) {
            setChatroomId(dmAccess.chatroomId);
            return;
        }

        // Create the DM chatroom
        void getOrCreateDM({ friendId: rawFriendId as Id<"users"> })
            .then((id) => setChatroomId(id))
            .catch((error: any) => {
                Logger.warn("FriendChat", "Failed to create DM chatroom", error);
                showToast({ type: "error", title: "Chat unavailable", message: error?.message || "Unable to start chat." });
            });
    }, [rawFriendId, user?._id, dmAccess?.status, dmAccess?.chatroomId, getOrCreateDM, showToast]);

    // Load messages and chatroom (for seen status)
    const rawMessages = useQuery(
        api.friendChat.listMessages,
        chatroomId ? { chatroomId, limit: 200 } : "skip"
    );
    const chatroom = useQuery(
        api.friendChat.getChatroom,
        chatroomId ? { chatroomId } : "skip"
    );

    // Mutations
    const sendMessageMutation = useMutation(api.friendChat.sendMessage);
    const deleteForMeMutation = useMutation(api.friendChat.deleteForMe);
    const markReadMutation = useMutation(api.friendChat.markRead);
    const toggleReactionMutation = useMutation(api.friendChat.toggleReaction);
    const editMessageMutation = useMutation(api.friendChat.editMessage);

    // Typing indicator
    const chatKeyForTyping = chatroomId ? String(chatroomId) : null;
    const { typingNames, onInputActivity } = useChatTyping(chatKeyForTyping);

    // Presence heartbeat
    usePresenceHeartbeat(Boolean(user?._id));

    const friendName = friendProfile?.fullName || friendProfile?.username || "Friend";
    const presenceLabel = useMemo(
        () => formatChatPresenceLabel(friendProfile?.lastActiveAt, friendProfile?.isOnline, nowMs),
        [friendProfile?.isOnline, friendProfile?.lastActiveAt, nowMs]
    );

    const messages = useMemo<ChatThreadMessage[]>(() => {
        const mapped = [...(rawMessages || [])]
            .sort((a: any, b: any) => a.createdAt - b.createdAt)
            .map((message: any) => ({
                id: message._id,
                text: message.content || "",
                senderUid: String(message.senderUid),
                senderName: message.senderUsername || "Player",
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
    }, [rawMessages]);

    const participants = useMemo(() => {
        const list: Array<{ uid: string; label: string; photoURL: string | null }> = [];
        if (user?._id) {
            list.push({
                uid: String(user._id),
                label: user.username || user.fullName || "You",
                photoURL: user.photoURL || null,
            });
        }
        if (friendProfile) {
            list.push({
                uid: String(friendProfile._id),
                label: friendProfile.username || friendProfile.fullName || "Friend",
                photoURL: friendProfile.photoURL || null,
            });
        }
        return list;
    }, [user, friendProfile]);

    const handleToggleReaction = useCallback(async (messageId: string, emoji: string) => {
        try {
            await toggleReactionMutation({ messageId: messageId as Id<"chatMessages">, emoji });
        } catch (error) {
            Logger.warn("FriendChat", "Failed to toggle reaction", error);
        }
    }, [toggleReactionMutation]);

    const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
        try {
            await editMessageMutation({ messageId: messageId as Id<"chatMessages">, newContent });
            setEditingMessage(null);
        } catch (error: any) {
            Logger.warn("FriendChat", "Failed to edit message", error);
            showToast({ type: "error", title: "Edit failed", message: error?.message || "Unable to edit message." });
        }
    }, [editMessageMutation, showToast]);

    const handleSwipeReply = useCallback((message: ChatThreadMessage) => {
        setEditingMessage(null);
        setReplyTo(message);
    }, []);

    const handleInputChange = useCallback((value: string) => {
        setInput(value);
        onInputActivity();
    }, [onInputActivity]);

    const seenReceiptsByMessageId = useMemo(() => {
        if (!chatroomId || !chatroom) return {};
        const result: Record<string, Array<{ uid: string; name: string; readAt: number }>> = {};
        const lastReadBy = (chatroom.lastReadBy || {}) as Record<string, number>;
        messages.forEach((message) => {
            if (message.senderUid !== user?._id) return;
            result[message.id] = Object.entries(lastReadBy)
                .filter(([uid, timestamp]) => uid !== user?._id && Number(timestamp) >= message.createdAt)
                .map(([uid, timestamp]) => ({
                    uid,
                    name: friendName,
                    readAt: Number(timestamp),
                }));
        });
        return result;
    }, [chatroomId, chatroom, friendName, messages, user?._id]);

    const markRead = useCallback(async () => {
        if (!chatroomId || !user?._id) return;
        try {
            await markReadMutation({ chatroomId });
        } catch (error) {
            Logger.warn("FriendChat", "Failed to mark chat as read", error);
        }
    }, [chatroomId, markReadMutation, user?._id]);

    useEffect(() => {
        if (!chatroomId || messages.length === 0) return;
        void markRead();
    }, [chatroomId, markRead, messages.length]);

    const sendTextMessage = async () => {
        if (!chatroomId || !user?._id || !input.trim()) return;

        if (editingMessage) {
            await handleEditMessage(editingMessage.id, input.trim());
            setInput("");
            return;
        }

        setSending(true);
        try {
            await sendMessageMutation({
                chatroomId,
                content: input.trim(),
                type: "text",
                clientMessageId: `${user._id}_${Date.now()}_text`,
                replyTo: replyTo
                    ? { messageId: replyTo.id, senderName: replyTo.senderName, text: replyTo.text.slice(0, 80) }
                    : undefined,
            });
            setInput("");
            setReplyTo(null);
            void markRead();
        } catch (error) {
            Logger.error("FriendChat", "Failed to send text message", error);
            showToast({ type: "error", title: "Send failed", message: "Unable to send message right now." });
        } finally {
            setSending(false);
        }
    };

    const toggleRecording = async () => {
        if (!user?._id || !chatroomId) return;

        if (recorderState.isRecording) {
            try {
                setUploadingVoice(true);
                await recorder.stop();
                const recorderStatus = recorder.getStatus();
                const uri = recorder.uri || recorderStatus.url;
                if (!uri) throw new Error("Recording file was not created.");

                const durationMs = recorderStatus.durationMillis || recorderState.durationMillis || 0;
                const uploaded = await uploadFileToConvex({
                    uri,
                    mimeType: "audio/m4a",
                    fileName: `voice_${user._id}_${Date.now()}.m4a`,
                });

                await sendMessageMutation({
                    chatroomId,
                    content: "",
                    type: "voice",
                    audioStorageId: uploaded.storageId,
                    audioDurationMs: durationMs,
                    clientMessageId: `${user._id}_${Date.now()}_voice`,
                    replyTo: replyTo
                        ? { messageId: replyTo.id, senderName: replyTo.senderName, text: replyTo.type === "voice" ? "Voice message" : replyTo.text.slice(0, 80) }
                        : undefined,
                });
                setReplyTo(null);
                await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
                void markRead();
            } catch (error) {
                Logger.error("FriendChat", "Failed to send voice message", error);
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
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
            await recorder.prepareToRecordAsync();
            recorder.record();
        } catch (error) {
            Logger.error("FriendChat", "Failed to start recording", error);
            showToast({ type: "error", title: "Recording unavailable", message: "Unable to start recording right now." });
        }
    };

    const handlePickImage = useCallback(async () => {
        if (!chatroomId || !user?._id) return;
        try {
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];

            setUploadingAttachment(true);
            const uploaded = await uploadFileToConvex({
                uri: asset.uri,
                mimeType: asset.mimeType || "image/jpeg",
                fileName: asset.fileName || `photo_${Date.now()}.jpg`,
            });

            await sendMessageMutation({
                chatroomId,
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
            Logger.error("FriendChat", "Failed to send image", error);
            showToast({ type: "error", title: "Image failed", message: "Unable to send image." });
        } finally {
            setUploadingAttachment(false);
        }
    }, [chatroomId, markRead, replyTo, sendMessageMutation, showToast, user?._id]);

    const handlePickFile = useCallback(async () => {
        if (!chatroomId || !user?._id) return;
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
                chatroomId,
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
            Logger.error("FriendChat", "Failed to send file", error);
            showToast({ type: "error", title: "File failed", message: "Unable to send file." });
        } finally {
            setUploadingAttachment(false);
        }
    }, [chatroomId, markRead, replyTo, sendMessageMutation, showToast, user?._id]);

    const handleMessageLongPress = (message: ChatThreadMessage) => {
        const isMine = message.senderUid === user?._id;
        const canEdit = isMine && message.type !== "voice" && (Date.now() - message.createdAt < 15 * 60 * 1000);

        Alert.alert(
            "Message options",
            "",
            [
                {
                    text: "Reply",
                    onPress: () => { setEditingMessage(null); setReplyTo(message); },
                },
                message.type === "text"
                    ? { text: "Copy", onPress: async () => { await Clipboard.setStringAsync(message.text || ""); } }
                    : undefined,
                canEdit
                    ? {
                        text: "Edit",
                        onPress: () => { setReplyTo(null); setEditingMessage(message); setInput(message.text); },
                    }
                    : undefined,
                !isMine
                    ? {
                    text: "Report",
                    style: "destructive",
                    onPress: () => {
                        setReportMessage(message);
                        setReportReason("");
                        setReportDescription("");
                    },
                }
                    : undefined,
                {
                    text: "Delete for me",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteForMeMutation({ messageId: message.id as Id<"chatMessages"> });
                        } catch (error) {
                            Logger.warn("FriendChat", "Delete for me failed", error);
                        }
                    },
                },
                { text: "Cancel", style: "cancel" },
            ].filter(Boolean) as any
        );
    };

    const closeReportModal = () => {
        if (submittingReport) return;
        setReportMessage(null);
        setReportReason("");
        setReportDescription("");
    };

    const submitReport = async () => {
        if (!reportMessage || !chatroomId || !reportReason) return;
        setSubmittingReport(true);
        const result = await submitFriendChatMessageReport({
            chatroomId: String(chatroomId),
            chatMessageId: reportMessage.id,
            reason: reportReason,
            description: reportDescription,
        });
        setSubmittingReport(false);
        if (result.ok) {
            showToast({
                type: "success",
                title: result.data.created ? "Report submitted" : "Report already exists",
                message: result.message || "Our moderation team will review this message.",
            });
            closeReportModal();
        } else {
            showToast({ type: "error", title: "Report failed", message: result.message });
        }
    };

    // Unauthenticated state
    if (dmAccess?.status === "unauthenticated") {
        return (
            <ChatThread
                title={friendName}
                subtitle="Direct message"
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
        <>
        <ChatThread
            title={friendName}
            subtitle="Direct message"
            currentUserId={user?._id}
            messages={messages}
            participants={participants}
            loading={!rawFriendId || dmAccess === undefined || (!!chatroomId && rawMessages === undefined)}
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
            emptyTitle="No messages yet"
            emptySubtitle={`Start a conversation with ${friendName}!`}
            showComposer={Boolean(chatroomId)}
            onPickImage={handlePickImage}
            onPickFile={handlePickFile}
            typingNames={typingNames}
            presenceLabel={presenceLabel}
            onSwipeReply={handleSwipeReply}
            editingMessage={editingMessage}
            onClearEdit={() => { setEditingMessage(null); setInput(""); }}
        />
        <ReportIssueModal
            visible={Boolean(reportMessage)}
            title="Report Message"
            subtitle="Send this message to MatchHai moderation for review."
            reasons={CHAT_REPORT_REASONS}
            reason={reportReason}
            description={reportDescription}
            onChangeReason={setReportReason}
            onChangeDescription={setReportDescription}
            onSubmit={submitReport}
            onClose={closeReportModal}
            loading={submittingReport}
            descriptionPlaceholder="Add context for why this message should be reviewed."
        />
        </>
    );
}
