import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    StatusBar,
    Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";

import DiscoverMatchroomList from "../../../src/features/discover/components/DiscoverMatchroomList";
import DiscoverPlayerList from "../../../src/features/discover/components/DiscoverPlayerList";
import DiscoverTeamList from "../../../src/features/discover/components/DiscoverTeamList";
import DiscoverZoneList from "../../../src/features/discover/components/DiscoverZoneList";
import { DiscoverSegment, GameKey } from "../../../src/features/discover/types";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
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

const ALLOWED_SEGMENTS: DiscoverSegment[] = ['matchrooms', 'players', 'teams', 'zones'];

const getValidSegment = (s?: string): DiscoverSegment | null => {
    if (!s) return null;
    return ALLOWED_SEGMENTS.includes(s as DiscoverSegment) ? (s as DiscoverSegment) : null;
};

export default function DiscoverScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ segment?: string; mode?: string; t?: string }>();

    // Global State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGame, setSelectedGame] = useState<GameKey>('all');

    // Segment State
    const [activeSegment, setActiveSegment] = useState<DiscoverSegment>(
        getValidSegment(params.segment) || 'matchrooms'
    );

    // Lazy Loading State
    const [visitedSegments, setVisitedSegments] = useState<Set<DiscoverSegment>>(
        new Set([activeSegment])
    );

    // Sync activeSegment with URL params (handling navigation to same screen with different params)
    useEffect(() => {
        const validSegment = getValidSegment(params.segment);
        Logger.info("Discover", "Sync Effect", {
            paramSegment: params.segment,
            validSegment,
            currentActive: activeSegment,
            intentTime: params.t
        });

        if (validSegment && validSegment !== activeSegment) {
            Logger.info("Discover", "Updating activeSegment from param", { newSegment: validSegment });
            setActiveSegment(validSegment);
        } else if (params.mode === 'my' && activeSegment !== 'teams') {
            // Special Case: Direct link to My Teams
            Logger.info("Discover", "Switching to teams for mode=my");
            setActiveSegment('teams');
        } else if (validSegment === activeSegment && params.t) {
            // Force re-trigger of any child effects or logic if needed
            Logger.info("Discover", "Segment already active, but intent refreshed", { segment: validSegment });
        }
    }, [params.segment, params.mode, params.t]);

    // Log every state change for activeSegment
    useEffect(() => {
        Logger.info("Discover", "activeSegment state changed", { activeSegment });
    }, [activeSegment]);

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
            onPress={() => {
                setActiveSegment(segment);
                // Core Fix: Update URL params so they stay in sync with manual switch
                // Clear mode when switching segments manually to avoid sticking to 'my' mode
                router.setParams({ segment, mode: undefined } as any);
            }}
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
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={[styles.headerTitle, { marginBottom: 0 }]}>Discover</Text>
                        {activeSegment === 'teams' && (
                            <View /> // Placeholder where button used to be
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
                    {renderSegmentButton('zones', 'Venues')}
                </View>

                {/* Global Game Chips - Hidden for Venues tab (has its own filter system) */}
                {activeSegment !== 'zones' && (
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
                )}
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
                            initialMode={params.mode as any}
                            intentTime={params.t}
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

            {/* Floating Action Button (FAB) - Contextual for Rooms and Teams */}
            {(activeSegment === 'matchrooms' || activeSegment === 'teams') && (
                <View style={styles.fabWrapper}>
                    <TouchableOpacity
                        onPress={() => {
                            if (activeSegment === 'matchrooms') {
                                router.push("/matchrooms/create" as any);
                            } else {
                                router.push("/teams/create" as any);
                            }
                        }}
                        activeOpacity={0.8}
                        style={styles.fab}
                    >
                        <MaterialIcons name="add" size={28} color="#FFF" />
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
}
