import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    SafeAreaView,
    StatusBar,
    Platform
} from "react-native";
import { useRouter } from "expo-router";

import DiscoverMatchroomList from "../../../src/features/discover/components/DiscoverMatchroomList";
import DiscoverPlayerList from "../../../src/features/discover/components/DiscoverPlayerList";
import DiscoverTeamList from "../../../src/features/discover/components/DiscoverTeamList";
import DiscoverZoneList from "../../../src/features/discover/components/DiscoverZoneList";
import { DiscoverSegment, GameKey } from "../../../src/features/discover/types";
import { COLORS } from "../../../src/theme";
import styles from "./discover.styles";

// Global Game Configuration
const GAMES: { key: GameKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'cs2', label: 'CS2' },
    { key: 'fc26', label: 'FC26' },
    { key: 'tekken8', label: 'Tekken 8' },
    { key: 'futsal', label: 'Futsal' },
    { key: 'indoor_cricket', label: 'Cricket' },
    { key: 'padel', label: 'Padel' },
    { key: 'pickleball', label: 'Pickleball' },
];

export default function DiscoverScreen() {
    const router = useRouter();
    // Global State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGame, setSelectedGame] = useState<GameKey>('all');

    // Segment State
    const [activeSegment, setActiveSegment] = useState<DiscoverSegment>('matchrooms');

    // Lazy Loading State: Track which segments have been visited to keep them mounted
    const [visitedSegments, setVisitedSegments] = useState<Set<DiscoverSegment>>(new Set(['matchrooms']));

    // Update visited segments when active segment changes
    useEffect(() => {
        setVisitedSegments(prev => {
            if (prev.has(activeSegment)) return prev;
            const newSet = new Set(prev);
            newSet.add(activeSegment);
            return newSet;
        });
    }, [activeSegment]);

    const renderSegmentButton = (segment: DiscoverSegment, label: string) => (
        <TouchableOpacity
            onPress={() => setActiveSegment(segment)}
            style={[styles.segmentButton, activeSegment === segment && styles.segmentButtonActive]}
        >
            <Text style={[styles.segmentText, activeSegment === segment && styles.segmentTextActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.screen}>
            {/* Header Section */}
            <View style={styles.header}>
                <View style={styles.headerTopRow}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={[styles.headerTitle, { marginBottom: 0 }]}>Discover</Text>
                        {activeSegment === 'teams' && (
                            <TouchableOpacity
                                onPress={() => router.push('/(player)/my-teams' as any)}
                                style={{
                                    backgroundColor: 'rgba(66, 165, 245, 0.1)',
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    borderRadius: 16,
                                    borderWidth: 1,
                                    borderColor: 'rgba(66, 165, 245, 0.3)'
                                }}
                            >
                                <Text style={{ color: COLORS.accent, fontWeight: 'bold', fontSize: 12 }}>My Teams</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Search Bar */}
                    <View style={styles.searchBar}>
                        <MaterialIcons name="search" size={20} color={COLORS.muted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={`Search ${activeSegment}...`}
                            placeholderTextColor={COLORS.muted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery("")}>
                                <MaterialIcons name="close" size={20} color={COLORS.muted} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Internal Segment Tabs (Now using View for full width/tab style) */}
                <View style={styles.segmentContainer}>
                    {renderSegmentButton('matchrooms', 'Rooms')}
                    {renderSegmentButton('players', 'Players')}
                    {renderSegmentButton('teams', 'Teams')}
                    {renderSegmentButton('zones', 'Zones')}
                </View>

                {/* Global Game Chips */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={[styles.itemFiltersScroll, { marginTop: 12 }]}
                    contentContainerStyle={styles.itemFiltersContent}
                >
                    {GAMES.map(game => (
                        <TouchableOpacity
                            key={game.key}
                            onPress={() => setSelectedGame(game.key)}
                            style={[
                                styles.optionChip,
                                selectedGame === game.key && styles.optionChipActive
                            ]}
                        >
                            <Text style={[
                                styles.optionChipText,
                                selectedGame === game.key && styles.optionChipTextActive
                            ]}>
                                {game.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Content Area - Lazy Mounted & Persisted */}
            <View style={{ flex: 1 }}>
                {visitedSegments.has('matchrooms') && (
                    <View style={{ flex: 1, display: activeSegment === 'matchrooms' ? 'flex' : 'none' }}>
                        <DiscoverMatchroomList
                            selectedGame={selectedGame}
                            searchQuery={searchQuery}
                        />
                    </View>
                )}

                {visitedSegments.has('players') && (
                    <View style={{ flex: 1, display: activeSegment === 'players' ? 'flex' : 'none' }}>
                        <DiscoverPlayerList
                            selectedGame={selectedGame}
                            searchQuery={searchQuery}
                        />
                    </View>
                )}

                {visitedSegments.has('teams') && (
                    <View style={{ flex: 1, display: activeSegment === 'teams' ? 'flex' : 'none' }}>
                        <DiscoverTeamList
                            selectedGame={selectedGame}
                            searchQuery={searchQuery}
                        />
                    </View>
                )}

                {visitedSegments.has('zones') && (
                    <View style={{ flex: 1, display: activeSegment === 'zones' ? 'flex' : 'none' }}>
                        <DiscoverZoneList
                            selectedGame={selectedGame}
                            searchQuery={searchQuery}
                        />
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}
