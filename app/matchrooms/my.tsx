import { useRouter } from "expo-router";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Pressable,
    RefreshControl,
    Text,
    TextInput,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "../../src/components/AppIcon";
import AppHeader from "../../src/components/AppHeader";
import {
    AppDrawer,
    AppModalBody,
    AppModalFooter,
    AppModalHeader,
} from "../../src/components/AppModalPrimitives";
import { AppButton } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";

import { useAuth } from "../../src/context/AuthContext";
import { getUserMatchroomsPage, Matchroom } from "../../src/services/convex/matchService";
import { COLORS } from "../../src/theme";
import Logger from "../../src/utils/logger";
import { getRoomDisplayStatus } from "../../src/utils/matchroomLifecycle";
import { formatEnumLabel } from "../../src/utils/statusLabels";
import styles from "./my.styles";

type Tab = 'hosted' | 'joined';
type MatchroomDateRange = "all" | "today" | "this_week" | "past";
type MatchroomFilters = {
    searchText: string;
    status: string;
    game: string;
    dateRange: MatchroomDateRange;
};

const DRAWER_WIDTH = Math.min(420, Math.round(Dimensions.get("window").width * 0.94));
const DEFAULT_MATCHROOM_FILTERS: MatchroomFilters = {
    searchText: "",
    status: "all",
    game: "all",
    dateRange: "all",
};
const PAGE_SIZE = 20;
const DATE_RANGE_OPTIONS: { key: MatchroomDateRange; label: string }[] = [
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "this_week", label: "This Week" },
    { key: "past", label: "Past" },
];

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

function getStartLabel(item: Matchroom) {
    const value = item.startTime || item.scheduledStartAt;
    if (typeof value === "number") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? "Date not set" : parsed.toLocaleDateString();
    }
    if (typeof value?.seconds === "number") {
        const parsed = new Date(value.seconds * 1000);
        return Number.isNaN(parsed.getTime()) ? "Date not set" : parsed.toLocaleDateString();
    }
    if (item.scheduledDate) return item.scheduledDate;
    return "Date not set";
}

function getStartTimestamp(item: Matchroom) {
    if (typeof item.startTime === "number") return item.startTime;
    const scheduledStartAt = item.scheduledStartAt as any;
    if (typeof scheduledStartAt === "number") return scheduledStartAt;
    if (typeof scheduledStartAt?.seconds === "number") return scheduledStartAt.seconds * 1000;
    return 0;
}

function normalizeSearchValue(value: unknown) {
    return String(value || "").trim().toLowerCase();
}

function isInDateRange(item: Matchroom, dateRange: MatchroomDateRange) {
    if (dateRange === "all") return true;
    const timestamp = getStartTimestamp(item);
    if (!timestamp) return false;

    const now = new Date();
    const start = new Date(timestamp);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;

    if (dateRange === "today") {
        return timestamp >= todayStart && timestamp < tomorrowStart;
    }
    if (dateRange === "this_week") {
        const nextSevenDays = now.getTime() + 7 * 24 * 60 * 60 * 1000;
        return timestamp >= now.getTime() && timestamp <= nextSevenDays;
    }
    return start.getTime() < todayStart;
}

function buildFilterOptions(values: string[]) {
    const unique = Array.from(
        new Set(values.map((value) => String(value || "").trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
    return [{ key: "all", label: "All" }, ...unique.map((value) => ({ key: value, label: formatEnumLabel(value) }))];
}

function MatchroomFilterRow<T extends string>({
    label,
    options,
    selected,
    onSelect,
}: {
    label: string;
    options: { key: T; label: string }[];
    selected: T;
    onSelect: (value: T) => void;
}) {
    return (
        <View style={styles.filterSection}>
            <Text style={styles.filterSectionLabel}>{label}</Text>
            <View style={styles.filterChipWrap}>
                {options.map((option) => (
                    <Pressable
                        key={option.key}
                        onPress={() => onSelect(option.key)}
                        style={[
                            styles.filterChip,
                            selected === option.key && styles.filterChipActive,
                        ]}
                    >
                        <Text
                            style={[
                                styles.filterChipText,
                                selected === option.key && styles.filterChipTextActive,
                            ]}
                        >
                            {option.label}
                        </Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const MatchroomCard = memo(function MatchroomCard({ item, userId, onPress }: MatchroomCardProps) {
    const isHost = item.hostUid === userId;
    const myPlayer = item.players.find(p => p.uid === userId);
    const status = getRoomDisplayStatus(item);
    const startLabel = getStartLabel(item);

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
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('hosted');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
    const [filtersByTab, setFiltersByTab] = useState<Record<Tab, MatchroomFilters>>({
        hosted: DEFAULT_MATCHROOM_FILTERS,
        joined: DEFAULT_MATCHROOM_FILTERS,
    });

    const [hostedRooms, setHostedRooms] = useState<Matchroom[]>([]);
    const [joinedRooms, setJoinedRooms] = useState<Matchroom[]>([]);
    const [cursorByTab, setCursorByTab] = useState<Record<Tab, string | null>>({
        hosted: null,
        joined: null,
    });
    const [doneByTab, setDoneByTab] = useState<Record<Tab, boolean>>({
        hosted: false,
        joined: false,
    });
    const [totalByTab, setTotalByTab] = useState<Record<Tab, number>>({
        hosted: 0,
        joined: 0,
    });

    const mergeUniqueRooms = useCallback((current: Matchroom[], next: Matchroom[]) => {
        const byId = new Map<string, Matchroom>();
        [...current, ...next].forEach((item) => {
            const id = String(item.id || item._id || "");
            if (id) byId.set(id, item);
        });
        return Array.from(byId.values());
    }, []);

    const fetchData = useCallback(async (options?: { tab?: Tab; append?: boolean }) => {
        if (!user) return;
        const tab = options?.tab || activeTab;
        const append = options?.append === true;
        const cursor = append ? cursorByTab[tab] : null;
        if (append && (loadingMore || doneByTab[tab])) return;

        if (append) {
            setLoadingMore(true);
        } else if (!refreshing) {
            setLoading(true);
        }
        try {
            const res = await getUserMatchroomsPage({
                uid: user._id,
                tab,
                limit: PAGE_SIZE,
                cursor,
                filters: filtersByTab[tab],
            });
            if (res.ok && res.data) {
                const setter = tab === "hosted" ? setHostedRooms : setJoinedRooms;
                setter((current) => append ? mergeUniqueRooms(current, res.data!.page) : res.data!.page);
                setCursorByTab((current) => ({ ...current, [tab]: res.data!.continueCursor }));
                setDoneByTab((current) => ({ ...current, [tab]: res.data!.isDone }));
                setTotalByTab((current) => ({ ...current, [tab]: res.data!.total ?? res.data!.page.length }));
            }
        } catch (e) {
            Logger.error("MyMatchrooms", "Error fetching data", e);
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    }, [
        activeTab,
        cursorByTab,
        doneByTab,
        filtersByTab,
        loadingMore,
        mergeUniqueRooms,
        refreshing,
        user,
    ]);

    useEffect(() => {
        setHostedRooms([]);
        setJoinedRooms([]);
        setCursorByTab({ hosted: null, joined: null });
        setDoneByTab({ hosted: false, joined: false });
        setTotalByTab({ hosted: 0, joined: 0 });
    }, [user?._id]);

    useEffect(() => {
        fetchData({ tab: activeTab, append: false });
    }, [user?._id, activeTab, filtersByTab]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchData({ tab: activeTab, append: false });
    }, [activeTab, fetchData]);

    const loadMore = useCallback(() => {
        fetchData({ tab: activeTab, append: true });
    }, [activeTab, fetchData]);

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
    const allRooms = useMemo(
        () => [...hostedRooms, ...joinedRooms],
        [hostedRooms, joinedRooms],
    );
    const statusOptions = useMemo(
        () => buildFilterOptions(allRooms.map((item) => getRoomDisplayStatus(item))),
        [allRooms],
    );
    const gameOptions = useMemo(
        () => buildFilterOptions(allRooms.map((item) => item.game)),
        [allRooms],
    );
    const activeFilters = filtersByTab[activeTab];
    const activeFilterCount =
        Number(activeFilters.searchText.trim().length > 0) +
        Number(activeFilters.status !== DEFAULT_MATCHROOM_FILTERS.status) +
        Number(activeFilters.game !== DEFAULT_MATCHROOM_FILTERS.game) +
        Number(activeFilters.dateRange !== DEFAULT_MATCHROOM_FILTERS.dateRange);
    const updateActiveFilters = useCallback(
        (patch: Partial<MatchroomFilters>) => {
            setFiltersByTab((current) => ({
                ...current,
                [activeTab]: {
                    ...current[activeTab],
                    ...patch,
                },
            }));
        },
        [activeTab],
    );
    const resetActiveFilters = useCallback(() => {
        setFiltersByTab((current) => ({
            ...current,
            [activeTab]: DEFAULT_MATCHROOM_FILTERS,
        }));
    }, [activeTab]);
    const filteredActiveRooms = activeRooms;

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
                        Hosted ({totalByTab.hosted || hostedRooms.length})
                    </Text>
                </Pressable>
                <Pressable
                    style={({ pressed }) => [styles.tab, activeTab === 'joined' && styles.activeTab, pressed && styles.tabPressed]}
                    onPress={() => setActiveTab('joined')}
                >
                    <Text style={[styles.tabText, activeTab === 'joined' && styles.activeTabText]}>
                        Joined ({totalByTab.joined || joinedRooms.length})
                    </Text>
                </Pressable>
            </View>

            <View style={styles.filterBar}>
                <View style={styles.searchBar}>
                    <AppIcon name="search" size={18} color={COLORS.muted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search matchrooms..."
                        placeholderTextColor={COLORS.muted}
                        value={activeFilters.searchText}
                        onChangeText={(searchText) => updateActiveFilters({ searchText })}
                    />
                    {activeFilters.searchText.length > 0 ? (
                        <Pressable onPress={() => updateActiveFilters({ searchText: "" })} hitSlop={8}>
                            <AppIcon name="close" size={18} color={COLORS.muted} />
                        </Pressable>
                    ) : null}
                </View>
                <Pressable
                    onPress={() => setFilterDrawerOpen(true)}
                    style={({ pressed }) => [
                        styles.filterButton,
                        pressed && styles.filterButtonPressed,
                    ]}
                >
                    <AppIcon name="filters" size={20} color={COLORS.text} />
                    {activeFilterCount > 0 ? (
                        <View style={styles.filterBadge}>
                            <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                        </View>
                    ) : null}
                </Pressable>
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            ) : (
                <FlatList
                    data={filteredActiveRooms}
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
                                {activeRooms.length > 0
                                    ? "No matchrooms match these filters."
                                    : activeTab === 'hosted'
                                    ? "You haven't hosted any matchrooms yet."
                                    : "You haven't joined any matchrooms yet."}
                            </Text>
                        </View>
                    }
                    ListFooterComponent={
                        loadingMore ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator color={COLORS.accent} />
                            </View>
                        ) : null
                    }
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.4}
                />
            )}

            <AppDrawer
                visible={filterDrawerOpen}
                onClose={() => setFilterDrawerOpen(false)}
                drawerStyle={[styles.filterDrawer, { width: DRAWER_WIDTH }]}
            >
                <View style={[styles.filterDrawerContent, { paddingTop: Math.max(insets.top, 16) }]}>
                    <AppModalHeader
                        title="Filters"
                        subtitle={`${activeFilterCount} active matchroom filters`}
                        onClose={() => setFilterDrawerOpen(false)}
                        compact
                    />
                    <AppModalBody scroll contentContainerStyle={styles.filterDrawerBody}>
                        <MatchroomFilterRow
                            label="Status"
                            options={statusOptions}
                            selected={activeFilters.status}
                            onSelect={(status) => updateActiveFilters({ status })}
                        />
                        <MatchroomFilterRow
                            label="Game"
                            options={gameOptions}
                            selected={activeFilters.game}
                            onSelect={(game) => updateActiveFilters({ game })}
                        />
                        <MatchroomFilterRow
                            label="Date Range"
                            options={DATE_RANGE_OPTIONS}
                            selected={activeFilters.dateRange}
                            onSelect={(dateRange) => updateActiveFilters({ dateRange })}
                        />
                    </AppModalBody>
                    <AppModalFooter style={styles.filterDrawerFooter}>
                        <View style={styles.filterDrawerFooterRow}>
                            <AppButton
                                variant="ghost"
                                disabled={activeFilterCount === 0}
                                style={styles.filterDrawerFooterButton}
                                onPress={resetActiveFilters}
                            >
                                Reset
                            </AppButton>
                            <AppButton
                                style={styles.filterDrawerFooterButton}
                                onPress={() => setFilterDrawerOpen(false)}
                            >
                                Done
                            </AppButton>
                        </View>
                    </AppModalFooter>
                </View>
            </AppDrawer>
        </Screen>
    );
}
