import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS, FONTS, SPACING } from "../../theme";
import type { ChatReaction } from "./types";

const REACTION_EMOJIS = ["\u{1F44D}", "\u{2764}\u{FE0F}", "\u{1F602}", "\u{1F525}", "\u{1F389}", "\u{1F622}"];

type AggregatedReaction = {
    emoji: string;
    count: number;
    includesMe: boolean;
};

function aggregateReactions(
    reactions: ChatReaction[],
    currentUserId: string | null | undefined
): AggregatedReaction[] {
    const map = new Map<string, { count: number; includesMe: boolean }>();
    for (const r of reactions) {
        const existing = map.get(r.emoji);
        if (existing) {
            existing.count += 1;
            if (String(r.userId) === currentUserId) existing.includesMe = true;
        } else {
            map.set(r.emoji, {
                count: 1,
                includesMe: String(r.userId) === currentUserId,
            });
        }
    }
    return Array.from(map.entries()).map(([emoji, data]) => ({
        emoji,
        ...data,
    }));
}

export function ChatReactionRow({
    reactions,
    currentUserId,
    mine,
    onToggle,
}: {
    reactions: ChatReaction[];
    currentUserId: string | null | undefined;
    mine: boolean;
    onToggle: (emoji: string) => void;
}) {
    if (!reactions || reactions.length === 0) return null;
    const aggregated = aggregateReactions(reactions, currentUserId);
    if (aggregated.length === 0) return null;

    return (
        <View style={[s.row, mine ? s.rowMine : s.rowOther]}>
            {aggregated.map((r) => (
                <Pressable
                    key={r.emoji}
                    onPress={(event) => {
                        event.stopPropagation();
                        onToggle(r.emoji);
                    }}
                    style={[s.chip, r.includesMe && s.chipActive]}
                >
                    <Text style={s.chipEmoji}>{r.emoji}</Text>
                    <Text style={[s.chipCount, r.includesMe && s.chipCountActive]}>
                        {r.count}
                    </Text>
                </Pressable>
            ))}
        </View>
    );
}

export function ChatReactionPicker({
    onSelect,
    onClose,
}: {
    onSelect: (emoji: string) => void;
    onClose: () => void;
}) {
    return (
        <View style={s.pickerRow}>
            {REACTION_EMOJIS.map((emoji) => (
                <Pressable
                    key={emoji}
                    onPress={(event) => {
                        event.stopPropagation();
                        onSelect(emoji);
                        onClose();
                    }}
                    style={s.pickerItem}
                >
                    <Text style={s.pickerEmoji}>{emoji}</Text>
                </Pressable>
            ))}
        </View>
    );
}

export { REACTION_EMOJIS };

const s = StyleSheet.create({
    row: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 4,
        marginTop: 4,
        paddingHorizontal: 4,
    },
    rowMine: {
        justifyContent: "flex-end",
    },
    rowOther: {
        justifyContent: "flex-start",
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        backgroundColor: COLORS.overlayLight,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        gap: 3,
    },
    chipActive: {
        backgroundColor: "rgba(66,165,245,0.18)",
        borderColor: COLORS.accent,
    },
    chipEmoji: {
        fontSize: 13,
    },
    chipCount: {
        fontSize: 11,
        fontFamily: FONTS.heading,
        color: COLORS.textSecondary,
    },
    chipCountActive: {
        color: COLORS.accent,
    },
    pickerRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: SPACING.sm,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    pickerItem: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    pickerEmoji: {
        fontSize: 22,
    },
});
