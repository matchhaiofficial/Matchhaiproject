import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import MatchroomCard from "../matchrooms/components/MatchroomCard";
import AppHeader from "../../src/components/AppHeader";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { useAuth } from "../../src/context/AuthContext";
import { Matchroom, getUserMatchrooms } from "../../src/services/matchService";
import { COLORS } from "../../src/theme";
import { getRoomStartDate } from "../../src/utils/timeFilters";
import Logger from "../../src/utils/logger";
import styles from "./schedule.styles";

type ScheduleTab = "upcoming" | "previous";

const dedupeRooms = (rooms: Matchroom[]) => {
    const byId = new Map<string, Matchroom>();
    rooms.forEach((room) => {
        if (room.id) byId.set(room.id, room);
    });
    return Array.from(byId.values());
};

export default function ScheduleScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<ScheduleTab>("upcoming");
    const [loading, setLoading] = useState(true);
    const [rooms, setRooms] = useState<Matchroom[]>([]);

    const fetchSchedule = useCallback(async () => {
        if (!user?.uid) {
            setRooms([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const result = await getUserMatchrooms(user.uid);
            if (result.ok) {
                setRooms(dedupeRooms([...result.data.hosted, ...result.data.joined]));
            } else {
                setRooms([]);
            }
        } catch (error) {
            Logger.error("Schedule", "Failed to fetch user schedule", error);
            setRooms([]);
        } finally {
            setLoading(false);
        }
    }, [user?.uid]);

    useFocusEffect(useCallback(() => {
        fetchSchedule();
    }, [fetchSchedule]));

    const categorized = useMemo(() => {
        const now = Date.now();
        const upcoming: Matchroom[] = [];
        const previous: Matchroom[] = [];

        rooms.forEach((room) => {
            const start = getRoomStartDate(room);
            if (room.status === "completed") {
                previous.push(room);
                return;
            }
            if (!start) {
                if (room.status === "in-progress") {
                    upcoming.push(room);
                }
                return;
            }
            if (start.getTime() >= now - 15 * 60 * 1000) {
                upcoming.push(room);
            } else {
                previous.push(room);
            }
        });

        upcoming.sort((a, b) => (getRoomStartDate(a)?.getTime() || 0) - (getRoomStartDate(b)?.getTime() || 0));
        previous.sort((a, b) => (getRoomStartDate(b)?.getTime() || 0) - (getRoomStartDate(a)?.getTime() || 0));

        return { upcoming, previous };
    }, [rooms]);

    const visibleRooms = activeTab === "upcoming" ? categorized.upcoming : categorized.previous;

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader title="Schedule" onBack={() => router.back()} inlineTitle />

            <SegmentedTabs
                items={[
                    { key: "upcoming", label: `Upcoming (${categorized.upcoming.length})` },
                    { key: "previous", label: `Previous (${categorized.previous.length})` },
                ]}
                value={activeTab}
                onChange={(value) => setActiveTab(value as ScheduleTab)}
                style={styles.tabs}
            />

            {loading ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                    <ActivityIndicator color={COLORS.accent} />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {visibleRooms.length > 0 ? visibleRooms.map((room) => (
                        <MatchroomCard key={room.id} room={room} />
                    )) : (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyTitle}>No {activeTab} matches</Text>
                            <Text style={styles.emptyText}>
                                {activeTab === "upcoming"
                                    ? "Your upcoming matches will appear here once you join or create one."
                                    : "Your completed or past matches will appear here."}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            )}
        </Screen>
    );
}
