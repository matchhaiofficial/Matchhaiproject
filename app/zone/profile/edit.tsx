import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CITY_OPTIONS } from "../../../constants/profileOptions";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import AppHeader from "../../../src/components/AppHeader";
import { AppIcon } from "../../../src/components/AppIcon";
import { CustomSingleSelect } from "../../../src/components/CustomSingleSelect";
import { useAuth } from "../../../src/context/AuthContext";
import { useSessionRefreshPolling } from "../../../src/hooks/useSessionRefreshPolling";
import { useToast } from "../../../src/hooks/useToast";
import { authClient } from "../../../src/lib/auth-client";
import { convex } from "../../../src/lib/convex";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { updateZone } from "../../../src/services/convex/zoneService";
import { isPhoneAvailable, isUsernameAvailable } from "../../../src/services/userService";
import { COLORS } from "../../../src/theme";
import styles from "../../(player)/profile/edit.styles";

const formatPakistaniPhone = (value: string) => {
    const numeric = value.replace(/\D/g, "");
    if (!numeric) return value;

    let prefix = "";
    let rest = numeric;

    if (numeric.startsWith("92")) {
        prefix = "+92 ";
        rest = numeric.slice(2);
    } else if (numeric.startsWith("0")) {
        prefix = "0";
        rest = numeric.slice(1);
    } else {
        return value;
    }

    if (rest.length <= 3) return `${prefix}${rest}`.trim();
    if (rest.length <= 7) return `${prefix}${rest.slice(0, 3)} ${rest.slice(3)}`.trim();
    return `${prefix}${rest.slice(0, 3)} ${rest.slice(3, 7)} ${rest.slice(7)}`.trim();
};

const isGeneratedUsername = (value?: string | null) => /^user_\d+$/i.test(String(value || "").trim());

const toUsernameCandidate = (value?: string | null) => {
    const cleaned = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/@.*$/, "")
        .replace(/[^a-z0-9_]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 20);

    return cleaned.length >= 3 ? cleaned : "";
};

const resolveZoneUsername = (input: {
    rawUsername?: string | null;
    ownerFullName?: string | null;
    venueBrandName?: string | null;
    email?: string | null;
}) => {
    const rawUsername = String(input.rawUsername || "").trim();
    if (rawUsername && !isGeneratedUsername(rawUsername)) return rawUsername;

    return (
        toUsernameCandidate(input.ownerFullName) ||
        toUsernameCandidate(input.venueBrandName) ||
        toUsernameCandidate(input.email) ||
        "zone_admin"
    );
};

export default function ZoneEditProfile() {
    const { user, authUser, refreshSession, refreshUser } = useAuth();
    const { zone, loading: zoneLoading } = useZoneData();
    const { showToast } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [venueBrandName, setVenueBrandName] = useState("");
    const [ownerFullName, setOwnerFullName] = useState("");
    const [username, setUsername] = useState("");
    const [city, setCity] = useState("Karachi");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [originalPhone, setOriginalPhone] = useState("");
    const [phoneVerified, setPhoneVerified] = useState(false);
    const [pendingEmail, setPendingEmail] = useState("");

    const [isEmailChanging, setIsEmailChanging] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [emailUpdating, setEmailUpdating] = useState(false);

    const [isPasswordChanging, setIsPasswordChanging] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [password, setPassword] = useState("");
    const [currentPasswordVisible, setCurrentPasswordVisible] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [passwordUpdating, setPasswordUpdating] = useState(false);

    const [phoneStatus, setPhoneStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
    const [shouldPersistDerivedUsername, setShouldPersistDerivedUsername] = useState(false);
    const hydratedZoneKeyRef = useRef<string | null>(null);

    const {
        hasUpper,
        hasLower,
        hasNumber,
        hasSpecial,
        isLengthValid,
        strengthLabel,
        strengthColor,
        strengthWidth,
    } = useMemo(() => {
        const hasUpperRule = /[A-Z]/.test(password);
        const hasLowerRule = /[a-z]/.test(password);
        const hasNumberRule = /[0-9]/.test(password);
        const hasSpecialRule = /[^A-Za-z0-9]/.test(password);
        const lengthOkRule = password.length >= 8;
        const rulesMet = [hasUpperRule, hasLowerRule, hasNumberRule, hasSpecialRule, lengthOkRule].filter(Boolean).length;

        if (!password) {
            return {
                hasUpper: hasUpperRule,
                hasLower: hasLowerRule,
                hasNumber: hasNumberRule,
                hasSpecial: hasSpecialRule,
                isLengthValid: lengthOkRule,
                strengthLabel: null,
                strengthColor: COLORS.muted,
                strengthWidth: 0,
            };
        }

        if (rulesMet <= 2) {
            return {
                hasUpper: hasUpperRule,
                hasLower: hasLowerRule,
                hasNumber: hasNumberRule,
                hasSpecial: hasSpecialRule,
                isLengthValid: lengthOkRule,
                strengthLabel: "Weak",
                strengthColor: COLORS.error,
                strengthWidth: 25,
            };
        }

        if (rulesMet === 3) {
            return {
                hasUpper: hasUpperRule,
                hasLower: hasLowerRule,
                hasNumber: hasNumberRule,
                hasSpecial: hasSpecialRule,
                isLengthValid: lengthOkRule,
                strengthLabel: "Fair",
                strengthColor: "#ffb74d",
                strengthWidth: 50,
            };
        }

        if (rulesMet === 4) {
            return {
                hasUpper: hasUpperRule,
                hasLower: hasLowerRule,
                hasNumber: hasNumberRule,
                hasSpecial: hasSpecialRule,
                isLengthValid: lengthOkRule,
                strengthLabel: "Strong",
                strengthColor: COLORS.success,
                strengthWidth: 75,
            };
        }

        return {
            hasUpper: hasUpperRule,
            hasLower: hasLowerRule,
            hasNumber: hasNumberRule,
            hasSpecial: hasSpecialRule,
            isLengthValid: lengthOkRule,
            strengthLabel: "Very strong",
            strengthColor: COLORS.success,
            strengthWidth: 100,
        };
    }, [password]);

    const isPasswordValid = hasUpper && hasLower && hasNumber && hasSpecial && isLengthValid;

    const isPhoneFormatValid = useMemo(() => {
        const normalizedPhone = phone.trim().replace(/\s|-/g, "");
        return /^(\+92|92|0)?3[0-9]{9}$/.test(normalizedPhone);
    }, [phone]);

    const isNewEmailValid = useMemo(() => {
        const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
        const trimmedNew = newEmail.trim();
        return emailRegex.test(trimmedNew) && trimmedNew !== email;
    }, [newEmail, email]);

    const isEmailVerified = Boolean(authUser?.emailVerified) && !pendingEmail;

    useEffect(() => {
        let mounted = true;

        const hydrate = async () => {
            if (zoneLoading) return;
            if (!user?._id || !zone) {
                setLoading(false);
                return;
            }

            const hydrateKey = `${String(user._id)}:${String(zone.id)}`;
            if (hydratedZoneKeyRef.current === hydrateKey) {
                setLoading(false);
                return;
            }

            try {
                const [profile, session] = await Promise.all([
                    convex.query(api.users.getById, { userId: user._id as Id<"users"> }),
                    authClient.getSession(),
                ]);

                if (!mounted) return;

                hydratedZoneKeyRef.current = hydrateKey;

                const sessionEmail = session?.data?.user?.email || (profile as any)?.email || zone.contactEmail || "";
                const resolvedPhone = zone.contactPhone || (profile as any)?.phone || "";
                const rawUsername = (profile as any)?.username || zone.ownerUsername || "";
                const resolvedUsername = resolveZoneUsername({
                    rawUsername,
                    ownerFullName: zone.ownerFullName || (profile as any)?.fullName,
                    venueBrandName: zone.venueBrandName,
                    email: sessionEmail,
                });

                setVenueBrandName(zone.venueBrandName || "Zone Venue");
                setOwnerFullName(zone.ownerFullName || (profile as any)?.fullName || "");
                setUsername(resolvedUsername);
                setShouldPersistDerivedUsername(!rawUsername || isGeneratedUsername(rawUsername));
                setCity(zone.primaryBranch?.city || (profile as any)?.city || "Karachi");
                setEmail(sessionEmail);
                setPhone(resolvedPhone);
                setOriginalPhone(resolvedPhone);
                setPhoneVerified(Boolean((profile as any)?.phoneValidated));
                setPendingEmail((profile as any)?.pendingEmail || "");
            } catch (error) {
                console.error("Failed to load zone profile", error);
                showToast({ type: "error", title: "Error", message: "Failed to load profile." });
            } finally {
                if (mounted) setLoading(false);
            }
        };

        void hydrate();

        return () => {
            mounted = false;
        };
    }, [showToast, user?._id, zone?.id, zoneLoading]);

    useSessionRefreshPolling({
        enabled: Boolean(user?._id && pendingEmail),
        refreshSession,
    });

    useEffect(() => {
        if (!user?._id || !zone?.id || !pendingEmail) return;

        const checkEmailUpdate = async () => {
            try {
                const session = await authClient.getSession();
                const currentEmail = session?.data?.user?.email || "";
                if (currentEmail !== pendingEmail) return;

                await convex.mutation(api.users.updateFullProfile, {
                    userId: user._id as Id<"users">,
                    updates: { pendingEmail: null, email: currentEmail },
                });

                await updateZone(zone.id, { contactEmail: currentEmail });
                setEmail(currentEmail);
                setPendingEmail("");
                await refreshUser();

                showToast({
                    type: "success",
                    title: "Email Updated",
                    message: "Your email has been successfully updated.",
                });
            } catch (error) {
                console.error("Error checking email update", error);
            }
        };

        void checkEmailUpdate();
    }, [pendingEmail, refreshUser, showToast, user?._id, zone?.id]);

    const handlePhoneBlur = async () => {
        const phoneTrimmed = phone.trim();
        const normalizedPhone = phoneTrimmed.replace(/\s|-/g, "");
        const originalNormalized = originalPhone.replace(/\s|-/g, "");

        if (!normalizedPhone || !isPhoneFormatValid) {
            setPhoneStatus("idle");
            return;
        }

        if (normalizedPhone === originalNormalized) {
            setPhoneStatus("idle");
            return;
        }

        try {
            setPhoneStatus("checking");
            const available = await isPhoneAvailable(normalizedPhone, user?._id);
            setPhoneStatus(available ? "available" : "taken");
        } catch {
            setPhoneStatus("idle");
        }
    };

    const handleUpdateEmail = async () => {
        if (!isNewEmailValid || !user?._id) return;

        try {
            setEmailUpdating(true);
            const result = await (authClient as any).changeEmail({
                newEmail: newEmail.trim(),
            });

            if (result?.error) throw result.error;

            await convex.mutation(api.users.updateFullProfile, {
                userId: user._id as Id<"users">,
                updates: { pendingEmail: newEmail.trim() },
            });

            setPendingEmail(newEmail.trim());
            setIsEmailChanging(false);
            setNewEmail("");
            showToast({
                type: "success",
                title: "Verification Sent",
                message: "Check your new email for the verification link.",
            });
        } catch (error: any) {
            console.error("Email update failed", error);
            showToast({
                type: "error",
                title: "Error",
                message: error?.message || "Failed to send verification email.",
            });
        } finally {
            setEmailUpdating(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!currentPassword) {
            showToast({ type: "error", title: "Current Password Required", message: "Enter your current password." });
            return;
        }
        if (!password) {
            showToast({ type: "error", title: "New Password Required", message: "Enter a new password." });
            return;
        }
        if (!isPasswordValid) {
            showToast({ type: "error", title: "Weak Password", message: "New password does not meet security requirements." });
            return;
        }

        try {
            setPasswordUpdating(true);
            const result = await (authClient as any).changePassword({
                currentPassword,
                newPassword: password,
            });

            if (result?.error) throw result.error;

            setCurrentPassword("");
            setPassword("");
            setIsPasswordChanging(false);
            showToast({ type: "success", title: "Success", message: "Password updated successfully." });
        } catch (error: any) {
            console.error("Password update failed", error);
            showToast({
                type: "error",
                title: "Error",
                message: error?.message?.includes("incorrect") ? "Current password is incorrect." : "Failed to update password.",
            });
        } finally {
            setPasswordUpdating(false);
        }
    };

    const handleSave = async () => {
        if (!user?._id || !zone?.id) return;

        if (venueBrandName.trim().length < 3) {
            showToast({ type: "info", title: "Required", message: "Venue name is required." });
            return;
        }

        if (ownerFullName.trim().length < 3) {
            showToast({ type: "info", title: "Required", message: "Owner name is required." });
            return;
        }

        if (!isPhoneFormatValid) {
            showToast({ type: "error", title: "Invalid Phone", message: "Enter a valid Pakistani phone number." });
            return;
        }

        if (phoneStatus === "taken") {
            showToast({ type: "error", title: "Invalid Phone", message: "This phone number is already in use." });
            return;
        }

        try {
            setSaving(true);
            const trimmedVenueName = venueBrandName.trim();
            const trimmedOwnerName = ownerFullName.trim();
            const trimmedPhone = phone.trim();
            let resolvedUsername = username.trim();

            if (shouldPersistDerivedUsername) {
                const baseUsername = resolveZoneUsername({
                    rawUsername: username,
                    ownerFullName: trimmedOwnerName,
                    venueBrandName: trimmedVenueName,
                    email,
                });

                resolvedUsername = baseUsername;
                for (let index = 0; index < 10; index += 1) {
                    const suffix = index === 0 ? "" : String(index + 1);
                    const candidate = `${baseUsername.slice(0, Math.max(3, 20 - suffix.length))}${suffix}`;
                    const available = await isUsernameAvailable(candidate, user._id as Id<"users">);
                    if (available) {
                        resolvedUsername = candidate;
                        break;
                    }
                }

                await convex.mutation(api.users.updateProfile, {
                    userId: user._id as Id<"users">,
                    username: resolvedUsername,
                    fullName: trimmedOwnerName,
                });
            }

            await convex.mutation(api.users.updateFullProfile, {
                userId: user._id as Id<"users">,
                updates: {
                    fullName: trimmedOwnerName,
                    city,
                    phone: trimmedPhone,
                    updatedAt: Date.now(),
                },
            });

            const nextPrimaryBranch = zone.primaryBranch
                ? { ...zone.primaryBranch, city }
                : undefined;

            const result = await updateZone(zone.id, {
                name: trimmedVenueName,
                venueBrandName: trimmedVenueName,
                ownerFullName: trimmedOwnerName,
                ownerUsername: resolvedUsername,
                city,
                phone: trimmedPhone,
                contactPhone: trimmedPhone,
                ...(nextPrimaryBranch ? { primaryBranch: nextPrimaryBranch } : {}),
            });

            if (!result.ok) {
                throw new Error(result.message || "Failed to update zone.");
            }

            await refreshUser();
            showToast({ type: "success", title: "Saved", message: "Profile updated successfully." });
            router.back();
        } catch (error: any) {
            console.error("Zone profile save failed", error);
            showToast({ type: "error", title: "Error", message: error?.message || "Failed to save changes." });
        } finally {
            setSaving(false);
        }
    };

    if (loading || zoneLoading) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen}>
            <AppHeader
                title="Edit Profile"
                onBack={() => router.back()}
                inlineTitle
                style={styles.appHeader}
                rightAction={
                    <Pressable
                        style={({ pressed }) => [
                            styles.saveButton,
                            saving && styles.saveButtonDisabled,
                            pressed && !saving && styles.saveButtonPressed,
                        ]}
                        onPress={handleSave}
                        disabled={saving}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
                    </Pressable>
                }
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.flex1}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                >
                    <Text style={styles.sectionTitle}>Basic Info</Text>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Venue Name</Text>
                        <View style={styles.inputBox}>
                            <TextInput
                                value={venueBrandName}
                                onChangeText={setVenueBrandName}
                                style={styles.input}
                                placeholder="Enter venue name"
                                placeholderTextColor={COLORS.muted}
                            />
                        </View>
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Owner Name</Text>
                        <View style={styles.inputBox}>
                            <TextInput
                                value={ownerFullName}
                                onChangeText={setOwnerFullName}
                                style={styles.input}
                                placeholder="Enter owner name"
                                placeholderTextColor={COLORS.muted}
                            />
                        </View>
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Username (Cannot be changed)</Text>
                        <View style={[styles.inputBox, styles.disabledInput]}>
                            <TextInput
                                value={username}
                                style={styles.input}
                                placeholder="Unique username"
                                placeholderTextColor={COLORS.muted}
                                autoCapitalize="none"
                                editable={false}
                            />
                        </View>
                        <Text style={styles.mutedHelperText}>Usernames are permanent and cannot be changed</Text>
                    </View>

                    <View style={styles.marginBottomLg}>
                        <CustomSingleSelect
                            label="City"
                            value={city}
                            options={CITY_OPTIONS}
                            onChange={setCity}
                            icon="location-city"
                        />
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Email Address</Text>
                        <View style={[styles.inputBox, styles.disabledInput]}>
                            <View style={styles.flexRowCentered}>
                                <AppIcon
                                    name="email"
                                    size={20}
                                    style={styles.iconMarginRight}
                                    color={COLORS.muted}
                                />
                                <TextInput
                                    placeholder="your@email.com"
                                    placeholderTextColor={COLORS.muted}
                                    style={styles.input}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={email}
                                    editable={false}
                                />
                                {isEmailVerified && (
                                    <AppIcon
                                        name="check-circle"
                                        size={18}
                                        style={styles.marginLeftSm}
                                        color={COLORS.success}
                                    />
                                )}
                            </View>
                        </View>

                        {pendingEmail ? (
                            <View style={styles.pendingEmailContainer}>
                                <View style={styles.pendingEmailHeader}>
                                    <AppIcon name="pending" size={18} color={COLORS.warning} />
                                    <Text style={styles.pendingEmailTitle}>Pending Verification</Text>
                                </View>
                                <Text style={styles.pendingEmailText}>{pendingEmail}</Text>
                            </View>
                        ) : null}

                        {!isEmailChanging ? (
                            <Pressable onPress={() => setIsEmailChanging(true)} style={styles.marginTopSm}>
                                <View style={styles.platformButton}>
                                    <Text style={styles.platformButtonText}>Change Email</Text>
                                </View>
                            </Pressable>
                        ) : (
                            <View style={styles.gapMd}>
                                <View style={styles.inputBox}>
                                    <View style={styles.flexRowCentered}>
                                        <AppIcon
                                            name="email"
                                            size={20}
                                            style={styles.iconMarginRight}
                                            color={isNewEmailValid && newEmail.trim().length > 0 ? COLORS.accent : COLORS.muted}
                                        />
                                        <TextInput
                                            value={newEmail}
                                            onChangeText={setNewEmail}
                                            style={styles.input}
                                            placeholder="New email address"
                                            placeholderTextColor={COLORS.muted}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                        />
                                    </View>
                                </View>

                                {newEmail.trim().length > 0 && !isNewEmailValid ? (
                                    <Text style={[styles.helperText, styles.helperError]}>
                                        {newEmail.trim() === email ? "New email must be different from current" : "Enter a valid email address"}
                                    </Text>
                                ) : null}

                                <View style={styles.gapMdRow}>
                                    <Pressable
                                        onPress={handleUpdateEmail}
                                        disabled={emailUpdating || !isNewEmailValid}
                                        style={[styles.passwordUpdateButton, (!isNewEmailValid || emailUpdating) && styles.passwordUpdateButtonDisabled]}
                                    >
                                        {emailUpdating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.passwordButtonText}>Send Verification</Text>}
                                    </Pressable>
                                    <Pressable
                                        onPress={() => {
                                            setIsEmailChanging(false);
                                            setNewEmail("");
                                        }}
                                        style={styles.passwordCancelButton}
                                    >
                                        <Text style={styles.passwordButtonText}>Cancel</Text>
                                    </Pressable>
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Phone Number</Text>
                        <View style={styles.inputBox}>
                            <View style={styles.flexRowCentered}>
                                <AppIcon
                                    name="phone-android"
                                    size={20}
                                    style={styles.iconMarginRight}
                                    color={isPhoneFormatValid && phone.trim().length > 0 ? COLORS.accent : COLORS.muted}
                                />
                                <TextInput
                                    value={phone}
                                    onChangeText={(value) => {
                                        setPhone(/^[\d+\s-]*$/.test(value) ? formatPakistaniPhone(value) : value);
                                        if (phoneStatus !== "idle") setPhoneStatus("idle");
                                    }}
                                    onBlur={handlePhoneBlur}
                                    style={styles.inputWithIcon}
                                    placeholder="03XX XXX XXXX"
                                    placeholderTextColor={COLORS.muted}
                                    keyboardType="phone-pad"
                                />
                                {phone.trim().length > 0 ? (
                                    <AppIcon
                                        name={
                                            phoneStatus === "checking"
                                                ? "hourglass-top"
                                                : phoneStatus === "available"
                                                    ? "check-circle"
                                                    : phoneStatus === "taken"
                                                        ? "error-outline"
                                                        : phoneVerified
                                                            ? "check-circle"
                                                            : "radio-button-unchecked"
                                        }
                                        size={18}
                                        style={styles.marginLeftSm}
                                        color={
                                            phoneStatus === "taken"
                                                ? COLORS.error
                                                : phoneStatus === "available" || phoneVerified
                                                    ? COLORS.success
                                                    : COLORS.muted
                                        }
                                    />
                                ) : null}
                            </View>
                        </View>
                        {phoneStatus === "checking" ? (
                            <Text style={[styles.helperText, styles.helperWarning]}>Checking number...</Text>
                        ) : null}
                        {phoneStatus === "available" ? (
                            <Text style={[styles.helperText, styles.helperOk]}>Looks good! Number is available.</Text>
                        ) : null}
                        {phoneStatus === "taken" ? (
                            <Text style={[styles.helperText, styles.helperError]}>This phone number is already in use.</Text>
                        ) : null}
                    </View>

                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Password</Text>

                        {!isPasswordChanging ? (
                            <Pressable onPress={() => setIsPasswordChanging(true)} style={styles.marginTopNone}>
                                <View style={styles.platformButton}>
                                    <Text style={styles.platformButtonText}>Change Password</Text>
                                </View>
                            </Pressable>
                        ) : (
                            <View style={styles.gapMd}>
                                <View style={styles.inputBox}>
                                    <TextInput
                                        value={currentPassword}
                                        onChangeText={setCurrentPassword}
                                        style={styles.inputWithToggle}
                                        placeholder="Current Password"
                                        placeholderTextColor={COLORS.muted}
                                        secureTextEntry={!currentPasswordVisible}
                                    />
                                    <Pressable onPress={() => setCurrentPasswordVisible(!currentPasswordVisible)} style={styles.togglePosition}>
                                        <AppIcon name={currentPasswordVisible ? "visibility" : "visibility-off"} size={20} color={COLORS.muted} />
                                    </Pressable>
                                </View>

                                <View style={styles.inputBox}>
                                    <TextInput
                                        value={password}
                                        onChangeText={setPassword}
                                        style={styles.inputWithToggle}
                                        placeholder="New Password"
                                        placeholderTextColor={COLORS.muted}
                                        secureTextEntry={!passwordVisible}
                                    />
                                    <Pressable onPress={() => setPasswordVisible(!passwordVisible)} style={styles.togglePosition}>
                                        <AppIcon name={passwordVisible ? "visibility" : "visibility-off"} size={20} color={COLORS.muted} />
                                    </Pressable>
                                </View>

                                {password.length > 0 ? (
                                    <View style={styles.passwordStrengthWrapper}>
                                        <View style={styles.strengthMeterTrack}>
                                            <View style={[styles.strengthMeterFill, { width: `${strengthWidth}%`, backgroundColor: strengthColor }]} />
                                        </View>
                                        <Text style={[styles.strengthLabel, { color: strengthColor }]}>Strength: {strengthLabel}</Text>
                                    </View>
                                ) : null}

                                {password.length > 0 && !isPasswordValid ? (
                                    <View style={styles.passwordRequirementsRow}>
                                        <View style={styles.requirementColumn}>
                                            <Text style={[styles.passwordRequirementText, hasUpper && styles.passwordRequirementTextDone]}>
                                                {hasUpper ? "OK" : "--"} Upper case
                                            </Text>
                                            <Text style={[styles.passwordRequirementText, hasLower && styles.passwordRequirementTextDone]}>
                                                {hasLower ? "OK" : "--"} Lower case
                                            </Text>
                                        </View>
                                        <View style={styles.requirementColumn}>
                                            <Text style={[styles.passwordRequirementText, hasNumber && styles.passwordRequirementTextDone]}>
                                                {hasNumber ? "OK" : "--"} Number
                                            </Text>
                                            <Text style={[styles.passwordRequirementText, hasSpecial && styles.passwordRequirementTextDone]}>
                                                {hasSpecial ? "OK" : "--"} Special
                                            </Text>
                                            <Text style={[styles.passwordRequirementText, isLengthValid && styles.passwordRequirementTextDone]}>
                                                {isLengthValid ? "OK" : "--"} Min 8 chars
                                            </Text>
                                        </View>
                                    </View>
                                ) : null}

                                <View style={styles.passwordActionsRow}>
                                    <Pressable
                                        onPress={handleUpdatePassword}
                                        disabled={passwordUpdating || !isPasswordValid}
                                        style={[styles.passwordUpdateButton, (!isPasswordValid || passwordUpdating) && styles.passwordUpdateButtonDisabled]}
                                    >
                                        {passwordUpdating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.passwordButtonText}>Update Password</Text>}
                                    </Pressable>
                                    <Pressable
                                        onPress={() => {
                                            setIsPasswordChanging(false);
                                            setCurrentPassword("");
                                            setPassword("");
                                        }}
                                        style={styles.passwordCancelButton}
                                    >
                                        <Text style={styles.passwordButtonText}>Cancel</Text>
                                    </Pressable>
                                </View>
                            </View>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {saving ? (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            ) : null}
        </SafeAreaView>
    );
}
