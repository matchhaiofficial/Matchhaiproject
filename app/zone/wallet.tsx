import { usePaginatedQuery, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { api } from "../../convex/_generated/api";
import AppHeader from "../../src/components/AppHeader";
import { AppIcon } from "../../src/components/AppIcon";
import {
    AppButton,
    AppCard,
    StatusPill,
} from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import SegmentedTabs from "../../src/components/SegmentedTabs";
import { useTabBarClearance } from "../../src/hooks/useTabBarClearance";
import { useRouteLogger } from "../../src/hooks/useRouteLogger";
import { useZoneData } from "../../src/hooks/useZoneData";
import {
    COLORS,
    CONTROL_SIZES,
    FONTS,
    SPACING,
    TEXT_SIZES,
} from "../../src/theme";

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (value: number) =>
    `Rs ${Math.round(value).toLocaleString("en-PK")}`;

const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("en-PK", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });

const getTxLabel = (item: any): string => {
    if (item.type === "deposit" && item.source === "matchroom_completion_payout")
        return "Matchroom Payout";
    if (item.type === "withdrawal") return "Withdrawal";
    if (item.type === "refund") return "Refund";
    if (item.type === "deposit") return "Deposit";
    return "Transaction";
};

const getTxTone = (item: any): "success" | "warning" | "error" | "neutral" => {
    if (item.type === "deposit" && item.source === "matchroom_completion_payout")
        return "success";
    if (item.status === "pending") return "warning";
    if (item.status === "failed") return "error";
    return "neutral";
};

const getTxSign = (item: any) => (item.type === "withdrawal" ? "-" : "+");

// ─── stat row item (inside bordered panel) ───────────────────────────────────

type StatItemProps = {
    label: string;
    value: string;
    iconName: string;
    iconColor: string;
    isLeft: boolean;
    isTop: boolean;
};

const StatItem = ({
    label,
    value,
    iconName,
    iconColor,
    isLeft,
    isTop,
}: StatItemProps) => (
    <View
        style={[
            styles.statItem,
            isLeft && styles.statItemLeft,
            isTop && styles.statItemTop,
        ]}
    >
        <View
            style={[
                styles.statIconWrap,
                {
                    backgroundColor: `${iconColor}22`,
                    borderColor: `${iconColor}55`,
                },
            ]}
        >
            <AppIcon name={iconName as any} size={18} color={iconColor} />
        </View>
        <View style={styles.statTextWrap}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value}</Text>
        </View>
    </View>
);

// ─── transaction row ─────────────────────────────────────────────────────────

const ZoneTxRow = React.memo(({ item }: { item: any }) => {
    const label = getTxLabel(item);
    const tone = getTxTone(item);
    const sign = getTxSign(item);
    const amountColor =
        sign === "+" ? COLORS.successBright : COLORS.error;

    return (
        <AppCard style={styles.txCard}>
            <View style={styles.txRow}>
                <View style={styles.txLeft}>
                    <Text style={styles.txLabel} numberOfLines={1}>
                        {label}
                    </Text>
                    <Text style={styles.txDate}>{formatDate(item.createdAt)}</Text>
                    {item.matchroomId ? (
                        <Text style={styles.txRef} numberOfLines={1}>
                            Room: {String(item.matchroomId).slice(-8)}
                        </Text>
                    ) : item.reference ? (
                        <Text style={styles.txRef} numberOfLines={1}>
                            Ref: {String(item.reference).slice(-12)}
                        </Text>
                    ) : null}
                </View>
                <View style={styles.txRight}>
                    <Text style={[styles.txAmount, { color: amountColor }]}>
                        {sign}
                        {fmt(item.amount)}
                    </Text>
                    <StatusPill
                        tone={tone}
                        label={
                            String(item.status).charAt(0).toUpperCase() +
                            String(item.status).slice(1)
                        }
                    />
                </View>
            </View>
        </AppCard>
    );
});

// ─── branch chip ─────────────────────────────────────────────────────────────

const BranchChip = ({
    label,
    active,
    onPress,
}: {
    label: string;
    active: boolean;
    onPress: () => void;
}) => (
    <Pressable
        onPress={onPress}
        style={[styles.chip, active && styles.chipActive]}
    >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
            {label}
        </Text>
    </Pressable>
);

// ─── main screen ─────────────────────────────────────────────────────────────

export default function ZoneWalletScreen() {
    const router = useRouter();
    const bottomPad = useTabBarClearance(24);
    useRouteLogger("ZoneWalletScreen");

    const [activeTab, setActiveTab] = useState<"overview" | "transactions">(
        "overview",
    );
    const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

    const { zone } = useZoneData();

    const branches: any[] = useMemo(() => {
        const raw: any[] = Array.isArray(zone?.branches) ? zone.branches : [];
        return raw.filter(
            (b: any) => b && (b.branchDisplayName || b.name || b.areaLabel),
        );
    }, [zone?.branches]);

    const showBranchChips = branches.length > 0;

    const summary = useQuery(api.zoneWallet.getSummary, {
        branchId: selectedBranchId ?? undefined,
    });

    const { results: txns, status: txStatus, loadMore } = usePaginatedQuery(
        api.zoneWallet.listTransactionsPage,
        { branchId: selectedBranchId ?? undefined },
        { initialNumItems: 20 },
    );

    const isLoading = summary === undefined;

    const overviewStats = useMemo(() => {
        if (!summary) return [];
        return [
            {
                label: "Today",
                value: fmt(summary.todayEarned),
                iconName: "status",
                iconColor: COLORS.accent,
            },
            {
                label: "This Week",
                value: fmt(summary.weekEarned),
                iconName: "matchroom",
                iconColor: COLORS.successBright,
            },
            {
                label: "This Month",
                value: fmt(summary.monthEarned),
                iconName: "business",
                iconColor: COLORS.warning,
            },
            {
                label: "Total Earned",
                value: fmt(summary.totalEarned),
                iconName: "trending-up",
                iconColor: COLORS.successBright,
            },
            {
                label: "Withdrawn",
                value: fmt(summary.totalWithdrawn),
                iconName: "wallet",
                iconColor: COLORS.textSecondary,
            },
            {
                label: "Pending",
                value: fmt(summary.pendingBalance),
                iconName: "pending",
                iconColor: COLORS.warning,
            },
        ];
    }, [summary]);

    const handleWithdraw = () => {
        router.push({
            pathname: "/zone/(tabs)/profile",
            params: { withdraw: "1" },
        } as any);
    };

    const branchLimitationVisible =
        showBranchChips && selectedBranchId !== null;

    if (isLoading) {
        return (
            <Screen style={styles.screen} edges={["top"]}>
                <AppHeader
                    title="Wallet"
                    onBack={() => router.back()}
                    inlineTitle
                />
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            </Screen>
        );
    }

    if (!summary) {
        return (
            <Screen style={styles.screen} edges={["top"]}>
                <AppHeader
                    title="Wallet"
                    onBack={() => router.back()}
                    inlineTitle
                />
                <View style={styles.centered}>
                    <AppIcon name="wallet" size={40} color={COLORS.textSecondary} />
                    <Text style={styles.emptyTitle}>Zone wallet not available</Text>
                    <Text style={styles.emptySubtext}>
                        Ensure your account is linked to a zone.
                    </Text>
                </View>
            </Screen>
        );
    }

    return (
        <Screen style={styles.screen} scroll={false} edges={["top"]}>
            <AppHeader
                title="Wallet"
                onBack={() => router.back()}
                inlineTitle
            />

            {/* Tabs — Screen handles horizontal padding, no extra marginHorizontal */}
            <SegmentedTabs
                items={[
                    { key: "overview", label: "Overview" },
                    { key: "transactions", label: "Transactions" },
                ]}
                value={activeTab}
                onChange={(key) => setActiveTab(key as any)}
                style={styles.tabs}
            />

            {activeTab === "overview" ? (
                <ScrollView
                    contentContainerStyle={[
                        styles.overviewContent,
                        { paddingBottom: bottomPad },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Available balance card */}
                    <View style={styles.balanceCard}>
                        <View style={styles.balanceIconRow}>
                            <AppIcon
                                name="wallet"
                                size={18}
                                color={COLORS.accent}
                            />
                            <Text style={styles.balanceEyebrow}>
                                Available Balance
                            </Text>
                        </View>
                        <Text style={styles.balanceAmount}>
                            {fmt(summary.availableBalance)}
                        </Text>
                        {summary.pendingWithdrawals > 0 ? (
                            <Text style={styles.pendingNote}>
                                {summary.pendingWithdrawals} withdrawal
                                {summary.pendingWithdrawals > 1 ? "s" : ""}{" "}
                                pending ({fmt(summary.pendingBalance)})
                            </Text>
                        ) : null}
                    </View>

                    {/* Branch chips */}
                    {showBranchChips ? (
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.chipsRow}
                        >
                            <BranchChip
                                label="All"
                                active={selectedBranchId === null}
                                onPress={() => setSelectedBranchId(null)}
                            />
                            {branches.map((b: any, idx: number) => {
                                const bId = String(
                                    b.branchId ?? b.id ?? b.branchDisplayName ?? idx,
                                );
                                const bLabel =
                                    b.branchDisplayName ||
                                    b.name ||
                                    b.areaLabel ||
                                    `Branch ${idx + 1}`;
                                return (
                                    <BranchChip
                                        key={bId}
                                        label={bLabel}
                                        active={selectedBranchId === bId}
                                        onPress={() =>
                                            setSelectedBranchId(
                                                selectedBranchId === bId
                                                    ? null
                                                    : bId,
                                            )
                                        }
                                    />
                                );
                            })}
                        </ScrollView>
                    ) : null}

                    {/* Branch limitation notice */}
                    {branchLimitationVisible ? (
                        <View style={styles.limitationBanner}>
                            <AppIcon
                                name="pending"
                                size={14}
                                color={COLORS.warning}
                            />
                            <Text style={styles.limitationText}>
                                Branch-level earnings breakdown coming soon.
                                Totals shown are for all branches combined.
                            </Text>
                        </View>
                    ) : null}

                    {/* Earnings breakdown — dashboard-style bordered grid */}
                    <Text style={styles.sectionLabel}>Earnings Breakdown</Text>
                    <View style={styles.statsPanel}>
                        {overviewStats.map((stat, idx) => (
                            <StatItem
                                key={stat.label}
                                label={stat.label}
                                value={stat.value}
                                iconName={stat.iconName}
                                iconColor={stat.iconColor}
                                isLeft={idx % 2 === 0}
                                isTop={idx < 2}
                            />
                        ))}
                    </View>

                    {/* Withdraw CTA */}
                    <AppButton style={styles.withdrawBtn} onPress={handleWithdraw}>
                        Request Withdrawal
                    </AppButton>

                    <Text style={styles.footerNote}>
                        Matchroom earnings settle to your wallet after
                        completion. Withdrawals are reviewed by MatchHai admin.
                    </Text>
                </ScrollView>
            ) : (
                <FlatList
                    data={txns}
                    keyExtractor={(item) => String(item._id)}
                    renderItem={({ item }) => <ZoneTxRow item={item} />}
                    contentContainerStyle={[
                        styles.txContent,
                        { paddingBottom: bottomPad },
                    ]}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        showBranchChips ? (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.chipsRow}
                            >
                                <BranchChip
                                    label="All"
                                    active={selectedBranchId === null}
                                    onPress={() => setSelectedBranchId(null)}
                                />
                                {branches.map((b: any, idx: number) => {
                                    const bId = String(
                                        b.branchId ?? b.id ?? b.branchDisplayName ?? idx,
                                    );
                                    const bLabel =
                                        b.branchDisplayName ||
                                        b.name ||
                                        b.areaLabel ||
                                        `Branch ${idx + 1}`;
                                    return (
                                        <BranchChip
                                            key={bId}
                                            label={bLabel}
                                            active={selectedBranchId === bId}
                                            onPress={() =>
                                                setSelectedBranchId(
                                                    selectedBranchId === bId
                                                        ? null
                                                        : bId,
                                                )
                                            }
                                        />
                                    );
                                })}
                            </ScrollView>
                        ) : null
                    }
                    ListEmptyComponent={
                        txStatus === "LoadingFirstPage" ? (
                            <View style={styles.centeredSmall}>
                                <ActivityIndicator
                                    size="small"
                                    color={COLORS.accent}
                                />
                            </View>
                        ) : (
                            <View style={styles.centeredSmall}>
                                <AppIcon
                                    name="wallet"
                                    size={32}
                                    color={COLORS.textSecondary}
                                />
                                <Text style={styles.emptyTitle}>
                                    No transactions yet
                                </Text>
                                <Text style={styles.emptySubtext}>
                                    Matchroom payouts will appear here after
                                    completion.
                                </Text>
                            </View>
                        )
                    }
                    ListFooterComponent={
                        txStatus === "CanLoadMore" ? (
                            <Pressable
                                style={styles.loadMoreBtn}
                                onPress={() => loadMore(20)}
                            >
                                <Text style={styles.loadMoreText}>
                                    Load more
                                </Text>
                            </Pressable>
                        ) : txStatus === "LoadingMore" ? (
                            <ActivityIndicator
                                size="small"
                                color={COLORS.accent}
                                style={styles.loadMoreBtn}
                            />
                        ) : null
                    }
                />
            )}
        </Screen>
    );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },

    // tabs — Screen's paddingHorizontal handles alignment, no extra marginHorizontal
    tabs: {
        marginTop: SPACING.sm,
        marginBottom: 0,
    },

    // overview scroll — no horizontal padding (Screen provides it)
    overviewContent: {
        paddingTop: SPACING.md,
        gap: SPACING.md,
    },

    // transactions list — no horizontal padding (Screen provides it)
    txContent: {
        paddingTop: SPACING.sm,
        gap: SPACING.sm,
    },

    // ── available balance card ──
    balanceCard: {
        borderWidth: 1,
        borderColor: `${COLORS.accent}40`,
        borderRadius: CONTROL_SIZES.cardRadius,
        backgroundColor: `${COLORS.accent}0C`,
        paddingVertical: SPACING.xl,
        paddingHorizontal: SPACING.lg,
        alignItems: "center",
        gap: SPACING.xs,
    },
    balanceIconRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.xs,
    },
    balanceEyebrow: {
        fontFamily: FONTS.interMedium,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 0.8,
    },
    balanceAmount: {
        fontFamily: FONTS.heading,
        fontSize: 36,
        color: COLORS.text,
        letterSpacing: -0.5,
        marginTop: SPACING.xs,
    },
    pendingNote: {
        fontFamily: FONTS.interRegular,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.warning,
        textAlign: "center",
    },

    // ── branch chips ──
    chipsRow: {
        flexDirection: "row",
        gap: SPACING.sm,
        paddingVertical: SPACING.xs,
    },
    chip: {
        paddingHorizontal: SPACING.md,
        paddingVertical: 6,
        borderRadius: CONTROL_SIZES.chipMd,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        backgroundColor: COLORS.cardDark,
    },
    chipActive: {
        borderColor: `${COLORS.accent}80`,
        backgroundColor: `${COLORS.accent}18`,
    },
    chipText: {
        fontFamily: FONTS.interMedium,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.textSecondary,
    },
    chipTextActive: {
        color: COLORS.accent,
    },

    // ── branch limitation banner ──
    limitationBanner: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: SPACING.sm,
        borderWidth: 1,
        borderColor: `${COLORS.warning}40`,
        backgroundColor: `${COLORS.warning}10`,
        borderRadius: CONTROL_SIZES.cardRadius - 4,
        padding: SPACING.md,
    },
    limitationText: {
        flex: 1,
        fontFamily: FONTS.interRegular,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.warning,
        lineHeight: 18,
    },

    // ── section label ──
    sectionLabel: {
        fontFamily: FONTS.interSemiBold ?? FONTS.interMedium,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.textSecondary,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginBottom: -SPACING.xs,
    },

    // ── earnings stats panel (dashboard-style bordered grid) ──
    statsPanel: {
        width: "100%",
        flexDirection: "row",
        flexWrap: "wrap",
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderRadius: CONTROL_SIZES.cardRadius,
        backgroundColor: COLORS.cardDark,
        overflow: "hidden",
    },
    statItem: {
        width: "50%",
        minHeight: 72,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.sm,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
    },
    statItemLeft: {
        borderRightWidth: StyleSheet.hairlineWidth,
        borderRightColor: COLORS.cardBorder,
    },
    statItemTop: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.cardBorder,
    },
    statIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
    },
    statTextWrap: {
        flex: 1,
        minWidth: 0,
    },
    statLabel: {
        fontFamily: FONTS.interMedium,
        fontSize: 11,
        color: COLORS.textSecondary,
        lineHeight: 14,
    },
    statValue: {
        fontFamily: FONTS.heading,
        fontSize: 17,
        color: COLORS.text,
        lineHeight: 22,
        marginTop: 1,
    },

    // ── withdraw CTA ──
    withdrawBtn: {
        marginTop: SPACING.xs,
    },

    // ── footer note ──
    footerNote: {
        fontFamily: FONTS.interRegular,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.textSecondary,
        textAlign: "center",
        opacity: 0.65,
        lineHeight: 18,
        paddingHorizontal: SPACING.sm,
    },

    // ── transaction rows ──
    txCard: {
        padding: SPACING.md,
    },
    txRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: SPACING.sm,
    },
    txLeft: {
        flex: 1,
        gap: 3,
    },
    txRight: {
        alignItems: "flex-end",
        gap: SPACING.xs,
    },
    txLabel: {
        fontFamily: FONTS.interSemiBold ?? FONTS.interMedium,
        fontSize: TEXT_SIZES.label,
        color: COLORS.text,
    },
    txDate: {
        fontFamily: FONTS.interRegular,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.textSecondary,
    },
    txRef: {
        fontFamily: FONTS.interRegular,
        fontSize: 11,
        color: COLORS.textSecondary,
        opacity: 0.65,
    },
    txAmount: {
        fontFamily: FONTS.heading,
        fontSize: 15,
    },

    // ── load more ──
    loadMoreBtn: {
        paddingVertical: SPACING.lg,
        alignItems: "center",
    },
    loadMoreText: {
        fontFamily: FONTS.interSemiBold ?? FONTS.interMedium,
        fontSize: TEXT_SIZES.label,
        color: COLORS.accent,
    },

    // ── empty / loading states ──
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: SPACING.sm,
        padding: SPACING.xxl,
    },
    centeredSmall: {
        paddingVertical: SPACING.xxl * 2,
        alignItems: "center",
        gap: SPACING.sm,
    },
    emptyTitle: {
        fontFamily: FONTS.interMedium,
        fontSize: TEXT_SIZES.body,
        color: COLORS.textSecondary,
        textAlign: "center",
    },
    emptySubtext: {
        fontFamily: FONTS.interRegular,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.textSecondary,
        textAlign: "center",
        opacity: 0.65,
    },
});
