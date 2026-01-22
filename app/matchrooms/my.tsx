import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    RefreshControl,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../src/context/AuthContext";
import { getUserMatchrooms, Matchroom } from "../../src/services/matchService";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";
import { getRoomDisplayStatus } from "../../src/utils/matchroomLifecycle";
import styles from "./my.styles";

type Tab = 'hosted' | 'joined';

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
            const res = await getUserMatchrooms(user.uid);
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

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const renderMatchCard = ({ item }: { item: Matchroom }) => {
        const isHost = item.hostUid === user?.uid;
        const myPlayer = item.players.find(p => p.uid === user?.uid);

        return (
            <TouchableOpacity
                style={styles.matchCard}
                onPress={() => router.push(`/matchrooms/${item.id}`)}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.gameBadge}>
                        <Text style={styles.gameText}>{item.game}</Text>
                    </View>
                    <View style={[
                        styles.statusBadge,
                        {
                            backgroundColor:
                                getRoomDisplayStatus(item) === 'open' ? COLORS.success :
                                    getRoomDisplayStatus(item) === 'locked' ? COLORS.warning :
                                        getRoomDisplayStatus(item) === 'expired' ? '#FF5722' :
                                            COLORS.muted
                        }
                    ]}>
                        <Text style={styles.statusText}>{getRoomDisplayStatus(item).toUpperCase()}</Text>
                    </View>
                </View>

                <Text style={styles.cardTitle}>{item.title}</Text>

                <View style={styles.cardDetails}>
                    <MaterialIcons name="schedule" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.detailText}>
                        {item.startTime ? new Date(item.startTime.seconds * 1000).toLocaleDateString() : 'Flexible'}
                    </Text>

                    <MaterialIcons name="people" size={14} color={COLORS.textSecondary} />
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
                        <MaterialIcons name="arrow-forward" size={14} color={COLORS.textSecondary} />
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                </Pressable>
                <Text style={styles.headerTitle}>My Matchrooms</Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'hosted' && styles.activeTab]}
                    onPress={() => setActiveTab('hosted')}
                >
                    <Text style={[styles.tabText, activeTab === 'hosted' && styles.activeTabText]}>
                        Hosted ({hostedRooms.length})
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'joined' && styles.activeTab]}
                    onPress={() => setActiveTab('joined')}
                >
                    <Text style={[styles.tabText, activeTab === 'joined' && styles.activeTabText]}>
                        Joined ({joinedRooms.length})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            ) : (
                <FlatList
                    data={activeTab === 'hosted' ? hostedRooms : joinedRooms}
                    renderItem={renderMatchCard}
                    keyExtractor={(item) => item.id!}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialIcons name="sports-esports" size={48} color={COLORS.overlayLight} />
                            <Text style={styles.emptyText}>
                                {activeTab === 'hosted'
                                    ? "You haven't hosted any matchrooms yet."
                                    : "You haven't joined any matchrooms yet."}
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}
