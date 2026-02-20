import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { useAuth } from "../../src/context/AuthContext";
import { addDocToCollection, serverTimestampValue, subscribeDoc, subscribeDocs, updateDocByPath } from "../../src/services/firestoreService";
import { COLORS } from "../../src/theme";
import styles from "./challenge-chat.styles";

type ChallengeMessage = {
    id: string;
    text: string;
    senderUid: string;
    senderName: string;
    createdAt?: any;
};

const toMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    return 0;
};

export default function TeamChallengeChatScreen() {
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const router = useRouter();
    const { user } = useAuth();
    const chatId = Array.isArray(params.id) ? params.id[0] : params.id;

    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<ChallengeMessage[]>([]);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (!chatId || !user?.uid) return;
        const unsubChat = subscribeDoc(
            ["team_match_chats", chatId],
            (snap) => {
                setLoading(!snap.exists);
            },
        );

        const unsubMessages = subscribeDocs(
            {
                collectionPath: ["team_match_chats", chatId, "messages"],
                orderBy: [{ field: "createdAt", direction: "asc" }],
            },
            (docs) => {
            const rows = docs.map((item) => ({ id: item.id, ...item.data } as ChallengeMessage));
            rows.sort((a: ChallengeMessage, b: ChallengeMessage) => toMillis(a.createdAt) - toMillis(b.createdAt));
            setMessages(rows);
            },
        );

        return () => {
            unsubChat();
            unsubMessages();
        };
    }, [chatId, user?.uid]);

    const sendMessage = async () => {
        if (!chatId || !user?.uid || !draft.trim() || sending) return;
        setSending(true);
        const text = draft.trim();
        setDraft("");
        await addDocToCollection(["team_match_chats", chatId, "messages"], {
            senderUid: user.uid,
            senderName: user.displayName || "Captain",
            text,
            createdAt: serverTimestampValue(),
        });
        await updateDocByPath(["team_match_chats", chatId], {
            updatedAt: serverTimestampValue(),
            lastMessage: {
                text,
                senderUid: user.uid,
            },
            [`lastReadBy.${user.uid}`]: serverTimestampValue(),
        });
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
                        data={messages}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        renderItem={({ item }) => {
                            const mine = item.senderUid === user?.uid;
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

