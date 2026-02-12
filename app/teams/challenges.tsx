import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import {
    getChallengesForCaptain,
    repairTeamChallengesForCaptain,
    type TeamMatchChallenge,
} from "../../src/services/teamMatchService";
import { COLORS } from "../../src/theme";
import styles from "./challenges.styles";

const toMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    return 0;
};

export default function TeamChallengesScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rows, setRows] = useState<TeamMatchChallenge[]>([]);

    const fetchRows = useCallback(async () => {
        if (!user?.uid) {
            setRows([]);
            setLoading(false);
            return;
        }
        await repairTeamChallengesForCaptain(user.uid);
        const result = await getChallengesForCaptain(user.uid);
        if (result.ok && result.data) {
            setRows(result.data);
        } else {
            setRows([]);
        }
        setLoading(false);
        setRefreshing(false);
    }, [user?.uid]);

    useFocusEffect(useCallback(() => {
        fetchRows();
    }, [fetchRows]));

    const onRefresh = () => {
        setRefreshing(true);
        fetchRows();
    };

    if (loading) {
        return (
            <Screen style={styles.screen} scroll={false}>
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color={COLORS.accent} />
                </View>
            </Screen>
        );
    }

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader title="My Challenges" onBack={() => router.back()} inlineTitle />
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
            >
                {rows.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <MaterialIcons name="sports-esports" size={28} color={COLORS.muted} />
                        <Text style={styles.emptyTitle}>No challenges yet</Text>
                        <Text style={styles.emptyText}>Send or accept a team challenge to see it here.</Text>
                    </View>
                ) : (
                    rows.map((item) => {
                        const created = toMillis(item.createdAt);
                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.card}
                                onPress={() => router.push(`/teams/challenge?id=${item.id}` as any)}
                                activeOpacity={0.85}
                            >
                                <View style={styles.topRow}>
                                    <Text style={styles.title} numberOfLines={1}>
                                        {item.challengerTeamName} vs {item.opponentTeamName}
                                    </Text>
                                    <Text style={styles.status}>{item.status}</Text>
                                </View>
                                <Text style={styles.meta}>Game: {String(item.gameKey || "").toUpperCase()}</Text>
                                <Text style={styles.meta}>
                                    Common areas: {(item.commonAreas || []).length > 0 ? item.commonAreas.join(", ") : "None"}
                                </Text>
                                <Text style={styles.meta}>
                                    {created ? new Date(created).toLocaleString() : "Just now"}
                                </Text>
                                <View style={styles.linkRow}>
                                    <MaterialIcons name="arrow-forward" size={16} color={COLORS.accent} />
                                    <Text style={styles.linkText}>Open challenge workspace</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </Screen>
    );
}
