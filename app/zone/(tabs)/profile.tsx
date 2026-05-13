import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import AppHeader from "../../../src/components/AppHeader";
import { AppIcon } from "../../../src/components/AppIcon";
import {
    AppDialog,
    AppModalBody,
    AppModalFooter,
    AppModalHeader,
} from "../../../src/components/AppModalPrimitives";
import { AppButton, AppCard, StatusPill } from "../../../src/components/AppPrimitives";
import { CustomSingleSelect } from "../../../src/components/CustomSingleSelect";
import Screen from "../../../src/components/Screen";
import { useAuth } from "../../../src/context/AuthContext";
import { useTabBarClearance } from "../../../src/hooks/useTabBarClearance";
import { useToast } from "../../../src/hooks/useToast";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { useEntrance } from "../../../src/motion/useEntrance";
import { signOutUser } from "../../../src/services/authService";
import { useStartDiditKyc } from "../../../src/hooks/useDiditKyc";
import { requestZoneWithdrawal } from "../../../src/services/convex/zoneWithdrawalService";
import { COLORS, SPACING } from "../../../src/theme";
import { getBottomChromeClearance } from "../../../src/utils/bottomChrome";
import { isUserFullyVerified } from "../../../src/utils/verificationGate";
import { getZoneLifecycleLabel } from "../../../src/utils/zoneLifecycle";
import { getZoneStatusTone } from "../../../src/utils/statusLabels";
import {
    PlayerEmptyStateCard,
    PlayerSectionHeader,
} from "../../(player)/components/PlayerSurface";
import styles from "./profile.styles";

const toPositiveNumber = (value: unknown) => {
    const parsed = Number(String(value ?? "").trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const getInitials = (value?: string | null) => {
    const cleaned = String(value || "").trim();
    if (!cleaned) return "?";
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return cleaned[0].toUpperCase();
};

const getBranchDisplayName = (branch: any) =>
    branch?.branchDisplayName || branch?.name || "Branch";

const getBranchLocation = (branch: any) =>
    [branch?.areaLabel, branch?.city].filter(Boolean).join(", ") || "Location not set";

const getBranchAddress = (branch: any) =>
    branch?.addressLine1 || branch?.address || "Address not set";

const getBranchInventorySummary = (branch: any) => {
    const labels: string[] = [];
    const pcCount =
        toPositiveNumber(branch?.pricing?.pc?.regular?.count) +
        toPositiveNumber(branch?.pricing?.pc?.premium?.count) +
        toPositiveNumber(branch?.pricing?.pc?.elite?.count);
    const consoleCount =
        toPositiveNumber(branch?.pricing?.console?.regular?.count) +
        toPositiveNumber(branch?.pricing?.console?.premium?.count) +
        toPositiveNumber(branch?.pricing?.console?.elite?.count) +
        toPositiveNumber(branch?.pricing?.console?.ps5?.count) +
        toPositiveNumber(branch?.pricing?.console?.xbox?.count);

    if (branch?.supportsCs2 || pcCount > 0) labels.push(`${pcCount || "PC"} setup${pcCount === 1 ? "" : "s"}`);
    if (branch?.supportsFc25 || branch?.supportsFc26 || branch?.supportsTekken8 || consoleCount > 0) {
        labels.push(`${consoleCount || "Console"} console${consoleCount === 1 ? "" : "s"}`);
    }

    return labels.length ? labels.join(" / ") : "Inventory not configured";
};

const HIDE_ZONE_TAB_BAR = process.env.EXPO_PUBLIC_HIDE_TAB_BAR === "1";
const BANK_OPTIONS = [
    "Habib Bank Limited (HBL)",
    "National Bank of Pakistan (NBP)",
    "United Bank Limited (UBL)",
    "MCB Bank Limited (MCB)",
    "Bank of Punjab (BOP)",
    "Sindh Bank",
    "Bank of Khyber (BOK)",
    "First Women Bank",
    "Zarai Taraqiati Bank Limited (ZTBL)",
    "Allied Bank Limited (ABL)",
    "Askari Bank",
    "Bank Alfalah Limited",
    "Bank Al-Habib Limited",
    "Habib Metropolitan Bank Limited",
    "JS Bank Limited",
    "Soneri Bank",
    "Standard Chartered Pakistan",
    "Meezan Bank Limited",
    "Dubai Islamic Bank",
    "Al Baraka Bank Pakistan",
    "Bank Makramah Limited (BML)",
    "BankIslami Pakistan Limited",
    "Faysal Bank",
    "Silk Bank",
] as const;

const normalizeAccountNumberInput = (value: string) =>
    String(value || "").replace(/[^0-9 -]/g, "").slice(0, 34);

export default function ZoneProfile() {
    const router = useRouter();
    const params = useLocalSearchParams<{ withdraw?: string | string[] }>();
    const insets = useSafeAreaInsets();
    const tabBarHeight = useBottomTabBarHeight();
    const { user, authUser } = useAuth();
    const { zone, loading } = useZoneData();
    const { showToast } = useToast();
    const startDiditKyc = useStartDiditKyc();
    const { animatedStyle: entranceStyle } = useEntrance({
        axis: "y",
        distance: 10,
        initialScale: 0.995,
    });

    const bottomChromeClearance = getBottomChromeClearance({
        bottomInset: insets.bottom,
        tabBarHeight: HIDE_ZONE_TAB_BAR ? 0 : tabBarHeight,
    });
    const [withdrawVisible, setWithdrawVisible] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState("");
    const [withdrawBranchId, setWithdrawBranchId] = useState("");
    const [withdrawBankName, setWithdrawBankName] = useState("");
    const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
    const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
    const tabBarScrollClearance = useTabBarClearance(SPACING.lg);
    const profileBottomPadding = Math.max(bottomChromeClearance + SPACING.lg, tabBarScrollClearance);
    const kycVerified = isUserFullyVerified(authUser, user);

    const branches = useMemo(() => {
        if (!Array.isArray(zone?.branches)) return [];
        return zone.branches.map((branch: any, index: number) => ({
            id: branch?.id || `branch_${index + 1}`,
            ...branch,
        }));
    }, [zone?.branches]);
    const walletBalance = Number((user as any)?.walletBalance || 0);

    useEffect(() => {
        const shouldOpen = Array.isArray(params.withdraw) ? params.withdraw[0] : params.withdraw;
        if (shouldOpen === "1") {
            if (!kycVerified) {
                showToast({
                    type: "info",
                    title: "Verify your identity",
                    message: "Please complete CNIC & face verification before requesting withdrawal.",
                });
                return;
            }
            setWithdrawVisible(true);
        }
    }, [kycVerified, params.withdraw, showToast]);

    useEffect(() => {
        if (!withdrawBranchId && branches[0]?.id) {
            setWithdrawBranchId(branches[0].id);
        }
    }, [branches, withdrawBranchId]);

    const venueName = zone?.venueBrandName || "Zone Venue";
    const ownerName = zone?.ownerFullName || user?.fullName || "Zone Admin";
    const primaryArea = zone?.primaryBranch?.areaLabel || branches[0]?.areaLabel || "";
    const city = zone?.primaryBranch?.city || branches[0]?.city || "";
    const locationLabel = [primaryArea, city].filter(Boolean).join(", ");
    const branchCountLabel = `${branches.length} branch${branches.length === 1 ? "" : "es"}`;
    const selectedWithdrawBranch = branches.find((branch: any) => branch.id === withdrawBranchId) || branches[0] || null;
    const parsedWithdrawAmount = Number(String(withdrawAmount).replace(/[^\d.]/g, ""));
    const trimmedAccountNumber = withdrawAccountNumber.trim();
    const accountNumberValid =
        /^[0-9 -]+$/.test(trimmedAccountNumber) &&
        trimmedAccountNumber.length >= 6 &&
        trimmedAccountNumber.length <= 34;
    const canSubmitWithdrawal =
        kycVerified &&
        Boolean(user?._id) &&
        Boolean(selectedWithdrawBranch) &&
        Number.isFinite(parsedWithdrawAmount) &&
        parsedWithdrawAmount > 0 &&
        parsedWithdrawAmount <= walletBalance &&
        Boolean(withdrawBankName) &&
        accountNumberValid;

    const closeWithdrawModal = () => {
        if (withdrawSubmitting) return;
        setWithdrawVisible(false);
        setWithdrawAmount("");
        setWithdrawBankName("");
        setWithdrawAccountNumber("");
    };

    const submitWithdrawRequest = async () => {
        if (!kycVerified) {
            showToast({
                type: "info",
                title: "Verify your identity",
                message: "Please complete CNIC & face verification before requesting withdrawal.",
            });
            return;
        }
        if (!user?._id || !selectedWithdrawBranch || !canSubmitWithdrawal) return;
        setWithdrawSubmitting(true);
        const result = await requestZoneWithdrawal({
            userId: user._id,
            zoneId: zone?.id,
            branchId: selectedWithdrawBranch.id,
            branchName: getBranchDisplayName(selectedWithdrawBranch),
            amount: parsedWithdrawAmount,
            bankName: withdrawBankName,
            accountNumber: trimmedAccountNumber,
            ownerName,
            ownerEmail: zone?.contactEmail || user?.email,
            venueName,
        });
        setWithdrawSubmitting(false);
        if (!result.ok) {
            showToast({ type: "error", title: "Request failed", message: result.message });
            return;
        }
        showToast({
            type: "success",
            title: "Request sent",
            message: "Your withdrawal request was sent to MatchHai admin.",
        });
        closeWithdrawModal();
    };

    const handleLogout = () => {
        Alert.alert("Logout", "Are you sure you want to logout?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout",
                style: "destructive",
                onPress: async () => {
                    const result = await signOutUser();
                    if (result.ok) {
                        router.replace("/auth/login");
                    } else {
                        showToast({ type: "error", title: "Logout Failed", message: result.message });
                    }
                },
            },
        ]);
    };

    const handleStartVerification = async () => {
        const result = await startDiditKyc("zone_owner");
        showToast({
            type: result.ok ? "info" : "error",
            title: result.ok ? "Verification opened" : "Could not start verification",
            message: result.ok ? "Complete CNIC & face verification to unlock Zone Admin features and withdrawals." : result.message,
        });
    };

    if (loading) {
        return (
            <Screen style={styles.screen} scroll={false} edges={["top"]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            </Screen>
        );
    }

    if (!zone) {
        return (
            <Screen style={styles.screen} scroll={false} edges={["top"]} contentStyle={styles.scrollContent}>
                <AppHeader title="Profile" inlineTitle />
                <View style={styles.emptyWrap}>
                    <PlayerEmptyStateCard
                        title="Zone profile not found."
                        description="We could not find a zone linked to this account yet."
                    />
                </View>
            </Screen>
        );
    }

    return (
        <Screen
            style={styles.screen}
            scroll
            routeKey="/zone/(tabs)/profile"
            contentStyle={[
                styles.scrollContent,
                { paddingBottom: profileBottomPadding },
            ]}
            edges={["top"]}
            scrollProps={{ showsVerticalScrollIndicator: false }}
        >
            <AppHeader
                title="Profile"
                inlineTitle
                rightAction={(
                    <View style={styles.headerActions}>
                        <Pressable
                            style={styles.headerIcon}
                            onPress={() => router.push("/zone/modules/ai-support" as any)}
                            accessibilityRole="button"
                            accessibilityLabel="Open Help and Support"
                        >
                            <AppIcon name="support" size={22} color={COLORS.text} />
                        </Pressable>
                        <Pressable
                            style={styles.headerIcon}
                            onPress={() => router.push("/zone/profile/edit" as any)}
                            accessibilityRole="button"
                            accessibilityLabel="Open profile settings"
                        >
                            <AppIcon name="settings" size={24} color={COLORS.text} />
                        </Pressable>
                    </View>
                )}
            />

            <Animated.View style={entranceStyle}>
                <AppCard style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{getInitials(venueName)}</Text>
                    </View>
                    <Text style={styles.profileName} numberOfLines={1}>{venueName}</Text>
                    <Text style={styles.profileUsername} numberOfLines={1}>{ownerName}</Text>
                    {zone.contactEmail || user?.email ? (
                        <Text style={styles.profileEmail} numberOfLines={1}>
                            {zone.contactEmail || user?.email}
                        </Text>
                    ) : null}

                    <View style={styles.profileMeta}>
                        {locationLabel ? (
                            <View style={styles.profileMetaItem}>
                                <AppIcon name="location-on" size={14} color={COLORS.muted} />
                                <Text style={styles.profileMetaText} numberOfLines={1}>{locationLabel}</Text>
                            </View>
                        ) : null}
                        <View style={styles.profileMetaItem}>
                            <AppIcon name="store" size={14} color={COLORS.muted} />
                            <Text style={styles.profileMetaText}>{branchCountLabel}</Text>
                        </View>
                    </View>

                    <View style={styles.profileStatusRow}>
                        <StatusPill tone={getZoneStatusTone(zone.status)} label={getZoneLifecycleLabel(zone)} />
                        <StatusPill tone="neutral" label={zone.type === "sports" ? "Sports" : zone.type === "hybrid" ? "Hybrid" : "Gaming"} />
                    </View>
                </AppCard>

                <AppCard style={styles.profileCard}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <View>
                            <Text style={styles.profileName}>Complete CNIC & face verification</Text>
                            <Text style={styles.profileEmail}>
                                Verify your identity to unlock Zone Admin features and withdrawals.
                            </Text>
                        </View>
                        <StatusPill
                            tone={kycVerified ? "success" : "warning"}
                            label={kycVerified ? "Verified" : String(user?.kycVerificationStatus || "Not started").replace(/_/g, " ")}
                        />
                    </View>
                    {!kycVerified ? (
                        <AppButton style={styles.logoutButton} onPress={handleStartVerification}>
                            Start CNIC & Face Verification
                        </AppButton>
                    ) : user?.kycVerifiedAt ? (
                        <Text style={styles.profileMetaText}>
                            Verified {new Date(user.kycVerifiedAt).toLocaleDateString()}
                        </Text>
                    ) : null}
                </AppCard>

                <View style={styles.section}>
                    <PlayerSectionHeader
                        title="My Branches"
                        actionLabel="Add"
                        onPress={() => router.push("/zone/branch/new" as any)}
                    />
                    <View style={styles.branchActionsRow}>
                        <Pressable
                            style={styles.withdrawInlineButton}
                            onPress={() => {
                                if (!kycVerified) {
                                    showToast({
                                        type: "info",
                                        title: "Verify your identity",
                                        message: "Please complete CNIC & face verification before requesting withdrawal.",
                                    });
                                    return;
                                }
                                setWithdrawVisible(true);
                            }}
                        >
                            <AppIcon name="wallet" size={18} color={COLORS.accent} />
                            <Text style={styles.withdrawInlineText}>Withdraw request</Text>
                        </Pressable>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.branchesScrollContainer}
                    >
                        {branches.length > 0 ? (
                            branches.map((branch: any) => (
                                <Pressable
                                    key={branch.id}
                                    style={styles.branchCard}
                                    onPress={() => router.push(`/zone/branch/${branch.id}` as any)}
                                >
                                    <AppCard style={styles.branchCardInner}>
                                        <View style={styles.branchIcon}>
                                            <AppIcon name="storefront" size={24} color={COLORS.accent} />
                                        </View>
                                        <View style={styles.branchInfo}>
                                            <View style={styles.branchTitleRow}>
                                                <Text style={styles.branchName} numberOfLines={1}>
                                                    {getBranchDisplayName(branch)}
                                                </Text>
                                                {branch?.isPrimary ? (
                                                    <View style={styles.primaryBadge}>
                                                        <Text style={styles.primaryText}>Primary</Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                            <View style={styles.branchDetailRow}>
                                                <AppIcon name="location-on" size={12} color={COLORS.muted} />
                                                <Text style={styles.branchLocation} numberOfLines={1}>
                                                    {getBranchLocation(branch)}
                                                </Text>
                                            </View>
                                            <Text style={styles.branchInventory} numberOfLines={1}>
                                                {getBranchInventorySummary(branch)}
                                            </Text>
                                            <Text style={styles.branchAddress} numberOfLines={1}>
                                                {getBranchAddress(branch)}
                                            </Text>
                                        </View>
                                        <AppIcon name="chevron-right" size={20} color={COLORS.muted} />
                                    </AppCard>
                                </Pressable>
                            ))
                        ) : (
                            <Pressable
                                style={styles.emptyBranchCard}
                                onPress={() => router.push("/zone/branch/new" as any)}
                            >
                                <AppCard style={styles.emptyBranchCardInner}>
                                    <View style={styles.branchIconInactive}>
                                        <AppIcon name="add" size={24} color={COLORS.muted} />
                                    </View>
                                    <View>
                                        <Text style={styles.emptyBranchTitle}>Add your first branch</Text>
                                        <Text style={styles.emptyBranchText}>Tap to create</Text>
                                    </View>
                                </AppCard>
                            </Pressable>
                        )}
                    </ScrollView>
                </View>

                <AppButton variant="danger" style={styles.logoutButton} onPress={handleLogout}>
                    <AppIcon name="logout" size={20} color={COLORS.error} />
                    <Text style={styles.logoutButtonText}>Logout</Text>
                </AppButton>
            </Animated.View>

            <AppDialog
                visible={withdrawVisible}
                onClose={closeWithdrawModal}
                dismissDisabled={withdrawSubmitting}
                cardStyle={styles.withdrawDialog}
            >
                <AppModalHeader
                    title="Withdraw request"
                    subtitle={`Wallet balance: PKR ${Math.round(walletBalance).toLocaleString("en-US")}`}
                    onClose={closeWithdrawModal}
                    closeDisabled={withdrawSubmitting}
                />
                <AppModalBody scroll contentContainerStyle={styles.withdrawBody}>
                    <Text style={styles.withdrawLabel}>Branch</Text>
                    <View style={styles.withdrawBranchWrap}>
                        {branches.map((branch: any) => {
                            const selected = branch.id === withdrawBranchId;
                            return (
                                <Pressable
                                    key={branch.id}
                                    onPress={() => setWithdrawBranchId(branch.id)}
                                    style={[styles.withdrawBranchChip, selected && styles.withdrawBranchChipActive]}
                                >
                                    <Text style={[styles.withdrawBranchChipText, selected && styles.withdrawBranchChipTextActive]}>
                                        {getBranchDisplayName(branch)}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    <Text style={styles.withdrawLabel}>Amount</Text>
                    <View style={styles.withdrawInputBox}>
                        <Text style={styles.withdrawCurrency}>PKR</Text>
                        <TextInput
                            style={styles.withdrawInput}
                            value={withdrawAmount}
                            onChangeText={setWithdrawAmount}
                            keyboardType="numeric"
                            placeholder="Enter amount"
                            placeholderTextColor={COLORS.muted}
                        />
                    </View>
                    {parsedWithdrawAmount > walletBalance ? (
                        <Text style={styles.withdrawWarning}>Amount cannot exceed your wallet balance.</Text>
                    ) : null}
                    <CustomSingleSelect
                        label={<Text style={styles.withdrawLabel}>Bank</Text>}
                        value={withdrawBankName}
                        options={BANK_OPTIONS}
                        onChange={setWithdrawBankName}
                        icon="payment"
                        placeholder="Select bank"
                        containerStyle={styles.withdrawSelectContainer}
                    />
                    {!withdrawBankName ? (
                        <Text style={styles.withdrawWarning}>Select a bank.</Text>
                    ) : null}
                    <Text style={styles.withdrawLabel}>Account number</Text>
                    <View style={styles.withdrawInputBox}>
                        <AppIcon name="account-balance-wallet" size={18} color={COLORS.accent} />
                        <TextInput
                            style={styles.withdrawInput}
                            value={withdrawAccountNumber}
                            onChangeText={(value) => setWithdrawAccountNumber(normalizeAccountNumberInput(value))}
                            keyboardType="default"
                            placeholder="Enter account number"
                            placeholderTextColor={COLORS.muted}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>
                    {trimmedAccountNumber.length > 0 && !accountNumberValid ? (
                        <Text style={styles.withdrawWarning}>
                            Account number must be 6 to 34 characters.
                        </Text>
                    ) : null}
                </AppModalBody>
                <AppModalFooter style={styles.withdrawFooter}>
                    <Pressable
                        style={[styles.withdrawAction, styles.withdrawCancelAction]}
                        onPress={closeWithdrawModal}
                        disabled={withdrawSubmitting}
                    >
                        <Text style={styles.withdrawCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                        style={[styles.withdrawAction, styles.withdrawSubmitAction, !canSubmitWithdrawal && styles.withdrawSubmitDisabled]}
                        onPress={submitWithdrawRequest}
                        disabled={!canSubmitWithdrawal || withdrawSubmitting}
                    >
                        {withdrawSubmitting ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Text style={styles.withdrawSubmitText}>Send request</Text>
                        )}
                    </Pressable>
                </AppModalFooter>
            </AppDialog>
        </Screen>
    );
}
