import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { AppIcon } from "../../../src/components/AppIcon";
import Screen from "../../../src/components/Screen";
import { useAuth } from "../../../src/context/AuthContext";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { COLORS } from "../../../src/theme";
import { getZoneLifecycleLabel, getZoneMigrationLabel } from "../../../src/utils/zoneLifecycle";
import styles from "./settings.styles";

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.pointRow}>
            <Text style={styles.pointText}>
                <Text style={styles.pointLabel}>{label}: </Text>
                {value}
            </Text>
        </View>
    );
}

export default function ZoneSettingsModule() {
    const router = useRouter();
    const { user } = useAuth();
    const { zone } = useZoneData();

    useRouteLogger("ZoneSettingsModule", {
        zoneId: zone?.id,
        userId: user?._id,
    });

    const primaryBranch = zone?.primaryBranch;
    const branchCount = Array.isArray(zone?.branches) ? zone.branches.length : 0;

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader title="Venue Settings" onBack={() => router.back()} inlineTitle />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Venue Profile</Text>
                    <Text style={styles.cardDescription}>
                        This surface now reflects venue configuration instead of system migration tools.
                    </Text>

                    <InfoRow label="Venue brand" value={zone?.venueBrandName || "Not set"} />
                    <InfoRow label="Business type" value={zone?.type || "Not set"} />
                    <InfoRow label="Owner" value={zone?.ownerFullName || user?.fullName || "Not set"} />
                    <InfoRow label="Contact email" value={zone?.contactEmail || "Not set"} />
                    <InfoRow label="Contact phone" value={zone?.contactPhone || "Not set"} />
                    <InfoRow label="Lifecycle" value={getZoneLifecycleLabel(zone)} />
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Branch Details</Text>
                    <Text style={styles.cardDescription}>
                        Core venue location details are shown here from the current zone profile.
                    </Text>

                    <InfoRow label="Total branches" value={String(branchCount)} />
                    <InfoRow label="Primary branch" value={primaryBranch?.branchDisplayName || "Not set"} />
                    <InfoRow label="City" value={primaryBranch?.city || "Not set"} />
                    <InfoRow label="Area" value={primaryBranch?.areaLabel || "Not set"} />
                    <InfoRow label="Address" value={primaryBranch?.addressLine1 || "Not set"} />
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Configuration Panels</Text>
                    <Text style={styles.cardDescription}>
                        These settings are intentionally shown as explicit placeholders until editable forms are wired.
                    </Text>

                    <View style={styles.pointRow}>
                        <AppIcon name="schedule" size="sm" tone="accent" />
                        <Text style={styles.pointText}>Operating hours: read-only placeholder</Text>
                    </View>
                    <View style={styles.pointRow}>
                        <AppIcon name="policy" size="sm" tone="accent" />
                        <Text style={styles.pointText}>Venue policies: read-only placeholder</Text>
                    </View>
                    <View style={styles.pointRow}>
                        <AppIcon name="payments" size="sm" tone="accent" />
                        <Text style={styles.pointText}>Payout and finance settings: read-only placeholder</Text>
                    </View>
                </View>

                <View style={[styles.card, styles.systemToolsCard]}>
                    <View style={styles.systemToolsHeader}>
                        <View style={styles.systemToolsIconBadge}>
                            <AppIcon name="construction" size={20} color={COLORS.accent} />
                        </View>
                        <View style={styles.systemToolsHeaderText}>
                            <Text style={styles.cardTitle}>System Tools</Text>
                            <Text style={styles.cardDescription}>
                                Migration status and repair actions now live in a separate admin/system surface.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.migrationStateBox}>
                        <Text style={styles.migrationStateLabel}>Current migration state</Text>
                        <Text style={styles.migrationStateValue}>{getZoneMigrationLabel(zone)}</Text>
                    </View>

                    <Pressable
                        style={({ pressed }) => [
                            styles.primaryButton,
                            styles.systemToolsButton,
                            pressed && styles.primaryButtonPressed,
                        ]}
                        onPress={() => router.push("/zone/modules/migration-tools" as any)}
                    >
                        <AppIcon name="construction" size={18} color="#FFF" />
                        <Text style={styles.primaryButtonText}>Open Migration Tools</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </Screen>
    );
}
