import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppIcon } from "../../components/AppIcon";
import { COLORS, FONTS, SPACING } from "../../theme";
import type { ChatThreadMessage } from "./types";

type ChatPinnedBannerProps = {
    pinnedMessages: ChatThreadMessage[];
    onJumpToMessage?: (messageId: string) => void;
    onUnpin?: (messageId: string) => void;
    canUnpin?: boolean;
};

export default function ChatPinnedBanner({
    pinnedMessages,
    onJumpToMessage,
    onUnpin,
    canUnpin = false,
}: ChatPinnedBannerProps) {
    const [expanded, setExpanded] = useState(false);

    const toggle = useCallback(() => setExpanded((prev) => !prev), []);

    if (pinnedMessages.length === 0) return null;

    return (
        <View style={localStyles.container}>
            <Pressable onPress={toggle} style={localStyles.header}>
                <AppIcon name="push-pin" size={14} color={localStyles.accentColor.color} />
                <Text style={localStyles.headerText}>
                    {pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? "s" : ""}
                </Text>
                <AppIcon
                    name={expanded ? "expand-less" : "expand-more"}
                    size={18}
                    color={COLORS.textSecondary}
                />
            </Pressable>
            {expanded
                ? pinnedMessages.map((message) => (
                    <View key={message.id} style={localStyles.pinnedRow}>
                        <Pressable
                            style={localStyles.pinnedContent}
                            onPress={() => onJumpToMessage?.(message.id)}
                        >
                            <Text style={localStyles.pinnedSender} numberOfLines={1}>
                                {message.senderName}
                            </Text>
                            <Text style={localStyles.pinnedText} numberOfLines={2}>
                                {message.type === "voice"
                                    ? "Voice message"
                                    : message.type === "image"
                                        ? "Photo"
                                        : message.type === "file"
                                            ? message.attachment?.fileName || "File"
                                            : message.text}
                            </Text>
                        </Pressable>
                        {canUnpin && onUnpin ? (
                            <Pressable
                                onPress={() => onUnpin(message.id)}
                                hitSlop={8}
                                style={localStyles.unpinButton}
                            >
                                <AppIcon name="close" size={14} color={COLORS.textSecondary} />
                            </Pressable>
                        ) : null}
                    </View>
                ))
                : null}
        </View>
    );
}

const localStyles = StyleSheet.create({
    container: {
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
        borderRadius: 14,
        backgroundColor: "rgba(255,193,7,0.10)",
        borderWidth: 1,
        borderColor: "rgba(255,193,7,0.25)",
        overflow: "hidden",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.xs,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    headerText: {
        flex: 1,
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 12,
    },
    accentColor: {
        color: "#FFC107",
    },
    pinnedRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderTopWidth: 1,
        borderTopColor: "rgba(255,193,7,0.12)",
    },
    pinnedContent: {
        flex: 1,
    },
    pinnedSender: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
        fontSize: 11,
    },
    pinnedText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 12,
        marginTop: 2,
    },
    unpinButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
});
