import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { AppIcon } from "../../../src/components/AppIcon";
import {
    AppDialog,
    AppModalBody,
    AppModalFooter,
    AppModalHeader,
} from "../../../src/components/AppModalPrimitives";
import { AppButton } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import { useAuth } from "../../../src/context/AuthContext";
import { logFlowEvent, useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useToast } from "../../../src/hooks/useToast";
import { useZoneData } from "../../../src/hooks/useZoneData";
import {
    getZoneBranchesFromSubcollection,
    migrateZoneBranchesToSubcollection,
} from "../../../src/services/zoneBranchMigrationService";
import { COLORS, SPACING } from "../../../src/theme";
import {
    getZoneLifecycleLabel,
    getZoneMigrationLabel,
    getZoneMigrationStatus,
    isZoneMigrationReady,
} from "../../../src/utils/zoneLifecycle";
import styles from "./settings.styles";

export default function ZoneMigrationToolsModule() {
    const router = useRouter();
    const { user } = useAuth();
    const { zone } = useZoneData();
    const { showToast } = useToast();

    useRouteLogger("ZoneMigrationToolsModule", {
        zoneId: zone?.id,
        userId: user?._id,
    });

    const [branchCount, setBranchCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [migrating, setMigrating] = useState(false);
    const [showMigrationDialog, setShowMigrationDialog] = useState(false);

    const refresh = useCallback(async () => {
        if (!zone?.id) {
            setBranchCount(0);
            return;
        }
        setLoading(true);
        try {
            const branches = await getZoneBranchesFromSubcollection(zone.id);
            setBranchCount(branches.length);
        } catch {
            setBranchCount(0);
        } finally {
            setLoading(false);
        }
    }, [zone?.id]);

    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh]),
    );

    const legacyCount = Array.isArray(zone?.branches) ? zone.branches.length : 0;
    const migrationEnabled = Boolean(zone?.id && user?._id);
    const migrationStatus = getZoneMigrationStatus(zone);
    const migrationComplete = migrationStatus === "succeeded" || branchCount > 0;
    const venueLive = isZoneMigrationReady(zone);

    const statusLabel = useMemo(() => {
        if (!zone) return "No zone found";
        if (venueLive) return "Venue is live on the per-branch resource model";
        if (migrationComplete) return "Migration completed; waiting for active lifecycle";
        if (migrationStatus === "failed") return "Migration failed; venue is not live yet";
        if (migrationStatus === "pending") return "Migration is running before go-live";
        return "Venue is waiting on migration";
    }, [migrationComplete, migrationStatus, venueLive, zone]);

    const statusColor = venueLive ? COLORS.success : migrationStatus === "failed" ? COLORS.error : COLORS.warning;

    const runMigration = async () => {
        if (!zone?.id || !user?._id) return;
        logFlowEvent("ZoneMigrationTools", "Starting branch migration", {
            zoneId: zone.id,
            adminUid: user._id,
        });

        setShowMigrationDialog(true);
    };

    const confirmMigration = async () => {
        if (!zone?.id || !user?._id) return;
        setShowMigrationDialog(false);
        setMigrating(true);
        const result = await migrateZoneBranchesToSubcollection(zone.id, user._id);
        setMigrating(false);

        if (result.ok) {
            await refresh();
            showToast({
                type: "success",
                title: "Migration Complete",
                message: `Branches: ${result.branchCount} | Resources: ${result.resourceCount}`,
            });
        } else {
            showToast({ type: "error", title: "Migration Failed", message: result.message });
        }
    };

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader title="Migration Tools" onBack={() => router.back()} inlineTitle />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={styles.statusText}>{statusLabel}</Text>
                    </View>

                    <Text style={styles.cardTitle}>Branch Data Model</Text>
                    <Text style={styles.cardDescription}>
                        Use this admin/system surface to inspect migration status, repair legacy venues, and retry failed runs.
                    </Text>

                    <View style={styles.pointRow}>
                        <AppIcon name="storefront" size={16} color={COLORS.accent} />
                        <Text style={styles.pointText}>Lifecycle: {getZoneLifecycleLabel(zone)}</Text>
                    </View>
                    <View style={styles.pointRow}>
                        <AppIcon name="sync" size={16} color={COLORS.accent} />
                        <Text style={styles.pointText}>Migration: {getZoneMigrationLabel(zone)}</Text>
                    </View>
                    {zone?.migration?.lastError ? (
                        <View style={styles.pointRow}>
                            <AppIcon name="error-outline" size={16} color={COLORS.error} />
                            <Text style={styles.pointText}>{zone.migration.lastError}</Text>
                        </View>
                    ) : null}

                    <View style={styles.metricsRow}>
                        <View style={styles.metricCard}>
                            <Text style={styles.metricValue}>{legacyCount}</Text>
                            <Text style={styles.metricLabel}>Legacy Branches</Text>
                        </View>
                        <View style={styles.metricCard}>
                            {loading ? (
                                <ActivityIndicator size="small" color={COLORS.accent} />
                            ) : (
                                <Text style={styles.metricValue}>{branchCount}</Text>
                            )}
                            <Text style={styles.metricLabel}>Migrated Branches</Text>
                        </View>
                    </View>

                    <Pressable
                        style={({ pressed }) => [
                            styles.primaryButton,
                            (!migrationEnabled || migrating) && styles.primaryButtonDisabled,
                            pressed && migrationEnabled && !migrating && { opacity: 0.9 },
                        ]}
                        onPress={runMigration}
                        disabled={!migrationEnabled || migrating}
                    >
                        {migrating ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <>
                                <AppIcon name="sync" size={18} color="#FFF" />
                                <Text style={styles.primaryButtonText}>
                                    {migrationStatus === "failed" ? "Retry Migration" : "Run Migration"}
                                </Text>
                            </>
                        )}
                    </Pressable>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Migration Scope</Text>
                    <View style={styles.pointRow}>
                        <AppIcon name="check-circle" size={16} color={COLORS.accent} />
                        <Text style={styles.pointText}>Keeps your existing branch records and upgrades the venue to the per-branch resource model</Text>
                    </View>
                    <View style={styles.pointRow}>
                        <AppIcon name="check-circle" size={16} color={COLORS.accent} />
                        <Text style={styles.pointText}>Creates seat-level resources per branch and tier</Text>
                    </View>
                    <View style={styles.pointRow}>
                        <AppIcon name="check-circle" size={16} color={COLORS.accent} />
                        <Text style={styles.pointText}>Creates court resources with branch ownership</Text>
                    </View>
                    <View style={styles.pointRow}>
                        <AppIcon name="check-circle" size={16} color={COLORS.accent} />
                        <Text style={styles.pointText}>Marks migration metadata on the zone document</Text>
                    </View>
                </View>
            </ScrollView>

            <AppDialog visible={showMigrationDialog} onClose={() => setShowMigrationDialog(false)}>
                <AppModalHeader
                    title={migrationStatus === "failed" ? "Retry Branch Migration" : "Run Branch Migration"}
                    onClose={() => setShowMigrationDialog(false)}
                />
                <AppModalBody contentContainerStyle={{ gap: SPACING.md }}>
                    <Text style={styles.cardDescription}>
                        This will create per-branch documents and seat/court resources from your existing branch data. The venue goes live only after migration succeeds.
                    </Text>
                </AppModalBody>
                <AppModalFooter>
                    <View style={{ flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md }}>
                        <AppButton variant="secondary" style={{ flex: 1 }} onPress={() => setShowMigrationDialog(false)}>
                            Cancel
                        </AppButton>
                        <AppButton style={{ flex: 1 }} onPress={confirmMigration} disabled={migrating} loading={migrating}>
                            {migrationStatus === "failed" ? "Retry" : "Run Migration"}
                        </AppButton>
                    </View>
                </AppModalFooter>
            </AppDialog>
        </Screen>
    );
}
