import { router } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { GAME_OPTIONS, SPORT_OPTIONS } from "../../../../constants/profileOptions";
import { AppIcon } from "../../../../src/components/AppIcon";
import { useEntrance } from "../../../../src/motion/useEntrance";
import { isProfileGameEnabled } from "../../../../src/services/userService";
import { COLORS } from "../../../../src/theme";
import { MotionPressable } from "./MotionPressable";
import styles from "../create.styles";

interface GameSelectorProps {
    selectedGame: string | null;
    onSelectGame: (gameKey: string) => void;
    userProfile: any; // User profile to check active games
    allowAllGames?: boolean;
    allowedGameKeys?: string[];
}

const GAME_ICONS: Record<string, string> = {
    cs2: "🎯",
    cs16: "💣",
    valorant: "⚡",
    fc26: "⚽",
    tekken8: "🥊",
    futsal: "🏟️",
    indoor_cricket: "🏏",
    padel: "🎾",
    pickleball: "🏓",
};
// Check if user has added this game to their profile
const isGameActive = (gameKey: string, profile: any): boolean => {
    return isProfileGameEnabled(profile, gameKey);
};

export default function GameSelector({
    selectedGame,
    onSelectGame,
    userProfile,
    allowAllGames = false,
    allowedGameKeys,
}: GameSelectorProps) {
    const { animatedStyle } = useEntrance({ distance: 14 });
    const allGames = [
        ...GAME_OPTIONS.map(g => ({ key: g.key, label: g.label })),
        ...SPORT_OPTIONS.map(s => ({ key: s.key, label: s.label })),
    ];

    const allowSet = Array.isArray(allowedGameKeys) ? new Set(allowedGameKeys) : null;

    const byProfile = allowAllGames ? allGames : allGames.filter(game => isGameActive(game.key, userProfile));
    const activeGames = allowSet
        ? byProfile.filter((game) => allowSet.has(game.key))
        : byProfile;

    if (activeGames.length === 0) {
        const isVenueFiltered = allowAllGames && allowSet !== null;
        return (
            <Animated.View style={[styles.section, animatedStyle]}>
                <Text style={styles.sectionLabel}>Select Game / Sport</Text>
                <View style={styles.emptyContainer}>
                    <AppIcon name="sports-esports" size={56} color={COLORS.muted} />
                    <Text style={styles.emptyTitle}>
                        {isVenueFiltered ? 'No Supported Games' : 'No Games Added'}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                        {isVenueFiltered
                            ? 'This venue branch has no supported games configured yet.'
                            : 'Add games to your profile to start creating matchrooms and playing with others'}
                    </Text>
                    {!isVenueFiltered ? (
                        <MotionPressable
                            style={styles.actionButton}
                            onPress={() => router.push('/(player)/(tabs)/profile')}
                        >
                            <Text style={styles.actionButtonText}>
                                Add Games
                            </Text>
                        </MotionPressable>
                    ) : null}
                </View>
            </Animated.View>
        );
    }

    return (
        <Animated.View style={[styles.section, animatedStyle]}>
            <Text style={styles.sectionLabel}>Select Game / Sport</Text>
            <View style={styles.gameGrid}>
                {activeGames.map((game) => (
                    <MotionPressable
                        key={game.key}
                        style={[
                            styles.gameCard,
                            selectedGame === game.key && styles.gameCardActive,
                        ]}
                        onPress={() => onSelectGame(game.key)}
                    >
                        <Text style={[
                            styles.gameIcon,
                            { fontSize: 32, textAlign: "center" }
                        ]}>
                            {GAME_ICONS[game.key] || "🎮"}
                        </Text>
                        <Text
                            style={[
                                styles.gameName,
                                selectedGame === game.key && styles.gameNameActive,
                            ]}
                        >
                            {game.label}
                        </Text>
                    </MotionPressable>
                ))}
            </View>
        </Animated.View>
    );
}
