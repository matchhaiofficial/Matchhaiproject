import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../../src/context/AuthContext";
import { COLORS } from "../../src/theme";
import styles from "./challenge-chat.styles";

type ChallengeMessage = {
    _id: string;
    text: string;
    senderUid: string;
    senderName: string;
    createdAt: number;
};

export default function TeamChallengeChatScreen() {
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const router = useRouter();
    const { user } = useAuth();
    const chatId = Array.isArray(params.id) ? params.id[0] : params.id;

    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);

    // Real-time query for chat existence
    const chatData = useQuery(
        api.teamChallengeChat.getChat,
        chatId ? { chatId } : "skip"
    );

    // Real-time query for messages
    const messages = useQuery(
        api.teamChallengeChat.listMessages,
        chatId ? { chatId } : "skip"
    );

    const sendMessageMutation = useMutation(api.teamChallengeChat.sendMessage);

    const loading = chatId && chatData === undefined && messages === undefined;

    const sendMessage = async () => {
        if (!chatId || !user?._id || !draft.trim() || sending) return;
        setSending(true);
        const text = draft.trim();
        setDraft("");
        try {
            await sendMessageMutation({
                chatId,
                senderUid: user._id,
                senderName: user.fullName || "Captain",
                text,
            });
        } catch (error) {
            // Message failed, restore draft
            setDraft(text);
        }
        setSending(false);
    };

    const canSend = useMemo(() => !!draft.trim() && !sending, [draft, sending]);

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader title="Captains Chat" onBack={() => router.back()} inlineTitle />
            {loading ? (
                <View style={styles.loaderWrap}>
                    <ActivityIndicator color={COLORS.accent} />
                </View>
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex1}>
                    <FlatList
                        data={messages ?? []}
                        keyExtractor={(item) => item._id}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => {
                            const mine = item.senderUid === user?._id;
                            return (
                                <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
                                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                                        <Text style={styles.senderName}>{mine ? "You" : item.senderName}</Text>
                                        <Text style={styles.messageText}>{item.text}</Text>
                                    </View>
                                </View>
                            );
                        }}
                    />
                    <View style={styles.inputWrap}>
                        <TextInput
                            value={draft}
                            onChangeText={setDraft}
                            style={styles.input}
                            placeholder="Discuss venue..."
                            placeholderTextColor={COLORS.muted}
                            multiline
                        />
                        <TouchableOpacity
                            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
                            disabled={!canSend}
                            onPress={sendMessage}
                        >
                            <MaterialIcons name="send" size={18} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            )}
        </Screen>
    );
}
