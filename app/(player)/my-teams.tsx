import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";

import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";
import { db } from "../../src/config/firebaseConfig";
import { useAuth } from "../../src/context/AuthContext";
import { getUserTeams, Team } from "../../src/services/convex/teamService";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";
import styles from "./(tabs)/teams.styles"; // Reuse styles from tabs/teams

export default function MyTeams() {
    const router = useRouter();
    const { user } = useAuth();

    // Data State
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Repair logic (kept for admin/captain utility if needed, strictly for 'my' context)
    const repairTeams = async () => {
        if (!user) return;
        try {
            setRefreshing(true);
            const q = query(
                collection(db, 'teams'),
                where('captainUid', '==', user._id)
            );
            const snap = await getDocs(q);
            const batchPromises = [];

            for (const teamDoc of snap.docs) {
                const data = teamDoc.data();
                if (!data.memberUids) {
                    batchPromises.push(updateDoc(doc(db, 'teams', teamDoc.id), {
                        memberUids: [user._id]
                    }));
                }
            }

            if (batchPromises.length > 0) {
                await Promise.all(batchPromises);
                Alert.alert("Success", `Repaired ${batchPromises.length} teams.`);
                fetchTeams();
            } else {
                Alert.alert("Info", "All your teams are healthy.");
            }
        } catch (e) {
            Logger.error("MyTeams", "Repair error", e);
            Alert.alert("Error", "Failed to repair teams.");
        } finally {
            setRefreshing(false);
        }
    };

    const fetchTeams = async () => {
        if (!user) return;
        try {
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
    };

    useEffect(() => {
        fetchTeams();
    }, [user]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchTeams();
    };

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

    const renderTeamItem = ({ item }: { item: Team }) => {
        const maxMembers = item.maxMembers || 0;
        const rawMemberCount = item.memberUids?.length ?? item.memberCount ?? 0;
        const memberCount = maxMembers > 0 ? Math.min(rawMemberCount, maxMembers) : rawMemberCount;
        return (
            <Pressable
                style={({ pressed }) => [
                    styles.teamCard,
                    pressed && { opacity: 0.9 }
                ]}
                onPress={() => router.push(`/teams/${item.id}` as any)}
            >
                <View style={styles.teamTopRow}>
                    <Text style={styles.teamGame}>{(item.game || '???').toUpperCase()}</Text>
                    <View style={styles.memberCountRow}>
                        <MaterialIcons name="people" size={12} color={COLORS.muted} />
                        <Text style={styles.memberCountText}>
                            {memberCount} / {maxMembers}
                        </Text>
                    </View>
                </View>

                <View style={styles.teamTitleRow}>
                    <Text style={styles.teamName} numberOfLines={1}>{item.name}</Text>
                    <TouchableOpacity
                        style={styles.viewBtn}
                        onPress={() => router.push(`/teams/${item.id}` as any)}
                    >
                        <Text style={styles.viewBtnText}>View</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.teamBottomRow}>
                    <View style={styles.captainRow}>
                        <MaterialIcons name="person" size={12} color={COLORS.muted} />
                        <Text style={styles.captainText}>
                            Cap: {item.captainUsername || "Unknown"}
                        </Text>
                    </View>
                    <View style={styles.statsTag}>
                        <Text style={styles.statsText}>
                            {(item.stats?.wins || 0) + (item.stats?.losses || 0)} MATCHES
                        </Text>
                    </View>
                </View>
            </Pressable>
        );
    };

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
                <MaterialIcons name="search" size={20} color={COLORS.muted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search my teams..."
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

            {/* Results Count Section */}
            <View style={styles.resultsCount}>
                <Text style={styles.resultsCountText}>
                    {filteredTeams.length} team{filteredTeams.length !== 1 ? 's' : ''} found
                </Text>
            </View>

            <FlatList
                data={filteredTeams}
                renderItem={renderTeamItem}
                keyExtractor={(item) => item.id!}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <MaterialIcons name="group-off" size={64} color={COLORS.muted} style={styles.emptyIcon} />
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
            <View
                style={{
                    position: 'absolute',
                    bottom: 40,
                    right: 24,
                    zIndex: 1000,
                    elevation: 10,
                }}
                pointerEvents="box-none"
            >
                <TouchableOpacity
                    onPress={() => router.push('/teams/create' as any)}
                    activeOpacity={0.8}
                    style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: COLORS.accent,
                        alignItems: 'center',
                        justifyContent: 'center',
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 8,
                    }}
                >
                    <MaterialIcons name="add" size={28} color="#FFF" />
                </TouchableOpacity>
            </View>
        </Screen>
    );
}
