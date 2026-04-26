import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import Animated from "react-native-reanimated";

import AppHeader from "../../src/components/AppHeader";
import { AppIcon } from "../../src/components/AppIcon";
import Screen from "../../src/components/Screen";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../../src/context/AuthContext";
import { useRouteLogger } from "../../src/hooks/useRouteLogger";
import { usePressScale } from "../../src/motion/usePressScale";
import { recordPayloadMetric } from "../../src/utils/perfInstrumentation";
import { COLORS, FONTS, RADII, SHADOWS, SPACING } from "../../src/theme";

function formatUpdatedAt(value?: number) {
    if (!value) return "Now";
    return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const ChatroomRow = React.memo(function ChatroomRow({
    conversation,
    onOpen,
}: {
    conversation: any;
    onOpen: (path: string) => void;
}) {
    const isDM = conversation.kind === "dm";
    const isChallenge = conversation.kind === "challenge";
    const targetPath = isDM
        ? `/(player)/friend-chat/${conversation.friendId}`
        : isChallenge
            ? `/teams/challenge-chat?id=${conversation.id}`
            : `/matchrooms/chat/${conversation.matchroomId}`;

    const preview =
        conversation.lastMessage?.type === "voice"
            ? "Voice message"
            : conversation.lastMessage?.text || "Open conversation";

    const { animatedStyle, onPressIn, onPressOut } = usePressScale({
        activeScale: 0.992,
        activeOpacity: 0.9,
    });

    const handleOpen = useCallback(() => {
        onOpen(targetPath);
    }, [onOpen, targetPath]);

    return (
        <Pressable onPress={handleOpen} onPressIn={onPressIn} onPressOut={onPressOut}>
            <Animated.View style={[styles.card, animatedStyle]}>
                <View style={[styles.avatar, isDM ? styles.avatarDM : isChallenge ? styles.avatarChallenge : null]}>
                    <Text style={styles.avatarText}>
                        {String(conversation.title || "C").trim().charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View style={styles.cardBody}>
                    <View style={styles.cardTopRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                            {conversation.title}
                        </Text>
                        <Text style={styles.cardTime}>{formatUpdatedAt(conversation.updatedAt)}</Text>
                    </View>
                    <Text style={styles.cardSubtitle} numberOfLines={1}>
                        {conversation.subtitle}
                    </Text>
                    <Text style={styles.cardPreview} numberOfLines={1}>
                        {preview}
                    </Text>
                </View>
                {conversation.unreadCount > 0 ? (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{conversation.unreadCount}</Text>
                    </View>
                ) : null}
            </Animated.View>
        </Pressable>
    );
});

export default function ChatroomsScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [searchText, setSearchText] = useState("");
    useRouteLogger("ChatroomsScreen", { userId: user?._id });

    const matchChatsResult = useQuery(
        api.chat.listForUser,
        user?._id ? {} : "skip"
    );
    const challengeChatsResult = useQuery(
        api.teamChallengeChat.listForMe,
        user?._id ? {} : "skip"
    );
    const dmChatsResult = useQuery(
        api.friendChat.listForUser,
        user?._id ? {} : "skip"
    );

    const matchChats = matchChatsResult || [];
    const challengeChats = challengeChatsResult || [];
    const dmChats = dmChatsResult || [];
    const loading = !!user?._id && (matchChatsResult === undefined || challengeChatsResult === undefined || dmChatsResult === undefined);

    const conversations = useMemo(
        () => [...matchChats, ...challengeChats, ...dmChats].sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0)),
        [challengeChats, dmChats, matchChats]
    );

    const normalizedSearchText = searchText.trim().toLowerCase();
    const filteredConversations = useMemo(() => {
        if (!normalizedSearchText) return conversations;
        return conversations.filter((conversation: any) => {
            const haystack = [
                conversation.title,
                conversation.subtitle,
                conversation.lastMessage?.text,
                conversation.lastMessage?.senderName,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return haystack.includes(normalizedSearchText);
        });
    }, [conversations, normalizedSearchText]);

    useEffect(() => {
        recordPayloadMetric("chat.list_query_cost", conversations, {
            matchChats: matchChats.length,
            challengeChats: challengeChats.length,
            dmChats: dmChats.length,
        });
    }, [challengeChats.length, conversations, dmChats.length, matchChats.length]);

    const onOpenConversation = useCallback((path: string) => {
        router.push(path as any);
    }, [router]);

    const renderItem = useCallback(({ item: conversation }: { item: any }) => {
        return (
            <ChatroomRow conversation={conversation} onOpen={onOpenConversation} />
        );
    }, [onOpenConversation]);

    const keyExtractor = useCallback((item: any) => {
        return `${item?.kind || "chat"}-${item?.id || "unknown"}`;
    }, []);

    return (
        <Screen style={styles.screen} scroll={false} contentStyle={styles.screenContent}>
            <View style={styles.shell}>
                <View style={styles.headerWrap}>
                    <AppHeader title="Chats" onBack={() => router.back()} inlineTitle />
                </View>
                <FlatList
                    data={filteredConversations}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    removeClippedSubviews
                    initialNumToRender={8}
                    maxToRenderPerBatch={10}
                    windowSize={7}
                    ListHeaderComponent={
                        <View style={styles.searchBar}>
                            <AppIcon name="search" size={18} color="#64748b" />
                            <TextInput
                                value={searchText}
                                onChangeText={setSearchText}
                                placeholder="Search chats"
                                placeholderTextColor="#64748b"
                                style={styles.searchInput}
                            />
                        </View>
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            {loading ? (
                                <ActivityIndicator color={COLORS.accent} />
                            ) : !user?._id ? (
                                <>
                                    <AppIcon name="lock-outline" size={42} color="#94a3b8" />
                                    <Text style={styles.emptyTitle}>Sign in required</Text>
                                    <Text style={styles.emptySubtitle}>
                                        Refresh your session and reopen chats.
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <AppIcon name="forum" size={42} color="#94a3b8" />
                                    <Text style={styles.emptyTitle}>
                                        {normalizedSearchText ? "No chats found" : "No chats yet"}
                                    </Text>
                                    <Text style={styles.emptySubtitle}>
                                        {normalizedSearchText
                                            ? "Try a different search term."
                                            : "Join a matchroom, accept a team challenge, or message a friend to start chatting."}
                                    </Text>
                                </>
                            )}
                        </View>
                    }
                />
            </View>
        </Screen>
    );
}

const styles = {
    screen: {
        flex: 1,
        backgroundColor: "#dfe9e3",
    },
    screenContent: {
        flex: 1,
        paddingHorizontal: 0,
        paddingTop: 0,
        paddingBottom: 0,
    },
    shell: {
        flex: 1,
        margin: SPACING.md,
        borderRadius: 32,
        overflow: "hidden" as const,
        backgroundColor: "#f7faf8",
        ...SHADOWS.cardElevated,
    },
    headerWrap: {
        backgroundColor: "#ffffff",
        paddingTop: SPACING.md,
        paddingHorizontal: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(15,23,42,0.06)",
    },
    listContent: {
        padding: SPACING.lg,
        gap: SPACING.md,
    },
    searchBar: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: SPACING.sm,
        borderRadius: 18,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        backgroundColor: "#ffffff",
        borderWidth: 1,
        borderColor: "rgba(15,23,42,0.06)",
    },
    searchInput: {
        flex: 1,
        color: "#64748b",
        fontFamily: FONTS.body,
        fontSize: 13,
        paddingVertical: 0,
    },
    emptyState: {
        alignItems: "center" as const,
        justifyContent: "center" as const,
        paddingVertical: 80,
        paddingHorizontal: SPACING.xl,
    },
    emptyTitle: {
        marginTop: SPACING.sm,
        color: "#0f172a",
        fontFamily: FONTS.heading,
        fontSize: 18,
    },
    emptySubtitle: {
        marginTop: 6,
        color: "#64748b",
        fontFamily: FONTS.body,
        fontSize: 13,
        textAlign: "center" as const,
    },
    card: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: SPACING.md,
        backgroundColor: "#ffffff",
        borderRadius: 22,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: "rgba(15,23,42,0.06)",
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        backgroundColor: "#dcfce7",
    },
    avatarChallenge: {
        backgroundColor: "#dbeafe",
    },
    avatarDM: {
        backgroundColor: "#fce7f3",
    },
    avatarText: {
        color: "#0f172a",
        fontFamily: FONTS.heading,
        fontSize: 16,
    },
    cardBody: {
        flex: 1,
    },
    cardTopRow: {
        flexDirection: "row" as const,
        alignItems: "center" as const,
        justifyContent: "space-between" as const,
        gap: SPACING.md,
    },
    cardTitle: {
        flex: 1,
        color: "#0f172a",
        fontFamily: FONTS.heading,
        fontSize: 15,
    },
    cardTime: {
        color: "#94a3b8",
        fontFamily: FONTS.body,
        fontSize: 11,
    },
    cardSubtitle: {
        marginTop: 2,
        color: "#64748b",
        fontFamily: FONTS.body,
        fontSize: 11,
        textTransform: "capitalize" as const,
    },
    cardPreview: {
        marginTop: 4,
        color: "#334155",
        fontFamily: FONTS.body,
        fontSize: 12,
    },
    badge: {
        minWidth: 24,
        height: 24,
        borderRadius: 12,
        alignItems: "center" as const,
        justifyContent: "center" as const,
        backgroundColor: "#22c28a",
        paddingHorizontal: 6,
    },
    badgeText: {
        color: "#ffffff",
        fontFamily: FONTS.heading,
        fontSize: 11,
    },
};
