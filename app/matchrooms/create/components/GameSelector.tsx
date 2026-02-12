// app/matchrooms/create/components/GameSelector.tsx
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { GAME_OPTIONS, SPORT_OPTIONS } from '../../../../constants/profileOptions';
import { COLORS } from '../../../../src/theme';
import styles from '../create.styles';

interface GameSelectorProps {
    selectedGame: string | null;
    onSelectGame: (gameKey: string) => void;
    userProfile: any; // User profile to check active games
    allowAllGames?: boolean;
    allowedGameKeys?: string[];
}

const GAME_ICONS: Record<string, string> = {
    cs2: 'sports-esports',
    fc26: 'sports-soccer',
    tekken8: 'sports-kabaddi',
    futsal: 'sports-soccer',
    indoor_cricket: 'sports-cricket',
    padel: 'sports-tennis',
    pickleball: 'sports-tennis',
};

// Check if user has added this game to their profile
const isGameActive = (gameKey: string, profile: any): boolean => {
    if (!profile) return false;

    switch (gameKey) {
        case 'cs2': return !!(profile.cs2Role || profile.faceitSkillLevel);
        case 'fc26': return !!(profile.fcTeam || profile.fcFormation);
        case 'tekken8': return !!(profile.tekkenFavorites && profile.tekkenFavorites.length > 0);
        case 'futsal': return !!(profile.futsalPosition || (Array.isArray(profile.futsalPositions) && profile.futsalPositions.length > 0));
        case 'indoor_cricket': return !!(profile.indoorCricketRole || profile.indoorCricketBattingStyle || profile.indoorCricketBowlingStyle);
        case 'padel': return !!(profile.padelRole);
        case 'pickleball': return !!(profile.pickleballRole);
        default: return false;
    }
};

export default function GameSelector({
    selectedGame,
    onSelectGame,
    userProfile,
    allowAllGames = false,
    allowedGameKeys,
}: GameSelectorProps) {
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
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>Select Game / Sport</Text>
                <View style={styles.emptyContainer}>
                    <MaterialIcons name="sports-esports" size={56} color={COLORS.muted} />
                    <Text style={styles.emptyTitle}>
                        {isVenueFiltered ? 'No Supported Games' : 'No Games Added'}
                    </Text>
                    <Text style={styles.emptySubtitle}>
                        {isVenueFiltered
                            ? 'This venue branch has no supported games configured yet.'
                            : 'Add games to your profile to start creating matchrooms and playing with others'}
                    </Text>
                    {!isVenueFiltered ? (
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => router.push('/(player)/(tabs)/profile')}
                        >
                            <MaterialIcons name="add-circle" size={20} color={COLORS.background} />
                            <Text style={styles.actionButtonText}>
                                Add Games
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        );
    }

    return (
        <View style={styles.section}>
            <Text style={styles.sectionLabel}>Select Game / Sport</Text>
            <View style={styles.gameGrid}>
                {activeGames.map((game) => (
                    <TouchableOpacity
                        key={game.key}
                        style={[
                            styles.gameCard,
                            selectedGame === game.key && styles.gameCardActive,
                        ]}
                        onPress={() => onSelectGame(game.key)}
                    >
                        <MaterialIcons
                            name={GAME_ICONS[game.key] as any || 'sports-esports'}
                            size={32}
                            color={selectedGame === game.key ? COLORS.accent : COLORS.muted}
                            style={styles.gameIcon}
                        />
                        <Text
                            style={[
                                styles.gameName,
                                selectedGame === game.key && styles.gameNameActive,
                            ]}
                        >
                            {game.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}
