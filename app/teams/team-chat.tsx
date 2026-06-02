import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
    useAudioRecorder,
    useAudioRecorderState,
} from "expo-audio";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";

import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import ChatThread from "../../src/features/chat/ChatThread";
import type { ChatThreadMessage } from "../../src/features/chat/types";
import { formatVoiceDuration } from "../../src/features/chat/utils";
import { useAuth } from "../../src/context/AuthContext";
import { useRouteLogger } from "../../src/hooks/useRouteLogger";
import { useToast } from "../../src/hooks/useToast";
import { uploadFileToConvex } from "../../src/services/convex/storageService";
import Logger from "../../src/utils/logger";

export default function TeamChatScreen() {
    const params = useLocalSearchParams<{ teamId?: string | string[] }>();
    const router = useRouter();
    const { user } = useAuth();
    const { showToast } = useToast();
    const teamIdParam = Array.isArray(params.teamId) ? params.teamId[0] : params.teamId;
    const teamId = teamIdParam as Id<"teams"> | undefined;

    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [replyTo, setReplyTo] = useState<ChatThreadMessage | null>(null);
    const [uploading, setUploading] = useState(false);
    useRouteLogger("TeamChatScreen", { teamId: teamIdParam, userId: user?._id });

    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(recorder, 250);

    const accessState = useQuery(api.teamChat.getAccess, teamId ? { teamId } : "skip");
    const chatData = useQuery(
        api.teamChat.getChat,
        teamId && accessState?.status === "ok" ? { teamId } : "skip",
    );
    const rawMessages = useQuery(
        api.teamChat.listMessages,
        teamId && accessState?.status === "ok" ? { teamId } : "skip",
    );

    const memberIds = useMemo<Id<"users">[]>(
        () => ((chatData?.participantUids || []) as string[]).filter(Boolean).map((uid) => uid as Id<"users">),
        [chatData?.participantUids],
    );
    const memberUsers = useQuery(api.users.getMany, memberIds.length > 0 ? { userIds: memberIds } : "skip");
    const memberById = useMemo(() => {
        const map: Record<string, any> = {};
        (memberUsers || []).forEach((entry: any) => {
            if (entry) map[String(entry._id)] = entry;
        });
        return map;
    }, [memberUsers]);

    const sendMessageMutation = useMutation(api.teamChat.sendMessage);
    const markReadMutation = useMutation(api.teamChat.markRead);

    const loading =
        !!teamId &&
        (accessState === undefined ||
            (accessState?.status === "ok" && (chatData === undefined || rawMessages === undefined)));

    const messages = useMemo<ChatThreadMessage[]>(
        () =>
            (rawMessages || []).map((message: any) => ({
                id: message._id,
                text: message.content || "",
                senderUid: String(message.senderUid),
                senderName: memberById[String(message.senderUid)]?.username || message.senderUsername || "Member",
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
            })),
        [rawMessages, memberById],
    );

    const participants = useMemo(
        () =>
            ((chatData?.participantUids || []) as string[]).map((uid) => {
                const member = memberById[uid];
                return {
                    uid,
                    label: uid === user?._id ? "You" : member?.username || member?.fullName || "Member",
                    photoURL: member?.photoURL || null,
                };
            }),
        [chatData?.participantUids, memberById, user?._id],
    );

    useEffect(() => {
        if (!teamId || !user?._id || messages.length === 0) return;
        void markReadMutation({ teamId }).catch((error: any) => {
            Logger.warn("TeamChat", "Failed to mark team chat as read", error);
        });
    }, [teamId, markReadMutation, messages.length, user?._id]);

    const replyPayload = useCallback(
        () =>
            replyTo
                ? {
                      messageId: replyTo.id,
                      senderName: replyTo.senderName,
                      text: replyTo.type === "voice" ? "Voice message" : replyTo.text.slice(0, 80),
                  }
                : undefined,
        [replyTo],
    );

    const sendTextMessage = async () => {
        if (!teamId || !user?._id || !draft.trim() || sending) return;
        setSending(true);
        try {
            await sendMessageMutation({
                teamId,
                text: draft.trim(),
                type: "text",
                clientMessageId: `${user._id}_${Date.now()}_text`,
                replyTo: replyPayload(),
            });
            setDraft("");
            setReplyTo(null);
        } catch (error: any) {
            Logger.error("TeamChat", "Failed to send text message", error);
            showToast({ type: "error", title: "Send failed", message: error?.message || "Unable to send message right now." });
        } finally {
            setSending(false);
        }
    };

    const toggleRecording = async () => {
        if (!teamId || !user?._id) return;

        if (recorderState.isRecording) {
            try {
                setUploading(true);
                await recorder.stop();
                const status = recorder.getStatus();
                const uri = recorder.uri || status.url;
                if (!uri) throw new Error("Recording file missing.");
                const durationMs = status.durationMillis || recorderState.durationMillis || 0;
                const uploaded = await uploadFileToConvex({
                    uri,
                    mimeType: "audio/m4a",
                    fileName: `team_voice_${user._id}_${Date.now()}.m4a`,
                });
                await sendMessageMutation({
                    teamId,
                    text: "",
                    type: "voice",
                    audioStorageId: uploaded.storageId,
                    audioDurationMs: durationMs,
                    clientMessageId: `${user._id}_${Date.now()}_voice`,
                    replyTo: replyPayload(),
                });
                setReplyTo(null);
                await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
            } catch (error) {
                Logger.error("TeamChat", "Failed to send voice message", error);
                showToast({ type: "error", title: "Voice message failed", message: "Unable to record or upload the voice message." });
            } finally {
                setUploading(false);
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
            Logger.error("TeamChat", "Failed to start recording", error);
            showToast({ type: "error", title: "Recording unavailable", message: "Unable to start recording right now." });
        }
    };

    const handlePickImage = useCallback(async () => {
        if (!teamId || !user?._id) return;
        try {
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];
            setUploading(true);
            const uploaded = await uploadFileToConvex({
                uri: asset.uri,
                mimeType: asset.mimeType || "image/jpeg",
                fileName: asset.fileName || `photo_${Date.now()}.jpg`,
            });
            await sendMessageMutation({
                teamId,
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
                replyTo: replyPayload(),
            });
            setReplyTo(null);
        } catch (error) {
            Logger.error("TeamChat", "Failed to send image", error);
            showToast({ type: "error", title: "Image failed", message: "Unable to send image." });
        } finally {
            setUploading(false);
        }
    }, [teamId, replyPayload, sendMessageMutation, showToast, user?._id]);

    const handlePickFile = useCallback(async () => {
        if (!teamId || !user?._id) return;
        try {
            const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
            if (result.canceled || !result.assets?.[0]) return;
            const asset = result.assets[0];
            setUploading(true);
            const uploaded = await uploadFileToConvex({
                uri: asset.uri,
                mimeType: asset.mimeType || "application/octet-stream",
                fileName: asset.name || `file_${Date.now()}`,
            });
            await sendMessageMutation({
                teamId,
                text: "",
                type: "file",
                attachment: {
                    storageId: uploaded.storageId,
                    fileName: asset.name || `file_${Date.now()}`,
                    mimeType: asset.mimeType || "application/octet-stream",
                    sizeBytes: asset.size,
                },
                clientMessageId: `${user._id}_${Date.now()}_file`,
                replyTo: replyPayload(),
            });
            setReplyTo(null);
        } catch (error) {
            Logger.error("TeamChat", "Failed to send file", error);
            showToast({ type: "error", title: "File failed", message: "Unable to send file." });
        } finally {
            setUploading(false);
        }
    }, [teamId, replyPayload, sendMessageMutation, showToast, user?._id]);

    const handleMessageLongPress = (message: ChatThreadMessage) => {
        Alert.alert("Message options", "", [
            { text: "Reply", onPress: () => setReplyTo(message) },
            message.type === "text"
                ? { text: "Copy", onPress: async () => { await Clipboard.setStringAsync(message.text || ""); } }
                : (undefined as any),
            { text: "Cancel", style: "cancel" },
        ].filter(Boolean));
    };

    const restrictedSubtitle =
        accessState?.status === "unauthenticated"
            ? "Sign in required"
            : accessState?.status === "forbidden"
                ? "Members only"
                : "Unavailable";
    const restrictedEmptyTitle =
        accessState?.status === "forbidden" ? "Members only" : "Chat unavailable";
    const restrictedEmptySubtitle =
        accessState?.status === "unauthenticated"
            ? "Refresh your session and reopen this chat."
            : accessState?.status === "forbidden"
                ? "Only accepted team members can access the team chat."
                : "This team could not be found.";

    if (teamId && accessState && accessState.status !== "ok") {
        return (
            <ChatThread
                title="Team chat"
                subtitle={restrictedSubtitle}
                currentUserId={user?._id}
                messages={[]}
                loading={false}
                input=""
                onInputChange={() => undefined}
                onBack={() => router.back()}
                onSendText={() => undefined}
                onToggleRecording={() => undefined}
                showComposer={false}
                emptyTitle={restrictedEmptyTitle}
                emptySubtitle={restrictedEmptySubtitle}
            />
        );
    }

    return (
        <ChatThread
            title={chatData?.teamName ? `${chatData.teamName} chat` : "Team chat"}
            subtitle="Team members only"
            currentUserId={user?._id}
            messages={messages}
            participants={participants}
            loading={loading}
            input={draft}
            onInputChange={setDraft}
            onBack={() => router.back()}
            onSendText={sendTextMessage}
            onToggleRecording={toggleRecording}
            sending={sending || uploading}
            recording={recorderState.isRecording}
            recordingDurationLabel={formatVoiceDuration(recorderState.durationMillis)}
            onMessageLongPress={handleMessageLongPress}
            replyTo={replyTo}
            onClearReply={() => setReplyTo(null)}
            onPickImage={handlePickImage}
            onPickFile={handlePickFile}
            onSwipeReply={(message) => setReplyTo(message)}
            emptyTitle="No messages yet"
            emptySubtitle="Say hello to your team."
        />
    );
}
