import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import Screen from "../../../src/components/Screen";
import { useAuth } from "../../../src/context/AuthContext";
import { useZoneData } from "../../../src/hooks/useZoneData";
import {
    getZoneBranchesFromSubcollection,
    migrateZoneBranchesToSubcollection,
} from "../../../src/services/zoneBranchMigrationService";
import { COLORS } from "../../../src/theme";
import styles from "./settings.styles";

export default function ZoneSettingsModule() {
    const router = useRouter();
    const { user } = useAuth();
    const { zone } = useZoneData();
    const [branchCount, setBranchCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [migrating, setMigrating] = useState(false);

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
    const migrated = Boolean(zone?.migration?.perBranchSeatModel) || branchCount > 0;

    const statusLabel = useMemo(() => {
        if (!zone) return "No zone found";
        if (migrated) return "Per-branch seat model active";
        return "Legacy embedded branch model";
    }, [zone, migrated]);

    const statusColor = migrated ? COLORS.success : COLORS.warning;

    const runMigration = async () => {
        if (!zone?.id || !user?._id) return;

        Alert.alert(
            "Run Branch Migration",
            "This will create per-branch documents and seat/court resources from your existing branch data.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Run Migration",
                    onPress: async () => {
                        setMigrating(true);
                        const result = await migrateZoneBranchesToSubcollection(zone.id, user._id);
                        setMigrating(false);

                        if (result.ok) {
                            await refresh();
                            Alert.alert(
                                "Migration Complete",
                                `Branches: ${result.branchCount}\nResources: ${result.resourceCount}`,
                            );
                        } else {
                            Alert.alert("Migration Failed", result.message);
                        }
                    },
                },
            ],
        );
    };

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader title="Venue Settings" onBack={() => router.back()} inlineTitle />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                        <Text style={styles.statusText}>{statusLabel}</Text>
                    </View>

                    <Text style={styles.cardTitle}>Branch Data Model</Text>
                    <Text style={styles.cardDescription}>
                        Your chosen architecture uses per-branch ownership with seat-level resources.
                    </Text>

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
                                <MaterialIcons name="sync" size={18} color="#FFF" />
                                <Text style={styles.primaryButtonText}>Run Migration</Text>
                            </>
                        )}
                    </Pressable>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Migration Scope</Text>
                    <View style={styles.pointRow}>
                        <MaterialIcons name="check-circle" size={16} color={COLORS.accent} />
                        <Text style={styles.pointText}>Creates `zones/{'{zoneId}'}/branches/{'{branchId}'}` docs</Text>
                    </View>
                    <View style={styles.pointRow}>
                        <MaterialIcons name="check-circle" size={16} color={COLORS.accent} />
                        <Text style={styles.pointText}>Creates seat-level resources per branch and tier</Text>
                    </View>
                    <View style={styles.pointRow}>
                        <MaterialIcons name="check-circle" size={16} color={COLORS.accent} />
                        <Text style={styles.pointText}>Creates court resources with branch ownership</Text>
                    </View>
                    <View style={styles.pointRow}>
                        <MaterialIcons name="check-circle" size={16} color={COLORS.accent} />
                        <Text style={styles.pointText}>Marks migration metadata on the zone document</Text>
                    </View>
                </View>
            </ScrollView>
        </Screen>
    );
}
