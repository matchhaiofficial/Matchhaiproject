import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { useAuth } from "../../src/context/AuthContext";
import {
    getChallengesForCaptain,
    repairTeamChallengesForCaptain,
    type TeamMatchChallenge,
} from "../../src/services/teamMatchService";
import { COLORS } from "../../src/theme";
import { parseScheduledDateTime } from "../../src/utils/matchroomTime";
import styles from "./challenges.styles";

const toMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    return 0;
};

type ChallengeTab = "pending" | "history";

const isPendingChallenge = (item: TeamMatchChallenge) => {
    const status = String(item.status || "pending");
    return status === "pending" || status === "venue_proposed";
};

const getEmptyCopy = (tab: ChallengeTab) => {
    if (tab === "pending") {
        return {
            title: "No pending challenges",
            text: "Requested challenges and captain responses waiting for action will show here.",
        };
    }
    return {
        title: "No challenge history",
        text: "Confirmed, completed, rejected, failed, or expired challenges will show here.",
    };
};

export default function TeamChallengesScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rows, setRows] = useState<TeamMatchChallenge[]>([]);
    const [activeTab, setActiveTab] = useState<ChallengeTab>("pending");
    const [now, setNow] = useState(() => Date.now());

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

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(id);
    }, []);

    const pendingRows = useMemo(() => rows.filter(isPendingChallenge), [rows]);
    const historyRows = useMemo(() => rows.filter((item) => !isPendingChallenge(item)), [rows]);
    const visibleRows = activeTab === "pending" ? pendingRows : historyRows;
    const emptyCopy = getEmptyCopy(activeTab);

    const formatCountdown = (ms: number) => {
        const total = Math.max(0, Math.floor(ms / 1000));
        const minutes = Math.floor(total / 60);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours <= 0) return `${mins}m`;
        return `${hours}h ${mins}m`;
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
                <SegmentedTabs<ChallengeTab>
                    value={activeTab}
                    onChange={setActiveTab}
                    items={[
                        { key: "pending", label: "Pending", badge: pendingRows.length || undefined },
                        { key: "history", label: "History", badge: historyRows.length || undefined },
                    ]}
                    compact
                />
                {visibleRows.length === 0 ? (
                    <AppCard variant="empty" style={styles.emptyCard}>
                        <AppIcon name="sports-esports" size={28} tone="muted" />
                        <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
                        <Text style={styles.emptyText}>{emptyCopy.text}</Text>
                    </AppCard>
                ) : (
                    visibleRows.map((item) => {
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
                                    Suggested areas: {(item.commonAreas || []).length > 0 ? item.commonAreas.join(", ") : "None"}
                                </Text>
                                {item.pricePerPlayer ? (
                                    <Text style={styles.meta}>
                                        Price: PKR {item.pricePerPlayer}/player{item.zoneRateLabel ? ` | ${item.zoneRateLabel}` : ""}
                                    </Text>
                                ) : null}
                                {activeTab === "pending" ? (() => {
                                    const scheduledAtMs = toMillis((item as any).scheduledAt) || (() => {
                                        const parsed = parseScheduledDateTime(item.scheduledDate || "", item.scheduledTime || "");
                                        return parsed ? parsed.getTime() : 0;
                                    })();
                                    if (!scheduledAtMs || scheduledAtMs <= now) return null;
                                    return (
                                        <Text style={styles.meta}>
                                            Time left: {formatCountdown(scheduledAtMs - now)}
                                        </Text>
                                    );
                                })() : null}
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
