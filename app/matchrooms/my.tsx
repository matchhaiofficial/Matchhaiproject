import { useRouter } from "expo-router";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    Text,
    View
} from "react-native";
import { AppIcon } from "../../src/components/AppIcon";
import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";

import { useAuth } from "../../src/context/AuthContext";
import { getUserMatchrooms, Matchroom } from "../../src/services/convex/matchService";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";
import { getRoomDisplayStatus } from "../../src/utils/matchroomLifecycle";
import styles from "./my.styles";

type Tab = 'hosted' | 'joined';

type MatchroomCardProps = {
    item: Matchroom;
    userId?: string;
    onPress: (id: string) => void;
};

function getStatusBadgeStyle(status: string) {
    switch (status) {
        case 'open':
            return styles.statusBadgeOpen;
        case 'locked':
            return styles.statusBadgeLocked;
        case 'expired':
            return styles.statusBadgeExpired;
        default:
            return styles.statusBadgeDefault;
    }
}

const MatchroomCard = memo(function MatchroomCard({ item, userId, onPress }: MatchroomCardProps) {
    const isHost = item.hostUid === userId;
    const myPlayer = item.players.find(p => p.uid === userId);
    const status = getRoomDisplayStatus(item);
    const startLabel = item.startTime ? new Date(item.startTime.seconds * 1000).toLocaleDateString() : 'Flexible';

    return (
        <Pressable
            style={({ pressed }) => [styles.matchCard, pressed && styles.matchCardPressed]}
            onPress={() => onPress(item.id!)}
        >
            <View style={styles.cardHeader}>
                <View style={styles.gameBadge}>
                    <Text style={styles.gameText}>{item.game}</Text>
                </View>
                <View style={[styles.statusBadge, getStatusBadgeStyle(status)]}>
                    <Text style={styles.statusText}>{status.toUpperCase()}</Text>
                </View>
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>

            <View style={styles.cardDetails}>
                <AppIcon name="schedule" size={14} color={COLORS.textSecondary} />
                <Text style={styles.detailText}>{startLabel}</Text>

                <AppIcon name="people" size={14} color={COLORS.textSecondary} />
                <Text style={styles.detailText}>
                    {item.players.length}/{item.maxPlayers}
                </Text>
            </View>

            <View style={styles.cardFooter}>
                <Text style={styles.roleText}>
                    {isHost ? 'You are Host' : `Role: ${myPlayer?.role || 'Member'}`}
                </Text>
                <View style={styles.viewButton}>
                    <Text style={styles.viewButtonText}>View Lobby</Text>
                    <AppIcon name="arrow-forward" size={14} color={COLORS.textSecondary} />
                </View>
            </View>
        </Pressable>
    );
});

export default function MyMatchrooms() {
    const router = useRouter();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('hosted');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [hostedRooms, setHostedRooms] = useState<Matchroom[]>([]);
    const [joinedRooms, setJoinedRooms] = useState<Matchroom[]>([]);

    const fetchData = async () => {
        if (!user) return;
        try {
            const res = await getUserMatchrooms(user._id);
            if (res.ok && res.data) {
                setHostedRooms(res.data.hosted);
                setJoinedRooms(res.data.joined);
            }
        } catch (e) {
            Logger.error("MyMatchrooms", "Error fetching data", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData();
    }, []);

    const openRoom = useCallback((id: string) => {
        router.push(`/matchrooms/${id}`);
    }, [router]);

    const renderMatchCard = useCallback(
        ({ item }: { item: Matchroom }) => (
            <MatchroomCard item={item} userId={user?._id} onPress={openRoom} />
        ),
        [openRoom, user?._id],
    );

    const activeRooms = useMemo(
        () => (activeTab === 'hosted' ? hostedRooms : joinedRooms),
        [activeTab, hostedRooms, joinedRooms],
    );

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader title="My Matchrooms" onBack={() => router.back()} inlineTitle />

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <Pressable
                    style={({ pressed }) => [styles.tab, activeTab === 'hosted' && styles.activeTab, pressed && styles.tabPressed]}
                    onPress={() => setActiveTab('hosted')}
                >
                    <Text style={[styles.tabText, activeTab === 'hosted' && styles.activeTabText]}>
                        Hosted ({hostedRooms.length})
                    </Text>
                </Pressable>
                <Pressable
                    style={({ pressed }) => [styles.tab, activeTab === 'joined' && styles.activeTab, pressed && styles.tabPressed]}
                    onPress={() => setActiveTab('joined')}
                >
                    <Text style={[styles.tabText, activeTab === 'joined' && styles.activeTabText]}>
                        Joined ({joinedRooms.length})
                    </Text>
                </Pressable>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            ) : (
                <FlatList
                    data={activeRooms}
                    renderItem={renderMatchCard}
                    keyExtractor={(item) => item.id!}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <AppIcon name="sports-esports" size={48} style={styles.emptyIcon} />
                            <Text style={styles.emptyText}>
                                {activeTab === 'hosted'
                                    ? "You haven't hosted any matchrooms yet."
                                    : "You haven't joined any matchrooms yet."}
                            </Text>
                        </View>
                    }
                />
            )}
        </Screen>
    );
}
