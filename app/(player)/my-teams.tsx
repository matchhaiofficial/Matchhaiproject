import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    Text,
    TextInput,
    View
} from "react-native";

import { AppIcon } from "../../src/components/AppIcon";
import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { getUserTeams, Team } from "../../src/services/convex/teamService";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";
import styles from "./(tabs)/teams.styles"; // Reuse styles from tabs/teams

const HIT_SLOP_8 = { top: 8, bottom: 8, left: 8, right: 8 } as const;

const TeamRow = React.memo(function TeamRow({
    team,
    onOpenTeam,
}: {
    team: Team;
    onOpenTeam: (teamId: string) => void;
}) {
    const maxMembers = team.maxMembers || 0;
    const rawMemberCount = team.memberUids?.length ?? team.memberCount ?? 0;
    const memberCount = maxMembers > 0 ? Math.min(rawMemberCount, maxMembers) : rawMemberCount;

    const handleOpen = useCallback(() => {
        if (!team.id) return;
        onOpenTeam(team.id);
    }, [onOpenTeam, team.id]);

    return (
        <Pressable
            disabled={!team.id}
            style={({ pressed }) => [styles.teamCard, pressed && styles.teamCardPressed]}
            onPress={handleOpen}
        >
            <View style={styles.teamTopRow}>
                <Text style={styles.teamGame}>{(team.game || '???').toUpperCase()}</Text>
                <View style={styles.memberCountRow}>
                    <AppIcon name="people" size={12} color={COLORS.muted} />
                    <Text style={styles.memberCountText}>
                        {memberCount} / {maxMembers}
                    </Text>
                </View>
            </View>

            <View style={styles.teamTitleRow}>
                <Text style={styles.teamName} numberOfLines={1}>{team.name}</Text>
                <Pressable style={styles.viewBtn} onPress={handleOpen} hitSlop={HIT_SLOP_8} disabled={!team.id}>
                    <Text style={styles.viewBtnText}>View</Text>
                </Pressable>
            </View>

            <View style={styles.teamBottomRow}>
                <View style={styles.captainRow}>
                    <AppIcon name="person" size={12} color={COLORS.muted} />
                    <Text style={styles.captainText}>
                        Cap: {team.captainUsername || "Unknown"}
                    </Text>
                </View>
                <View style={styles.statsTag}>
                    <Text style={styles.statsText}>
                        {(team.stats?.wins || 0) + (team.stats?.losses || 0)} MATCHES
                    </Text>
                </View>
            </View>
        </Pressable>
    );
});

export default function MyTeams() {
    const router = useRouter();
    const { user } = useAuth();

    // Data State
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchTeams = useCallback(async (showRefresh = false) => {
        if (!user?._id) {
            setTeams([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }
        try {
            if (showRefresh) setRefreshing(true);
            const result = await getUserTeams(user._id);
            if (result.ok && result.data) {
                setTeams(result.data);
            }
        } catch (error) {
            Logger.error("MyTeams", "Error fetching teams", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?._id]);

    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);

    const onRefresh = useCallback(() => {
        fetchTeams(true);
    }, [fetchTeams]);

    const filteredTeams = useMemo(() => {
        return teams.filter(team => {
            if (searchQuery) {
                const queryContent = searchQuery.toLowerCase();
                const matchesSearch =
                    team.name.toLowerCase().includes(queryContent) ||
                    (team.game || '').toLowerCase().includes(queryContent);
                if (!matchesSearch) return false;
            }
            return true;
        });
    }, [teams, searchQuery]);

    const onOpenTeam = useCallback((teamId: string) => {
        router.push(`/teams/${teamId}` as any);
    }, [router]);

    const renderTeamItem = useCallback(({ item }: { item: Team }) => {
        return <TeamRow team={item} onOpenTeam={onOpenTeam} />;
    }, [onOpenTeam]);

    const keyExtractor = useCallback((item: Team, index: number) => {
        return item.id || `${item.name || "team"}-${index}`;
    }, []);

    const clearSearch = useCallback(() => {
        setSearchQuery("");
    }, []);

    if (loading) {
        return (
            <Screen style={styles.screen} scroll={false}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            </Screen>
        );
    }

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader title="My Teams" onBack={() => router.back()} />

            {/* Search Bar */}
            <View style={styles.searchBar}>
                <AppIcon name="search" size={20} color={COLORS.muted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search my teams..."
                    placeholderTextColor={COLORS.muted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <Pressable onPress={clearSearch} hitSlop={HIT_SLOP_8}>
                        <AppIcon name="close" size={20} color={COLORS.muted} />
                    </Pressable>
                )}
            </View>

            {/* Results Count Section */}
            <View style={styles.resultsCount}>
                <Text style={styles.resultsCountText}>
                    {filteredTeams.length} team{filteredTeams.length !== 1 ? 's' : ''} found
                </Text>
            </View>

            <FlatList
                data={filteredTeams}
                renderItem={renderTeamItem}
                keyExtractor={keyExtractor}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
                initialNumToRender={8}
                maxToRenderPerBatch={10}
                windowSize={7}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <AppIcon name="group-off" size={64} color={COLORS.muted} style={styles.emptyIcon} />
                        <Text style={styles.emptyTitle}>No Teams Yet</Text>
                        <Text style={styles.emptyText}>
                            {searchQuery
                                ? "No teams match your search criteria."
                                : "You haven't joined or created any teams. Create a team to start competing!"
                            }
                        </Text>
                    </View>
                }
            />

            {/* Create Team FAB */}
            <Pressable
                onPress={() => router.push('/teams/create' as any)}
                style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            >
                <AppIcon name="add" size={28} color="#FFF" />
            </Pressable>
        </Screen>
    );
}
