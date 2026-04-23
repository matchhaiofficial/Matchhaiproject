import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    Text,
    Pressable,
    View,
} from "react-native";

import AppHeader from "../../src/components/AppHeader";
import { AppIcon } from "../../src/components/AppIcon";
import { AppCard, StatusPill } from "../../src/components/AppPrimitives";
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
        if (!user?._id) {
            setRows([]);
            setLoading(false);
            return;
        }
        await repairTeamChallengesForCaptain(user._id);
        const result = await getChallengesForCaptain(user._id);
        if (result.ok && result.data) {
            setRows(result.data);
        } else {
            setRows([]);
        }
        setLoading(false);
        setRefreshing(false);
    }, [user?._id]);

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
                    <AppCard variant="empty" style={styles.emptyCard}>
                        <AppIcon name="sports-esports" size={28} tone="muted" />
                        <Text style={styles.emptyTitle}>No challenges yet</Text>
                        <Text style={styles.emptyText}>Send or accept a team challenge to see it here.</Text>
                    </AppCard>
                ) : (
                    rows.map((item) => {
                        const created = toMillis(item.createdAt);
                        return (
                            <Pressable
                                key={item.id}
                                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                                onPress={() => router.push(`/teams/challenge?id=${item.id}` as any)}
                            >
                                <View style={styles.topRow}>
                                    <Text style={styles.title} numberOfLines={1}>
                                        {item.challengerTeamName} vs {item.opponentTeamName}
                                    </Text>
                                    <StatusPill
                                        tone={item.status === "rejected" ? "danger" : item.status === "completed" ? "success" : item.status === "admin_pending" ? "warning" : "info"}
                                        label={String(item.status || "pending").replace(/_/g, " ")}
                                    />
                                </View>
                                <Text style={styles.meta}>Game: {String(item.gameKey || "").toUpperCase()}</Text>
                                <Text style={styles.meta}>
                                    Common areas: {(item.commonAreas || []).length > 0 ? item.commonAreas.join(", ") : "None"}
                                </Text>
                                <Text style={styles.meta}>
                                    {created ? new Date(created).toLocaleString() : "Just now"}
                                </Text>
                                <View style={styles.linkRow}>
                                    <AppIcon name="arrow-forward" size="sm" tone="accent" />
                                    <Text style={styles.linkText}>Open challenge workspace</Text>
                                </View>
                            </Pressable>
                        );
                    })
                )}
            </ScrollView>
        </Screen>
    );
}
