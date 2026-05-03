import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import React, { useMemo } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppHeader from "../../../src/components/AppHeader";
import { AppIcon } from "../../../src/components/AppIcon";
import Screen from "../../../src/components/Screen";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { COLORS } from "../../../src/theme";
import { getZoneMigrationLabel, isZoneMigrationReady } from "../../../src/utils/zoneLifecycle";
import styles from "./branches.styles";

const HIDE_ZONE_TAB_BAR = process.env.EXPO_PUBLIC_HIDE_TAB_BAR === "1";
const CUSTOM_TAB_BAR_MIN_HEIGHT = 72;

export default function ZoneBranches() {
    const { zone, loading } = useZoneData();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const tabBarHeight = useBottomTabBarHeight();
    const bottomClearance = HIDE_ZONE_TAB_BAR
        ? insets.bottom + 16
        : Math.max(tabBarHeight, insets.bottom + CUSTOM_TAB_BAR_MIN_HEIGHT) + 16;

    // Branches are stored as an array on the zone document in Convex.
    // The zone data from useZoneData already includes branches.
    // For the legacy/migrated model, we just use zone.branches directly.
    const branches = useMemo(() => {
        if (!zone?.branches || !Array.isArray(zone.branches)) return [];
        return zone.branches.map((branch: any, index: number) => ({
            id: branch?.id || `branch_${index + 1}`,
            ...branch,
        }));
    }, [zone?.branches]);

    // Legacy detection: zones without migration flag use the old branch model
    const usingLegacyFallback = useMemo(() => {
        if (!zone) return false;
        return !isZoneMigrationReady(zone) && branches.length > 0;
    }, [zone, branches.length]);

    if (loading) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    if (!zone) {
        return (
            <Screen style={styles.screen} scroll={false} edges={['top']} contentStyle={{ paddingBottom: 0 }}>
                <AppHeader title="Branches" inlineTitle />
                <View style={styles.emptyWrap}>
                    <Text style={styles.emptyTitle}>No zone found.</Text>
                </View>
            </Screen>
        );
    }

    return (
        <Screen style={styles.screen} scroll={false} edges={['top']} contentStyle={{ paddingBottom: 0 }}>
            <AppHeader title="Branches" subtitle={`${branches.length} locations`} inlineTitle />
            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: bottomClearance }]}
                showsVerticalScrollIndicator={false}
            >
                {usingLegacyFallback && (
                    <View style={styles.noticeBox}>
                        <Text style={styles.noticeTitle}>
                            Legacy branch model detected
                        </Text>
                        <Text style={styles.noticeText}>
                            This venue is still using the legacy branch model. Current migration state: {getZoneMigrationLabel(zone)}. Use Migration Tools if you need to inspect or retry migration.
                        </Text>
                    </View>
                )}

                <View style={styles.topRow}>
                    <Pressable
                        style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
                        onPress={() => {
                            router.push("/zone/branch/new");
                        }}
                    >
                        <AppIcon name="add" size={18} color="#fff" />
                        <Text style={styles.addButtonText}>Add New Branch</Text>
                    </Pressable>
                </View>

                {branches.length === 0 ? (
                    <View style={styles.emptyWrap}>
                        <Text style={styles.emptyText}>No branches found.</Text>
                    </View>
                ) : (
                    branches.map((branch: any) => (
                        <Pressable
                            key={branch.id}
                            style={({ pressed }) => [styles.branchCard, pressed && styles.branchCardPressed]}
                            onPress={() => {
                                router.push(`/zone/branch/${branch.id}`);
                            }}
                        >
                            <View style={styles.branchCardRow}>
                                <View style={styles.branchInfo}>
                                    <View style={styles.branchTitleRow}>
                                        <Text style={styles.branchTitle} numberOfLines={1}>
                                            {branch.branchDisplayName || branch.name || "Main Branch"}
                                        </Text>
                                        {branch.isPrimary && (
                                            <View style={styles.primaryPill}>
                                                <Text style={styles.primaryPillText}>
                                                    Primary
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.branchLocation} numberOfLines={1}>
                                        {branch.areaLabel}, {branch.city}
                                    </Text>
                                    <Text style={styles.branchAddress} numberOfLines={2}>
                                        {branch.addressLine1 || branch.address}
                                    </Text>
                                </View>
                                <View style={styles.branchChevron}>
                                    <AppIcon name="chevron-right" size="lg" tone="muted" />
                                </View>
                            </View>
                        </Pressable>
                    ))
                )}
            </ScrollView>
        </Screen>
    );
}
