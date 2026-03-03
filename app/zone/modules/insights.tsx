import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import Screen from "../../../src/components/Screen";
import { useAuth } from "../../../src/context/AuthContext";
import { useZoneData } from "../../../src/hooks/useZoneData";
import {
    subscribeZoneBookingQueue,
    subscribeZoneMatchrooms,
    type ZoneBookingQueueItem,
    type ZoneMatchroomListItem,
} from "../../../src/services/zoneAdminBookingService";
import {
    subscribeBranchResources,
    subscribeZoneBranches,
    type ZoneBranch,
    type ZoneBranchResource,
} from "../../../src/services/zoneAdminResourceService";
import { COLORS } from "../../../src/theme";
import styles from "./insights.styles";

type Segment = "overview" | "resources" | "demand" | "finance";
type FinanceWindow = "7d" | "30d" | "all";
type BranchFinanceMetric = "revenue" | "hours";

const toMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    return 0;
};

const toPercent = (value: number, total: number) => {
    if (!total) return 0;
    return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
};

const GAME_BUCKET_LABEL: Record<string, string> = {
    cs2: "PC",
    fc26: "Console",
    tekken8: "Console",
    futsal: "Court",
    indoor_cricket: "Court",
    padel: "Court",
    pickleball: "Court",
};

const getDayKey = (item: ZoneMatchroomListItem) => {
    if (item.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(item.scheduledDate)) {
        return item.scheduledDate;
    }
    const createdMs = toMillis(item.createdAt);
    if (!createdMs) return null;
    const date = new Date(createdMs);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const toDayLabel = (dayKey: string) =>
    new Date(`${dayKey}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" });

const toStartMs = (item: ZoneMatchroomListItem) => {
    if (item.scheduledDate && item.scheduledTime) {
        const fromSchedule = new Date(`${item.scheduledDate}T${item.scheduledTime}`);
        if (!Number.isNaN(fromSchedule.getTime())) return fromSchedule.getTime();
    }
    return toMillis(item.createdAt);
};

const getRoomDurationHours = (item: ZoneMatchroomListItem) => {
    const minutes = Number(item.durationMinutes || 0);
    if (Number.isFinite(minutes) && minutes > 0) return minutes / 60;
    return 1;
};

const getRoomAmount = (item: ZoneMatchroomListItem) => {
    const direct = Number(item.totalAmount || 0);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const perPlayer = Number(item.pricePerPlayer || 0);
    const playerCount = Number(item.currentPlayers || item.maxPlayers || 0);
    if (Number.isFinite(perPlayer) && Number.isFinite(playerCount) && perPlayer > 0 && playerCount > 0) {
        return perPlayer * playerCount;
    }
    return 0;
};

const formatCurrency = (value: number, currency = "PKR") => {
    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `${currency} ${Math.round(value).toLocaleString()}`;
    }
};

export default function ZoneInsightsModule() {
    const router = useRouter();
    const { zone } = useZoneData();
    const { user } = useAuth();

    const [segment, setSegment] = useState<Segment>("overview");
    const [branches, setBranches] = useState<ZoneBranch[]>([]);
    const [resourcesByBranch, setResourcesByBranch] = useState<Record<string, ZoneBranchResource[]>>({});
    const [queue, setQueue] = useState<ZoneBookingQueueItem[]>([]);
    const [matchrooms, setMatchrooms] = useState<ZoneMatchroomListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now());
    const [financeWindow, setFinanceWindow] = useState<FinanceWindow>("30d");
    const [branchFinanceMetric, setBranchFinanceMetric] = useState<BranchFinanceMetric>("revenue");
    const [focusedBranchKey, setFocusedBranchKey] = useState<string | null>(null);
    const [focusedFinanceDayKey, setFocusedFinanceDayKey] = useState<string | null>(null);

    const branchAreas = useMemo(() => {
        const areas = new Set<string>();
        if (zone?.primaryBranch?.areaLabel) {
            areas.add(String(zone.primaryBranch.areaLabel));
        }
        (zone?.branches || []).forEach((branch: any) => {
            if (branch?.areaLabel) areas.add(String(branch.areaLabel));
        });
        return Array.from(areas);
    }, [zone?.branches, zone?.primaryBranch?.areaLabel]);

    const branchIdsKey = useMemo(
        () => branches.map((branch) => branch.id).sort().join("|"),
        [branches],
    );

    useEffect(() => {
        if (!zone?.id) {
            setLoading(false);
            return;
        }
        const unsub = subscribeZoneBranches(
            zone.id,
            (rows) => {
                setBranches(rows);
                setLoading(false);
                setLastUpdatedAt(Date.now());
            },
            () => {
                setBranches([]);
                setLoading(false);
            },
        );
        return () => unsub();
    }, [zone?.id]);

    useEffect(() => {
        if (!zone?.id || branches.length === 0) {
            setResourcesByBranch({});
            return;
        }
        const unsubs: Array<() => void> = [];
        branches.forEach((branch) => {
            const unsub = subscribeBranchResources(
                zone.id,
                branch.id,
                (rows) => {
                    setResourcesByBranch((prev) => ({ ...prev, [branch.id]: rows }));
                    setLastUpdatedAt(Date.now());
                },
                () => {
                    setResourcesByBranch((prev) => ({ ...prev, [branch.id]: [] }));
                },
            );
            unsubs.push(unsub);
        });
        return () => {
            unsubs.forEach((unsub) => unsub());
        };
    }, [branchIdsKey, branches, zone?.id]);

    useEffect(() => {
        if (!zone?.id) return;
        const unsub = subscribeZoneBookingQueue(
            zone.id,
            branchAreas,
            (rows) => {
                setQueue(rows);
                setLastUpdatedAt(Date.now());
            },
            () => {
                setQueue([]);
            },
        );
        return () => unsub();
    }, [branchAreas, zone?.id]);

    useEffect(() => {
        if (!zone?.id) return;
        const unsub = subscribeZoneMatchrooms(
            zone.id,
            user?._id,
            (rows) => {
                setMatchrooms(rows);
                setLastUpdatedAt(Date.now());
            },
            () => {
                setMatchrooms([]);
            },
            {
                locationHints: [
                    zone.venueBrandName || "",
                    zone.primaryBranch?.branchDisplayName || "",
                    zone.primaryBranch?.areaLabel || "",
                    ...branchAreas,
                ],
            },
        );
        return () => unsub();
    }, [branchAreas, user?._id, zone?.id, zone?.primaryBranch?.areaLabel, zone?.primaryBranch?.branchDisplayName, zone?.venueBrandName]);

    const allResources = useMemo(
        () => Object.values(resourcesByBranch).flat(),
        [resourcesByBranch],
    );

    const statusSummary = useMemo(() => {
        const summary = { available: 0, held: 0, booked: 0, maintenance: 0 };
        allResources.forEach((item) => {
            if (item.lifecycleStatus in summary) {
                (summary as any)[item.lifecycleStatus] += 1;
            }
        });
        return summary;
    }, [allResources]);

    const utilization = useMemo(() => {
        const busy = statusSummary.booked + statusSummary.held;
        return toPercent(busy, allResources.length);
    }, [allResources.length, statusSummary.booked, statusSummary.held]);

    const roomStats = useMemo(() => {
        const map = new Map<string, { key: string; total: number; booked: number; maintenance: number }>();
        allResources.forEach((item) => {
            const key = item.roomLabel || `${item.branchId}-${item.kind}`;
            if (!map.has(key)) {
                map.set(key, { key, total: 0, booked: 0, maintenance: 0 });
            }
            const row = map.get(key)!;
            row.total += 1;
            if (item.lifecycleStatus === "booked") row.booked += 1;
            if (item.lifecycleStatus === "maintenance") row.maintenance += 1;
        });
        return Array.from(map.values()).sort((a, b) => b.total - a.total);
    }, [allResources]);

    const tierStats = useMemo(() => {
        const map = new Map<string, { key: string; total: number; busy: number }>();
        allResources.forEach((item) => {
            const key = item.tier || "standard";
            if (!map.has(key)) {
                map.set(key, { key, total: 0, busy: 0 });
            }
            const row = map.get(key)!;
            row.total += 1;
            if (item.lifecycleStatus === "booked" || item.lifecycleStatus === "held") {
                row.busy += 1;
            }
        });
        return Array.from(map.values()).sort((a, b) => b.total - a.total);
    }, [allResources]);

    const gameStats = useMemo(() => {
        const map = new Map<string, number>();
        matchrooms.forEach((room) => {
            const key = String(room.game || "unknown").toLowerCase();
            map.set(key, (map.get(key) || 0) + 1);
        });
        return Array.from(map.entries())
            .map(([game, count]) => ({ game, count }))
            .sort((a, b) => b.count - a.count);
    }, [matchrooms]);

    const consoleStats = useMemo(() => {
        const summary = { PC: 0, Console: 0, Court: 0, Other: 0 };
        matchrooms.forEach((room) => {
            const key = String(room.game || "").toLowerCase();
            const bucket = GAME_BUCKET_LABEL[key];
            if (bucket === "PC" || bucket === "Console" || bucket === "Court") {
                (summary as any)[bucket] += 1;
            } else {
                summary.Other += 1;
            }
        });
        return summary;
    }, [matchrooms]);

    const dayStats = useMemo(() => {
        const now = new Date();
        const keys = Array.from({ length: 7 }).map((_, index) => {
            const d = new Date(now);
            d.setDate(now.getDate() - (6 - index));
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        });
        const map = new Map<string, number>();
        keys.forEach((key) => map.set(key, 0));
        matchrooms.forEach((room) => {
            const dayKey = getDayKey(room);
            if (!dayKey || !map.has(dayKey)) return;
            map.set(dayKey, (map.get(dayKey) || 0) + 1);
        });
        return keys.map((key) => ({
            key,
            label: toDayLabel(key),
            count: map.get(key) || 0,
        }));
    }, [matchrooms]);

    const activeMatchrooms = useMemo(
        () => matchrooms.filter((item) => ["open", "in-progress"].includes(String(item.status || "").toLowerCase())).length,
        [matchrooms],
    );

    const todayBookings = useMemo(
        () => dayStats[dayStats.length - 1]?.count || 0,
        [dayStats],
    );

    const pendingQueue = useMemo(
        () => queue.filter((item) => item.status === "open" || item.status === "pending_payment").length,
        [queue],
    );

    const branchLabelById = useMemo(() => {
        const map = new Map<string, string>();
        branches.forEach((branch) => {
            map.set(branch.id, branch.branchDisplayName || branch.id);
        });
        return map;
    }, [branches]);

    const financeRows = useMemo(() => {
        if (financeWindow === "all") return matchrooms;
        const now = Date.now();
        const days = financeWindow === "7d" ? 7 : 30;
        const cutoff = now - days * 24 * 60 * 60 * 1000;
        return matchrooms.filter((room) => {
            const startMs = toStartMs(room);
            return startMs > 0 && startMs >= cutoff;
        });
    }, [financeWindow, matchrooms]);

    const financeSummary = useMemo(() => {
        let collected = 0;
        let projected = 0;
        let paidCount = 0;
        let unpaidCount = 0;
        let totalBookedHours = 0;
        const branchMap = new Map<
            string,
            { key: string; label: string; bookings: number; bookedHours: number; projected: number; collected: number }
        >();

        financeRows.forEach((room) => {
            const amount = getRoomAmount(room);
            const hours = getRoomDurationHours(room);
            const isPaid = String(room.paymentStatus || "").toLowerCase() === "paid";
            const branchKey = String(room.branchId || room.location || "unassigned");
            const branchLabel =
                (room.branchId ? branchLabelById.get(room.branchId) : null) ||
                room.location ||
                "Unassigned";

            projected += amount;
            totalBookedHours += hours;
            if (isPaid) {
                collected += amount;
                paidCount += 1;
            } else {
                unpaidCount += 1;
            }

            if (!branchMap.has(branchKey)) {
                branchMap.set(branchKey, {
                    key: branchKey,
                    label: branchLabel,
                    bookings: 0,
                    bookedHours: 0,
                    projected: 0,
                    collected: 0,
                });
            }
            const row = branchMap.get(branchKey)!;
            row.bookings += 1;
            row.bookedHours += hours;
            row.projected += amount;
            if (isPaid) row.collected += amount;
        });

        const byBranch = Array.from(branchMap.values()).sort((a, b) =>
            branchFinanceMetric === "revenue"
                ? b.collected - a.collected
                : b.bookedHours - a.bookedHours,
        );

        return {
            collected,
            projected,
            pendingAmount: Math.max(0, projected - collected),
            paidCount,
            unpaidCount,
            totalBookedHours,
            byBranch,
        };
    }, [branchFinanceMetric, branchLabelById, financeRows]);

    const financeDayStats = useMemo(() => {
        const map = new Map<
            string,
            { key: string; label: string; revenue: number; bookings: number; hours: number; paid: number; unpaid: number }
        >();

        financeRows.forEach((room) => {
            const startMs = toStartMs(room);
            if (!startMs) return;
            const d = new Date(startMs);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    label: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
                    revenue: 0,
                    bookings: 0,
                    hours: 0,
                    paid: 0,
                    unpaid: 0,
                });
            }
            const row = map.get(key)!;
            const amount = getRoomAmount(room);
            const hours = getRoomDurationHours(room);
            const isPaid = String(room.paymentStatus || "").toLowerCase() === "paid";
            row.revenue += amount;
            row.hours += hours;
            row.bookings += 1;
            if (isPaid) {
                row.paid += 1;
            } else {
                row.unpaid += 1;
            }
        });

        const sorted = Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
        if (financeWindow === "all") {
            return sorted.slice(-14);
        }
        return sorted;
    }, [financeRows, financeWindow]);

    const financeDayMax = useMemo(() => {
        if (financeDayStats.length === 0) return 1;
        return Math.max(...financeDayStats.map((item) => item.revenue), 1);
    }, [financeDayStats]);

    const branchMetricMax = useMemo(() => {
        if (!financeSummary.byBranch.length) return 1;
        if (branchFinanceMetric === "revenue") {
            return Math.max(...financeSummary.byBranch.map((item) => item.collected), 1);
        }
        return Math.max(...financeSummary.byBranch.map((item) => item.bookedHours), 1);
    }, [branchFinanceMetric, financeSummary.byBranch]);

    useEffect(() => {
        if (financeSummary.byBranch.length === 0) {
            setFocusedBranchKey(null);
            return;
        }
        if (!focusedBranchKey || !financeSummary.byBranch.some((item) => item.key === focusedBranchKey)) {
            setFocusedBranchKey(financeSummary.byBranch[0].key);
        }
    }, [financeSummary.byBranch, focusedBranchKey]);

    useEffect(() => {
        if (financeDayStats.length === 0) {
            setFocusedFinanceDayKey(null);
            return;
        }
        if (!focusedFinanceDayKey || !financeDayStats.some((item) => item.key === focusedFinanceDayKey)) {
            setFocusedFinanceDayKey(financeDayStats[financeDayStats.length - 1].key);
        }
    }, [financeDayStats, focusedFinanceDayKey]);

    const focusedBranch = useMemo(
        () => financeSummary.byBranch.find((item) => item.key === focusedBranchKey) || null,
        [financeSummary.byBranch, focusedBranchKey],
    );
    const focusedFinanceDay = useMemo(
        () => financeDayStats.find((item) => item.key === focusedFinanceDayKey) || null,
        [financeDayStats, focusedFinanceDayKey],
    );

    if (loading) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader
                title="Insights & Security"
                subtitle="Live analytics across rooms, tiers, demand, and activity"
                onBack={() => router.back()}
                inlineTitle
            />

            <SegmentedTabs
                items={[
                    { key: "overview", label: "Overview" },
                    { key: "resources", label: "Resources" },
                    { key: "demand", label: "Demand" },
                    { key: "finance", label: "Finance" },
                ]}
                value={segment}
                onChange={(value) => setSegment(value as Segment)}
                style={styles.segmentTabs}
                itemTextStyle={styles.segmentTabText}
                compact
            />

            <View style={styles.liveBanner}>
                <MaterialIcons name="sensors" size={16} color={COLORS.successBright} />
                <Text style={styles.liveBannerText}>
                    Live updated {new Date(lastUpdatedAt).toLocaleTimeString()}
                </Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.summaryGrid}>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryValue}>{pendingQueue}</Text>
                        <Text style={styles.summaryLabel}>Pending Queue</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryValue}>{activeMatchrooms}</Text>
                        <Text style={styles.summaryLabel}>Live Matchrooms</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryValue}>{utilization}%</Text>
                        <Text style={styles.summaryLabel}>Resource Utilization</Text>
                    </View>
                    <View style={styles.summaryCard}>
                        <Text style={styles.summaryValue}>{todayBookings}</Text>
                        <Text style={styles.summaryLabel}>Bookings Today</Text>
                    </View>
                </View>

                {segment === "overview" ? (
                    <>
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Operations Pulse</Text>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>Available resources</Text>
                                <Text style={styles.metricValue}>{statusSummary.available}</Text>
                            </View>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>Held resources</Text>
                                <Text style={styles.metricValue}>{statusSummary.held}</Text>
                            </View>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>Booked resources</Text>
                                <Text style={styles.metricValue}>{statusSummary.booked}</Text>
                            </View>
                            <View style={styles.metricRow}>
                                <Text style={styles.metricLabel}>Maintenance resources</Text>
                                <Text style={styles.metricValue}>{statusSummary.maintenance}</Text>
                            </View>
                        </View>
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Demand Trend (7 days)</Text>
                            {dayStats.map((day) => (
                                <View key={day.key} style={styles.barRow}>
                                    <Text style={styles.barLabel}>{day.label}</Text>
                                    <View style={styles.barTrack}>
                                        <View
                                            style={[
                                                styles.barFill,
                                                { width: `${toPercent(day.count, Math.max(...dayStats.map((item) => item.count), 1))}%` },
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.barValue}>{day.count}</Text>
                                </View>
                            ))}
                        </View>
                    </>
                ) : null}

                {segment === "resources" ? (
                    <>
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Room Analysis</Text>
                            {roomStats.length === 0 ? (
                                <Text style={styles.emptyText}>No room-level resources yet.</Text>
                            ) : (
                                roomStats.map((room) => (
                                    <View key={room.key} style={styles.metricBlock}>
                                        <View style={styles.metricRow}>
                                            <Text style={styles.metricLabel}>{room.key}</Text>
                                            <Text style={styles.metricValue}>
                                                {room.booked}/{room.total} booked
                                            </Text>
                                        </View>
                                        <Text style={styles.metricHint}>
                                            Maintenance: {room.maintenance}
                                        </Text>
                                    </View>
                                ))
                            )}
                        </View>
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Tier Analysis</Text>
                            {tierStats.length === 0 ? (
                                <Text style={styles.emptyText}>No tier tagging found yet.</Text>
                            ) : (
                                tierStats.map((tier) => (
                                    <View key={tier.key} style={styles.barRow}>
                                        <Text style={styles.barLabel}>{tier.key}</Text>
                                        <View style={styles.barTrack}>
                                            <View
                                                style={[
                                                    styles.barFill,
                                                    { width: `${toPercent(tier.busy, tier.total)}%` },
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.barValue}>{tier.busy}/{tier.total}</Text>
                                    </View>
                                ))
                            )}
                        </View>
                    </>
                ) : null}

                {segment === "demand" ? (
                    <>
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Per Game</Text>
                            {gameStats.length === 0 ? (
                                <Text style={styles.emptyText}>No game demand yet.</Text>
                            ) : (
                                gameStats.map((row) => (
                                    <View key={row.game} style={styles.metricRow}>
                                        <Text style={styles.metricLabel}>{row.game.toUpperCase()}</Text>
                                        <Text style={styles.metricValue}>{row.count}</Text>
                                    </View>
                                ))
                            )}
                        </View>
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Per Console / Asset Group</Text>
                            {Object.entries(consoleStats).map(([key, count]) => (
                                <View key={key} style={styles.metricRow}>
                                    <Text style={styles.metricLabel}>{key}</Text>
                                    <Text style={styles.metricValue}>{count}</Text>
                                </View>
                            ))}
                        </View>
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Per Day (Last 7 Days)</Text>
                            {dayStats.map((day) => (
                                <View key={day.key} style={styles.metricRow}>
                                    <Text style={styles.metricLabel}>{day.label}</Text>
                                    <Text style={styles.metricValue}>{day.count}</Text>
                                </View>
                            ))}
                        </View>
                    </>
                ) : null}

                {segment === "finance" ? (
                    <>
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Finance Window</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                {([
                                    { key: "7d", label: "Last 7 days" },
                                    { key: "30d", label: "Last 30 days" },
                                    { key: "all", label: "All time" },
                                ] as Array<{ key: FinanceWindow; label: string }>).map((item) => (
                                    <Pressable
                                        key={item.key}
                                        style={[styles.chip, financeWindow === item.key && styles.chipActive]}
                                        onPress={() => setFinanceWindow(item.key)}
                                    >
                                        <Text style={[styles.chipText, financeWindow === item.key && styles.chipTextActive]}>
                                            {item.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                            <View style={styles.financeSummaryGrid}>
                                <View style={styles.financeSummaryCard}>
                                    <Text style={styles.financeSummaryValue}>{formatCurrency(financeSummary.collected)}</Text>
                                    <Text style={styles.financeSummaryLabel}>Collected</Text>
                                </View>
                                <View style={styles.financeSummaryCard}>
                                    <Text style={styles.financeSummaryValue}>{formatCurrency(financeSummary.projected)}</Text>
                                    <Text style={styles.financeSummaryLabel}>Projected</Text>
                                </View>
                                <View style={styles.financeSummaryCard}>
                                    <Text style={styles.financeSummaryValue}>{formatCurrency(financeSummary.pendingAmount)}</Text>
                                    <Text style={styles.financeSummaryLabel}>Pending</Text>
                                </View>
                                <View style={styles.financeSummaryCard}>
                                    <Text style={styles.financeSummaryValue}>{financeSummary.totalBookedHours.toFixed(1)}h</Text>
                                    <Text style={styles.financeSummaryLabel}>Booked Hours</Text>
                                </View>
                            </View>
                            <View style={styles.metricRowTight}>
                                <Text style={styles.metricLabel}>Paid bookings</Text>
                                <Text style={styles.metricValue}>{financeSummary.paidCount}</Text>
                            </View>
                            <View style={styles.metricRowTight}>
                                <Text style={styles.metricLabel}>Unpaid bookings</Text>
                                <Text style={styles.metricValue}>{financeSummary.unpaidCount}</Text>
                            </View>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Per Branch Performance</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                {([
                                    { key: "revenue", label: "Revenue" },
                                    { key: "hours", label: "Booked Hours" },
                                ] as Array<{ key: BranchFinanceMetric; label: string }>).map((item) => (
                                    <Pressable
                                        key={item.key}
                                        style={[styles.chip, branchFinanceMetric === item.key && styles.chipActive]}
                                        onPress={() => setBranchFinanceMetric(item.key)}
                                    >
                                        <Text style={[styles.chipText, branchFinanceMetric === item.key && styles.chipTextActive]}>
                                            {item.label}
                                        </Text>
                                    </Pressable>
                                ))}
                            </ScrollView>
                            <Text style={styles.metricHint}>Tap a branch row to inspect details</Text>
                            {financeSummary.byBranch.length === 0 ? (
                                <Text style={styles.emptyText}>No branch-level booking data yet.</Text>
                            ) : (
                                financeSummary.byBranch.map((branch) => {
                                    const metricValue =
                                        branchFinanceMetric === "revenue" ? branch.collected : branch.bookedHours;
                                    return (
                                        <Pressable
                                            key={branch.key}
                                            style={[styles.chartRow, focusedBranchKey === branch.key && styles.chartRowActive]}
                                            onPress={() => setFocusedBranchKey(branch.key)}
                                        >
                                            <Text style={styles.branchBarLabel} numberOfLines={1}>
                                                {branch.label}
                                            </Text>
                                            <View style={styles.barTrack}>
                                                <View
                                                    style={[
                                                        styles.barFill,
                                                        { width: `${toPercent(metricValue, branchMetricMax)}%` },
                                                    ]}
                                                />
                                            </View>
                                            <Text style={styles.barValueWide}>
                                                {branchFinanceMetric === "revenue"
                                                    ? formatCurrency(branch.collected)
                                                    : `${branch.bookedHours.toFixed(1)}h`}
                                            </Text>
                                        </Pressable>
                                    );
                                })
                            )}
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Revenue Timeline</Text>
                            {financeDayStats.length === 0 ? (
                                <Text style={styles.emptyText}>No finance activity in this window yet.</Text>
                            ) : (
                                financeDayStats.map((day) => (
                                    <Pressable
                                        key={day.key}
                                        style={[styles.chartRow, focusedFinanceDayKey === day.key && styles.chartRowActive]}
                                        onPress={() => setFocusedFinanceDayKey(day.key)}
                                    >
                                        <Text style={styles.barLabelWide}>{day.label}</Text>
                                        <View style={styles.barTrack}>
                                            <View
                                                style={[
                                                    styles.barFill,
                                                    { width: `${toPercent(day.revenue, financeDayMax)}%` },
                                                ]}
                                            />
                                        </View>
                                        <Text style={styles.barValueWide}>{formatCurrency(day.revenue)}</Text>
                                    </Pressable>
                                ))
                            )}
                        </View>

                        {focusedFinanceDay ? (
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Day Detail: {focusedFinanceDay.label}</Text>
                                <View style={styles.metricRow}>
                                    <Text style={styles.metricLabel}>Revenue</Text>
                                    <Text style={styles.metricValue}>{formatCurrency(focusedFinanceDay.revenue)}</Text>
                                </View>
                                <View style={styles.metricRow}>
                                    <Text style={styles.metricLabel}>Bookings</Text>
                                    <Text style={styles.metricValue}>{focusedFinanceDay.bookings}</Text>
                                </View>
                                <View style={styles.metricRow}>
                                    <Text style={styles.metricLabel}>Booked hours</Text>
                                    <Text style={styles.metricValue}>{focusedFinanceDay.hours.toFixed(1)}h</Text>
                                </View>
                                <View style={styles.metricRow}>
                                    <Text style={styles.metricLabel}>Paid / unpaid</Text>
                                    <Text style={styles.metricValue}>
                                        {focusedFinanceDay.paid} / {focusedFinanceDay.unpaid}
                                    </Text>
                                </View>
                            </View>
                        ) : null}

                        {focusedBranch ? (
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Branch Detail: {focusedBranch.label}</Text>
                                <View style={styles.metricRow}>
                                    <Text style={styles.metricLabel}>Bookings</Text>
                                    <Text style={styles.metricValue}>{focusedBranch.bookings}</Text>
                                </View>
                                <View style={styles.metricRow}>
                                    <Text style={styles.metricLabel}>Booked hours</Text>
                                    <Text style={styles.metricValue}>{focusedBranch.bookedHours.toFixed(1)}h</Text>
                                </View>
                                <View style={styles.metricRow}>
                                    <Text style={styles.metricLabel}>Collected</Text>
                                    <Text style={styles.metricValue}>{formatCurrency(focusedBranch.collected)}</Text>
                                </View>
                                <View style={styles.metricRow}>
                                    <Text style={styles.metricLabel}>Projected</Text>
                                    <Text style={styles.metricValue}>{formatCurrency(focusedBranch.projected)}</Text>
                                </View>
                            </View>
                        ) : null}
                    </>
                ) : null}
            </ScrollView>
        </Screen>
    );
}
