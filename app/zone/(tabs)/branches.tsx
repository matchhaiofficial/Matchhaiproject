import { useRouter } from "expo-router";
import { useConvexAuth, useQuery } from "convex/react";
import React, { useMemo } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";

import AppHeader from "../../../src/components/AppHeader";
import { api } from "../../../convex/_generated/api";
import { AppIcon } from "../../../src/components/AppIcon";
import { AppButton } from "../../../src/components/AppPrimitives";
import { useAuth } from "../../../src/context/AuthContext";
import Screen from "../../../src/components/Screen";
import { useTabBarClearance } from "../../../src/hooks/useTabBarClearance";
import { useToast } from "../../../src/hooks/useToast";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { useStartDiditKyc } from "../../../src/hooks/useDiditKyc";
import { COLORS, SPACING } from "../../../src/theme";
import { isUserFullyVerified } from "../../../src/utils/verificationGate";
import { getZoneMigrationLabel, isZoneMigrationReady } from "../../../src/utils/zoneLifecycle";
import { isAuthenticatedProfileReady } from "../../../src/utils/authReadiness";
import styles from "./branches.styles";

const ZONE_KYC_VERIFICATION_MESSAGE = "Please complete CNIC & face verification to unlock MatchHai features.";

export default function ZoneBranches() {
    const { zone, loading } = useZoneData();
    const { authUser, user, loading: authLoading } = useAuth();
    const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
    const { showToast } = useToast();
    const startDiditKyc = useStartDiditKyc();
    const router = useRouter();
    const bottomContentPadding = useTabBarClearance(SPACING.lg);
    const kycVerified = isUserFullyVerified(authUser, user);
    const protectedQueryReady = isAuthenticatedProfileReady({
        authLoading,
        convexAuthLoading,
        isAuthenticated,
        authUserId: authUser?.id,
        profileAuthId: user?.authId,
        profileUserId: user?._id,
    });
    const currentKyc = useQuery(
        api.kyc.getCurrentUserKyc,
        protectedQueryReady ? {} : "skip",
    );
    const kycStartActionLabel =
        currentKyc?.status === "rejected"
            ? "Retry Verification"
            : currentKyc?._id && (currentKyc.status === "not_started" || currentKyc.status === "expired")
                ? "Try Again"
                : "Start Verification";

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

    const headerGhostAction = <View style={styles.headerGhostAction} />;

    const handleStartVerification = async () => {
        const result = await startDiditKyc("zone_owner");
        showToast({
            type: result.ok ? "info" : "error",
            title: result.ok ? "Verification opened" : "Could not start verification",
            message: result.ok ? "Complete CNIC & face verification to unlock Zone Admin features." : result.message,
        });
    };

    const handleLockedAction = () => {
        showToast({
            type: "info",
            title: "Verify your identity",
            message: ZONE_KYC_VERIFICATION_MESSAGE,
        });
    };

    if (loading) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    if (!zone) {
        return (
            <Screen style={styles.screen} scroll={false} edges={['top']} contentStyle={styles.screenContent}>
                <AppHeader title="Branches" rightAction={headerGhostAction} inlineTitle />
                <View style={styles.emptyWrap}>
                    <Text style={styles.emptyTitle}>No zone found.</Text>
                </View>
            </Screen>
        );
    }

    return (
        <Screen style={styles.screen} scroll={false} edges={['top']} contentStyle={styles.screenContent}>
            <AppHeader title="Branches" rightAction={headerGhostAction} inlineTitle />
            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
                showsVerticalScrollIndicator={false}
            >
                {!kycVerified ? (
                    <View style={styles.verificationBanner}>
                        <View style={styles.verificationBannerHeader}>
                            <AppIcon name="mailVerified" size={20} color={COLORS.warning} />
                            <Text style={styles.verificationBannerTitle}>Verify your identity</Text>
                        </View>
                        <Text style={styles.verificationBannerText}>
                            {ZONE_KYC_VERIFICATION_MESSAGE}
                        </Text>
                        <View style={styles.verificationBannerActions}>
                            <AppButton style={styles.verificationActionButton} onPress={handleStartVerification}>
                                {kycStartActionLabel}
                            </AppButton>
                            <AppButton
                                variant="secondary"
                                style={styles.verificationActionButton}
                                onPress={() => router.push("/zone/profile/edit" as any)}
                            >
                                Profile Settings
                            </AppButton>
                        </View>
                    </View>
                ) : null}

                <Text style={styles.branchCountLabel}>{branches.length} locations</Text>

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
                        style={({ pressed }) => [
                            styles.addButton,
                            !kycVerified && styles.addButtonDisabled,
                            pressed && kycVerified && styles.addButtonPressed,
                        ]}
                        onPress={() => {
                            if (!kycVerified) {
                                handleLockedAction();
                                return;
                            }
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
                            style={({ pressed }) => [
                                styles.branchCard,
                                !kycVerified && styles.branchCardDisabled,
                                pressed && kycVerified && styles.branchCardPressed,
                            ]}
                            onPress={() => {
                                if (!kycVerified) {
                                    handleLockedAction();
                                    return;
                                }
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
