import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import Screen from "../../../src/components/Screen";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { subscribeDocs } from "../../../src/services/firestoreService";
import { COLORS } from "../../../src/theme";
import Logger from "../../../src/utils/logger";
import styles from "./branches.styles";

export default function ZoneBranches() {
    const { zone, loading } = useZoneData();
    const router = useRouter();
    const [branches, setBranches] = useState<any[]>([]);
    const [usingLegacyFallback, setUsingLegacyFallback] = useState(false);
    const [loadingBranches, setLoadingBranches] = useState(true);

    const legacyBranches = useMemo(
        () =>
            Array.isArray(zone?.branches)
                ? zone.branches.map((branch: any, index: number) => ({
                    id: branch?.id || `legacy_${index + 1}`,
                    ...branch,
                    _legacy: true,
                }))
                : [],
        [zone?.branches],
    );

    useEffect(() => {
        if (!zone?.id) {
            setLoadingBranches(false);
            return;
        }
        if (!zone?.migration?.perBranchSeatModel) {
            setBranches(legacyBranches);
            setUsingLegacyFallback(legacyBranches.length > 0);
            setLoadingBranches(false);
            return;
        }

        const unsub = subscribeDocs(
            {
                collectionPath: ["zones", zone.id, "branches"],
            },
            (docs) => {
                const list = docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data,
                }));
                if (list.length > 0) {
                    setBranches(list);
                    setUsingLegacyFallback(false);
                } else {
                    setBranches(legacyBranches);
                    setUsingLegacyFallback(legacyBranches.length > 0);
                }
                setLoadingBranches(false);
            },
            (error: any) => {
                setBranches(legacyBranches);
                setUsingLegacyFallback(legacyBranches.length > 0);
                setLoadingBranches(false);
                if (error?.code !== "permission-denied") {
                    Logger.error("ZoneBranches", "branches listener failed", error);
                }
            },
        );

        return () => unsub();
    }, [legacyBranches, zone?.id, zone?.migration?.perBranchSeatModel]);

    if (loading || loadingBranches) {
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
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {usingLegacyFallback && (
                    <View style={styles.noticeBox}>
                        <Text style={styles.noticeTitle}>
                            Legacy branch model detected
                        </Text>
                        <Text style={styles.noticeText}>
                            Run migration from Venue Settings to enable per-branch seat-level resources.
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
                        <MaterialIcons name="add" size={18} color="#fff" />
                        <Text style={styles.addButtonText}>Add New Branch</Text>
                    </Pressable>
                </View>

                {branches.length === 0 ? (
                    <View style={styles.emptyWrap}>
                        <Text style={styles.emptyText}>No branches found.</Text>
                    </View>
                ) : (
                    branches.map((branch) => (
                        <Pressable
                            key={branch.id}
                            style={({ pressed }) => [styles.branchCard, pressed && styles.branchCardPressed]}
                            onPress={() => {
                                router.push(`/zone/branch/${branch.id}`);
                            }}
                        >
                            <View style={styles.branchCardRow}>
                                <View>
                                    <View style={styles.branchTitleRow}>
                                        <Text style={styles.branchTitle}>
                                            {branch.branchDisplayName || "Main Branch"}
                                        </Text>
                                        {branch.isPrimary && (
                                            <View style={styles.primaryPill}>
                                                <Text style={styles.primaryPillText}>
                                                    Primary
                                                </Text>
                                            </View>
                                        )}
                                        {branch._legacy && (
                                            <View style={styles.legacyPill}>
                                                <Text style={styles.legacyPillText}>
                                                    Legacy
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.branchLocation}>
                                        {branch.areaLabel}, {branch.city}
                                    </Text>
                                    <Text style={styles.branchAddress}>
                                        {branch.addressLine1}
                                    </Text>
                                </View>
                                <MaterialIcons name="chevron-right" size={24} color={COLORS.muted} />
                            </View>
                        </Pressable>
                    ))
                )}
            </ScrollView>
        </Screen>
    );
}

