import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AGE_RANGES, CITY_OPTIONS, KARACHI_AREAS } from "../../../constants/profileOptions";
import { CustomSingleSelect } from "../../../src/components/CustomSingleSelect";
import { useAuth } from "../../../src/context/AuthContext";
import { useToast } from "../../../src/hooks/useToast";
import type { FaceitProfileSummary } from "../../../src/services/faceitApi";
import type { PsnVerificationResult } from "../../../src/services/psnApi";
import type { SteamProfileSummary } from "../../../src/services/steamApi";
import Logger from "../../../src/utils/logger";
import { COLORS } from "../../../src/theme";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import styles from "./edit.styles";

// FACEIT Level Icons (matching register-step3 logic)
const faceitLevelIcons: Record<number, any> = {
    1: require("../../../assets/images/faceit-levels/Level 1.png"),
    2: require("../../../assets/images/faceit-levels/Level 2.png"),
    3: require("../../../assets/images/faceit-levels/Level 3.png"),
    4: require("../../../assets/images/faceit-levels/Level 4.png"),
    5: require("../../../assets/images/faceit-levels/Level 5.png"),
    6: require("../../../assets/images/faceit-levels/Level 6.png"),
    7: require("../../../assets/images/faceit-levels/Level 7.png"),
    8: require("../../../assets/images/faceit-levels/Level 8.png"),
    9: require("../../../assets/images/faceit-levels/Level 9.png"),
    10: require("../../../assets/images/faceit-levels/Level 10.png"),
};

// Pakistani phone formatter (same as register.tsx)
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

    let formatted = prefix;

    if (rest.length <= 3) {
        formatted += rest;
    } else if (rest.length <= 7) {
        formatted += rest.slice(0, 3) + " " + rest.slice(3);
    } else {
        formatted += rest.slice(0, 3) + " " + rest.slice(3, 7) + " " + rest.slice(7);
    }

    return formatted.trim();
};

export default function EditProfile() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';
    const convex = useConvex();
    const profileQuery = useQuery(api.users.getCurrentUser);
    const updateProfile = useMutation(api.users.updateProfile);
    const updatePlatformLinks = useMutation(api.users.updatePlatformLinks);
    const fetchSteamProfile = useAction(api.integrations.fetchSteamProfileFromUrl);
    const fetchFaceitProfile = useAction(api.integrations.fetchFaceitProfileFromUrl);
    const verifyPsnProfileAction = useAction(api.integrations.verifyPsnProfile);
    const hydratedRef = useRef<string | null>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form State
    const [fullName, setFullName] = useState("");
    const [username, setUsername] = useState("");
    const [originalUsername, setOriginalUsername] = useState("");
    const [city, setCity] = useState("Karachi");
    const [ageRange, setAgeRange] = useState("");
    const [email, setEmail] = useState(""); // Store full email now
    const [originalEmail, setOriginalEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [originalPhone, setOriginalPhone] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [password, setPassword] = useState(""); // New Password
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [currentPasswordVisible, setCurrentPasswordVisible] = useState(false);
    const [isPasswordChanging, setIsPasswordChanging] = useState(false);
    const [passwordUpdating, setPasswordUpdating] = useState(false);
    // Email change state
    const [isEmailChanging, setIsEmailChanging] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [emailUpdating, setEmailUpdating] = useState(false);
    const [pendingEmail, setPendingEmail] = useState(""); // Email awaiting verification
    const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

    // Platform Links
    const [steamProfileUrl, setSteamProfileUrl] = useState("");
    const [faceitProfileUrl, setFaceitProfileUrl] = useState("");
    const [psnOnlineId, setPsnOnlineId] = useState("");

    // Privacy Settings
    const [hideAreasPublicly, setHideAreasPublicly] = useState(false);
    const [hidePlatformsPublicly, setHidePlatformsPublicly] = useState(false);
    const [restrictInvitesToFriends, setRestrictInvitesToFriends] = useState(false);

    // Verification State
    const [steamProfile, setSteamProfile] = useState<SteamProfileSummary | null>(null);
    const [faceitProfile, setFaceitProfile] = useState<FaceitProfileSummary | null>(null);
    const [psnStats, setPsnStats] = useState<PsnVerificationResult | null>(null);
    const [steamLoading, setSteamLoading] = useState(false);
    const [faceitLoading, setFaceitLoading] = useState(false);
    const [psnLoading, setPsnLoading] = useState(false);

    // availability status
    const [steamStatus, setSteamStatus] = useState<"idle" | "available" | "taken">("idle");
    const [faceitStatus, setFaceitStatus] = useState<"idle" | "available" | "taken">("idle");
    const [psnStatus, setPsnStatus] = useState<"idle" | "available" | "taken">("idle");

    // Validation
    const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
    const [phoneStatus, setPhoneStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");

    // Memoized Password Validation
    const {
        hasUpper, hasLower, hasNumber, hasSpecial, isLengthValid,
        strengthLabel, strengthColor, strengthWidth
    } = useMemo(() => {
        const hasUpperRule = /[A-Z]/.test(password);
        const hasLowerRule = /[a-z]/.test(password);
        const hasNumberRule = /[0-9]/.test(password);
        const hasSpecialRule = /[^A-Za-z0-9]/.test(password);
        const lengthOkRule = password.length >= 8;

        const rulesMet = [hasUpperRule, hasLowerRule, hasNumberRule, hasSpecialRule, lengthOkRule].filter(Boolean).length;

        let strengthLbl: string | null = null;
        let strengthClr = COLORS.muted;
        let strengthPct = 0;

        if (password.length > 0) {
            if (rulesMet <= 2) {
                strengthLbl = "Weak";
                strengthClr = "#ef5350";
                strengthPct = 25;
            } else if (rulesMet === 3) {
                strengthLbl = "Fair";
                strengthClr = "#ffb74d";
                strengthPct = 50;
            } else if (rulesMet === 4) {
                strengthLbl = "Strong";
                strengthClr = COLORS.success;
                strengthPct = 75;
            } else {
                strengthLbl = "Very strong";
                strengthClr = COLORS.success;
                strengthPct = 100;
            }
        }

        return {
            hasUpper: hasUpperRule, hasLower: hasLowerRule, hasNumber: hasNumberRule, hasSpecial: hasSpecialRule, isLengthValid: lengthOkRule,
            strengthLabel: strengthLbl, strengthColor: strengthClr, strengthWidth: strengthPct
        };
    }, [password]);

    const isPasswordValid = hasUpper && hasLower && hasNumber && hasSpecial && isLengthValid;

    // Memoized Phone & Email Format Validation
    const { isPhoneFormatValid } = useMemo(() => {
        const phoneTrimmed = phone.trim();
        const normalizedPhone = phoneTrimmed.replace(/\s|-/g, "");
        const phoneRegex = /^(\+92|92|0)?3[0-9]{9}$/;
        const phoneFormatValid = phoneRegex.test(normalizedPhone);

        return { isPhoneFormatValid: phoneFormatValid };
    }, [phone]);

    // New email validation
    const isNewEmailValid = useMemo(() => {
        const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
        const trimmedNew = newEmail.trim();
        return emailRegex.test(trimmedNew) && trimmedNew !== email;
    }, [newEmail, email]);

    useEffect(() => {
        if (profileQuery === undefined) return;
        if (!profileQuery) {
            setLoading(false);
            return;
        }
        if (hydratedRef.current === profileQuery._id) {
            setLoading(false);
            return;
        }
        hydratedRef.current = profileQuery._id;

        const data: any = profileQuery;
        console.log("EditProfile loaded data:", JSON.stringify(data, null, 2));
        setFullName(data.fullName || "");
        setUsername(data.username || "");
        setOriginalUsername(data.username || "");
        setCity(data.city || "Karachi");
        setAgeRange(data.ageRange || "");
        setEmail(data.email || "");
        setOriginalEmail(data.email || "");
        setPhone(data.phone || "");
        setOriginalPhone(data.phone || "");
        setSelectedAreas(data.areasPreferred || []);

        // Load pending email if exists
        setPendingEmail(data.pendingEmail || "");

        setSteamProfileUrl(data.steamProfileUrl || "");
        setFaceitProfileUrl(data.faceitProfileUrl || "");
        setPsnOnlineId(data.psnOnlineId || "");

        setHideAreasPublicly(data.hideAreasPublicly || false);
        setHidePlatformsPublicly(data.hidePlatformsPublicly || false);
        setRestrictInvitesToFriends(data.restrictInvitesToFriends || false);

        // Hydrate verified profiles if available
        if (data.steamId) {
            setSteamProfile({
                steamId: data.steamId,
                personaName: data.steamPersonaName,
                cs2Hours: data.steamCs2Hours,
                stats: data.steamStats,
            } as SteamProfileSummary);
            setSteamStatus("available");
        }

        if (data.faceitId) {
            setFaceitProfile({
                faceitId: data.faceitId,
                nickname: data.faceitNickname,
                game: data.faceitGame,
                elo: data.faceitElo,
                skillLevel: data.faceitSkillLevel,
            } as FaceitProfileSummary);
            setFaceitStatus("available");
        }

        if (data.psnStats) {
            setPsnStats(data.psnStats);
            setPsnStatus("available");
        }

        setLoading(false);
    }, [profileQuery]);

    // Username check (unchanged)
    const handleUsernameBlur = async () => {
        const trimmed = username.trim();
        if (!trimmed || trimmed === originalUsername) {
            setUsernameStatus("idle");
            return;
        }
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
            setUsernameStatus("taken");
            return;
        }
        try {
            setUsernameStatus("checking");
            const available = await convex.query(api.users.isUsernameAvailable, {
                username: trimmed,
                excludeUid: user?.uid,
            });
            setUsernameStatus(available ? "available" : "taken");
        } catch {
            setUsernameStatus("idle");
        }
    };

    // Phone check (matching register.tsx)
    const handlePhoneBlur = async () => {
        const phoneTrimmed = phone.trim();
        const normalizedPhone = phoneTrimmed.replace(/\s|-/g, "");
        const phoneRegex = /^(\+92|92|0)?3[0-9]{9}$/;

        if (!normalizedPhone || !phoneRegex.test(normalizedPhone)) {
            setPhoneStatus("idle");
            return;
        }

        // Skip check if same as original
        const originalNormalized = originalPhone.replace(/\s|-/g, "");
        if (normalizedPhone === originalNormalized) {
            setPhoneStatus("idle");
            return;
        }

        try {
            setPhoneStatus("checking");
            const available = await convex.query(api.users.isPhoneAvailable, {
                phone: normalizedPhone,
                excludeUid: user?.uid,
            });
            setPhoneStatus(available ? "available" : "taken");
        } catch {
            setPhoneStatus("idle");
        }
    };

    // Area validation
    const toggleArea = (area: string) => {
        setSelectedAreas((prev) => {
            if (prev.includes(area)) return prev.filter(a => a !== area);
            if (prev.length >= 5) {
                showToast({ type: "warning", title: "Limit reached", message: "Max 5 areas." });
                return prev;
            }
            return [...prev, area];
        });
    };

    // --- API Verification Handlers ---
    const getErrorMessage = (error: any) => {
        if (!error) return "Unknown error";
        if (typeof error === "string") return error;
        if (error instanceof Error) return error.message;
        return String(error);
    };

    const handleSteamLookup = async () => {
        const url = steamProfileUrl.trim();
        if (!url) {
            showToast({ type: "info", title: "Steam profile", message: "Please paste your Steam profile link first." });
            return;
        }
        setSteamLoading(true);
        try {
            const res = await fetchSteamProfile({ profileUrl: url });
            if (!res.ok) {
                showToast({ type: "error", title: "Steam lookup failed", message: res.message || "Verification failed." });
                setSteamProfile(null);
                setSteamStatus("idle");
                return;
            }

            setSteamStatus("available");
            setSteamProfile(res.data);
            showToast({ type: "success", title: "Verified", message: `Steam profile found: ${res.data.personaName}` });
        } catch (e) {
            const message = getErrorMessage(e);
            setSteamStatus(message.toLowerCase().includes("already linked") ? "taken" : "idle");
            setSteamProfile(null);
            showToast({
                type: "error",
                title: "Steam lookup failed",
                message,
            });
        } finally {
            setSteamLoading(false);
        }
    };

    const handleFaceitLookup = async () => {
        const value = faceitProfileUrl.trim();
        if (!value) {
            showToast({ type: "info", title: "FACEIT profile", message: "Paste your FACEIT profile link or nickname." });
            return;
        }
        setFaceitLoading(true);
        try {
            const res = await fetchFaceitProfile({ value, game: "cs2" });
            if (!res.ok) {
                showToast({ type: "error", title: "FACEIT lookup failed", message: res.message || "Verification failed." });
                setFaceitProfile(null);
                setFaceitStatus("idle");
                return;
            }

            setFaceitStatus("available");
            setFaceitProfile(res.data);
            showToast({ type: "success", title: "Verified", message: `FACEIT profile found: ${res.data.nickname}` });
        } catch (e) {
            const message = getErrorMessage(e);
            setFaceitStatus(message.toLowerCase().includes("already linked") ? "taken" : "idle");
            setFaceitProfile(null);
            showToast({
                type: "error",
                title: "FACEIT lookup failed",
                message,
            });
        } finally {
            setFaceitLoading(false);
        }
    };

    const handlePsnLookup = async () => {
        const id = psnOnlineId.trim();
        if (!id) {
            showToast({ type: "info", title: "PSN ID", message: "Enter your PSN Online ID first." });
            return;
        }
        setPsnLoading(true);
        try {
            const res = await verifyPsnProfileAction({ psnOnlineId: id, wantsTekken: true, wantsFc: true });
            if (!res.ok) {
                showToast({ type: "error", title: "PSN lookup failed", message: res.message || "Verification failed." });
                setPsnStats(null);
                setPsnStatus("idle");
                return;
            }

            setPsnStatus("available");
            setPsnStats(res.data);
            showToast({ type: "success", title: "Verified", message: `PSN Found: ${res.data.psnOnlineId}` });
        } catch (e) {
            const message = getErrorMessage(e);
            setPsnStatus(message.toLowerCase().includes("already linked") ? "taken" : "idle");
            setPsnStats(null);
            showToast({
                type: "error",
                title: "PSN lookup failed",
                message,
            });
        } finally {
            setPsnLoading(false);
        }
    };

    const handleUpdatePassword = async () => {
        showToast({
            type: "info",
            title: "Coming soon",
            message: "Password changes are not available in v1.",
        });
    };

    // Email update handler
    const handleUpdateEmail = async () => {
        showToast({
            type: "info",
            title: "Coming soon",
            message: "Email changes are not available in v1.",
        });
    };

    const handleSave = async () => {
        if (!user?.uid) return;

        if (!fullName.trim()) {
            showToast({ type: "info", title: "Required", message: "Full Name is required" });
            return;
        }

        if (username.trim() !== originalUsername && usernameStatus === "taken") {
            showToast({ type: "error", title: "Invalid Username", message: "Username is taken or invalid" });
            return;
        }

        if (phone.trim() !== originalPhone && phoneStatus === "taken") {
            showToast({ type: "error", title: "Invalid Phone", message: "Phone is taken or invalid format (03...)" });
            return;
        }

        // Platform uniqueness check
        if (
            steamStatus === "taken" ||
            faceitStatus === "taken" ||
            psnStatus === "taken"
        ) {
            showToast({
                type: "error",
                title: "Link in use",
                message: "One or more of your profile links are already in use by another account.",
            });
            return;
        }

        if (selectedAreas.length === 0) {
            showToast({ type: "error", title: "Areas Required", message: "Select at least 1 area." });
            return;
        }

        // Password logic removed from Main Save

        setSaving(true);
        try {
            const profileRes = await updateProfile({
                fullName: fullName.trim(),
                displayName: fullName.trim(),
                username: username.trim() !== originalUsername ? username.trim() : undefined,
                city,
                ageRange,
                phone: phone.trim(),
                areasPreferred: selectedAreas,
                hideAreasPublicly,
                hidePlatformsPublicly,
                restrictInvitesToFriends,
            });

            if (!profileRes?.ok) {
                showToast({ type: "error", title: "Error", message: profileRes?.message || "Failed to save profile" });
                return;
            }

            const platformUpdates: any = {
                steamProfileUrl: steamProfileUrl.trim() || null,
                faceitProfileUrl: faceitProfileUrl.trim() || null,
                psnOnlineId: psnOnlineId.trim() || null,
            };

            if (steamProfile && steamProfileUrl.trim()) {
                platformUpdates.steamId = steamProfile.steamId ?? null;
                platformUpdates.steamPersonaName = steamProfile.personaName ?? null;
                platformUpdates.steamCs2Hours = steamProfile.cs2Hours ?? null;
                platformUpdates.steamStats = steamProfile.stats ?? null;
            } else if (!steamProfileUrl.trim()) {
                platformUpdates.steamId = null;
                platformUpdates.steamPersonaName = null;
                platformUpdates.steamCs2Hours = null;
                platformUpdates.steamTekken8Hours = null;
                platformUpdates.steamFc26Hours = null;
                platformUpdates.steamStats = null;
            }

            if (faceitProfile && faceitProfileUrl.trim()) {
                platformUpdates.faceitId = faceitProfile.faceitId ?? null;
                platformUpdates.faceitNickname = faceitProfile.nickname ?? null;
                platformUpdates.faceitGame = faceitProfile.game ?? null;
                platformUpdates.faceitElo = faceitProfile.elo ?? null;
                platformUpdates.faceitSkillLevel = faceitProfile.skillLevel ?? null;
            } else if (!faceitProfileUrl.trim()) {
                platformUpdates.faceitId = null;
                platformUpdates.faceitNickname = null;
                platformUpdates.faceitGame = null;
                platformUpdates.faceitElo = null;
                platformUpdates.faceitSkillLevel = null;
            }

            if (psnStats && psnOnlineId.trim()) {
                platformUpdates.psnStats = psnStats;
            } else if (!psnOnlineId.trim()) {
                platformUpdates.psnStats = null;
            }

            await updatePlatformLinks(platformUpdates);

            showToast({ type: "success", title: "Saved", message: "Profile updated successfully" });
            router.back();
        } catch (e: any) {
            console.error("Save failed", e);
            let msg = "Failed to save changes";
            if (typeof e?.message === "string" && e.message.length > 0) {
                msg = e.message;
            }
            showToast({ type: "error", title: "Error", message: msg });
        } finally {
            setSaving(false);
        }
    };

    const isSteamVerified = !!steamProfile;
    const isFaceitVerified = !!faceitProfile;
    const isPsnVerified = !!psnStats;

    // Helper for FACEIT icon
    const faceitLevelIcon = faceitProfile?.skillLevel && faceitLevelIcons[faceitProfile.skillLevel];


    if (loading) {
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
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Profile</Text>

                <Pressable
                    style={({ pressed }) => [
                        styles.saveButton,
                        saving && styles.saveButtonDisabled,
                        pressed && !saving && styles.saveButtonPressed,
                    ]}
                    onPressIn={() => {
                        if (touchDebugEnabled) {
                            Logger.debug("TouchDebug", "pressIn", { tag: "profile_edit_save" });
                        }
                    }}
                    onPress={handleSave}
                    disabled={saving}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
                </Pressable>
            </View>

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

                    {/* Full Name */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Full Name</Text>
                        <View style={styles.inputBox}>
                            <TextInput
                                value={fullName}
                                onChangeText={setFullName}
                                style={styles.input}
                                placeholder="Enter full name"
                                placeholderTextColor={COLORS.muted}
                            />
                        </View>
                    </View>

                    {/* Username - Read Only */}
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

                    {/* City & Age */}
                    <View style={styles.marginBottomLg}>
                        <CustomSingleSelect
                            label="City"
                            value={city}
                            options={CITY_OPTIONS}
                            onChange={setCity}
                            icon="location-city"
                        />
                    </View>

                    <CustomSingleSelect
                        label="Age Range"
                        value={ageRange}
                        options={AGE_RANGES}
                        onChange={setAgeRange}
                        icon="cake"
                    />

                    {/* Email */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Email Address</Text>
                        <View style={[styles.inputBox, styles.disabledInput]}>
                            <View style={styles.flexRowCentered}>
                                <MaterialIcons
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
                            </View>
                        </View>

                        {/* Pending Email Status */}
                        {pendingEmail && (
                            <View style={styles.pendingEmailContainer}>
                                <View style={styles.pendingEmailHeader}>
                                    <MaterialIcons name="pending" size={18} color={COLORS.warning} />
                                    <Text style={styles.pendingEmailTitle}>
                                        Pending Verification
                                    </Text>
                                </View>
                                <Text style={styles.pendingEmailText}>
                                    {pendingEmail}
                                </Text>
                            </View>
                        )}

                        {!isEmailChanging ? (
                            <Pressable
                                onPress={() => setIsEmailChanging(true)}
                                style={styles.marginTopSm}
                            >
                                <View style={styles.platformButton}>
                                    <Text style={styles.platformButtonText}>Change Email</Text>
                                </View>
                            </Pressable>
                        ) : (
                            <View style={styles.gapMd}>
                                {/* New Email Input */}
                                <View style={styles.inputBox}>
                                    <View style={styles.flexRowCentered}>
                                        <MaterialIcons
                                            name="email"
                                            size={20}
                                            style={styles.iconMarginRight}
                                            color={
                                                isNewEmailValid && newEmail.trim().length > 0
                                                    ? COLORS.accent
                                                    : COLORS.muted
                                            }
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

                                {newEmail.trim().length > 0 && !isNewEmailValid && (
                                    <Text style={[styles.helperText, styles.helperError]}>
                                        {newEmail.trim() === email ? "New email must be different from current" : "Enter a valid email address"}
                                    </Text>
                                )}

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

                    {/* Phone */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Phone Number</Text>
                        <View style={styles.inputBox}>
                            <View style={styles.flexRowCentered}>
                                <MaterialIcons
                                    name="phone-android"
                                    size={20}
                                    style={styles.iconMarginRight}
                                    color={
                                        isPhoneFormatValid && phone.trim().length > 0
                                            ? COLORS.accent
                                            : COLORS.muted
                                    }
                                />
                                <TextInput
                                    value={phone}
                                    onChangeText={(value) => {
                                        let next = value;
                                        if (/^[\d+\s-]*$/.test(value)) {
                                            next = formatPakistaniPhone(value);
                                        }
                                        setPhone(next);
                                        if (phoneStatus !== 'idle') setPhoneStatus('idle');
                                    }}
                                    onBlur={handlePhoneBlur}
                                    style={styles.inputWithIcon}
                                    placeholder="03XX XXX XXXX"
                                    placeholderTextColor={COLORS.muted}
                                    keyboardType="phone-pad"
                                />
                                {phone.trim().length > 0 && (
                                    <MaterialIcons
                                        name={
                                            phoneStatus === "checking"
                                                ? "hourglass-top"
                                                : phoneStatus === "available"
                                                    ? "check-circle"
                                                    : phoneStatus === "taken"
                                                        ? "error-outline"
                                                        : "check-circle"
                                        }
                                        size={18}
                                        style={styles.marginLeftSm}
                                        color={
                                            phoneStatus === "taken"
                                                ? COLORS.error
                                                : phoneStatus === "available"
                                                    ? COLORS.success
                                                    : COLORS.muted
                                        }
                                    />
                                )}
                            </View>
                        </View>
                        {phoneStatus === "checking" && (
                            <Text style={[styles.helperText, styles.helperWarning]}>Checking number…</Text>
                        )}
                        {phoneStatus === "available" && (
                            <Text style={[styles.helperText, styles.helperOk]}>Looks good! Number is available.</Text>
                        )}
                        {phoneStatus === "taken" && (
                            <Text style={[styles.helperText, styles.helperError]}>This phone number is already in use.</Text>
                        )}
                    </View>

                    {/* Password Section */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Password</Text>

                        {!isPasswordChanging ? (
                            <Pressable
                                onPress={() => setIsPasswordChanging(true)}
                                style={styles.marginTopNone}
                            >
                                <View style={styles.platformButton}>
                                    <Text style={styles.platformButtonText}>Change Password</Text>
                                </View>
                            </Pressable>
                        ) : (
                            <View style={styles.gapMd}>
                                {/* Current */}
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
                                        <MaterialIcons name={currentPasswordVisible ? "visibility" : "visibility-off"} size={20} color={COLORS.muted} />
                                    </Pressable>
                                </View>

                                {/* New */}
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
                                        <MaterialIcons name={passwordVisible ? "visibility" : "visibility-off"} size={20} color={COLORS.muted} />
                                    </Pressable>
                                </View>

                                {/* Strength Meter */}
                                {password.length > 0 && (
                                    <View style={styles.passwordStrengthWrapper}>
                                        <View style={styles.strengthMeterTrack}>
                                            <View style={[styles.strengthMeterFill, { width: `${strengthWidth}%`, backgroundColor: strengthColor }]} />
                                        </View>
                                        <Text style={[styles.strengthLabel, { color: strengthColor }]}>Strength: {strengthLabel}</Text>
                                    </View>
                                )}

                                {/* Requirements */}
                                {password.length > 0 && !isPasswordValid && (
                                    <View style={styles.passwordRequirementsRow}>
                                        <View style={styles.requirementColumn}>
                                            <Text style={[styles.passwordRequirementText, hasUpper && styles.passwordRequirementTextDone]}>
                                                {hasUpper ? "✓" : "×"} Upper case
                                            </Text>
                                            <Text style={[styles.passwordRequirementText, hasLower && styles.passwordRequirementTextDone]}>
                                                {hasLower ? "✓" : "×"} Lower case
                                            </Text>
                                        </View>
                                        <View style={styles.requirementColumn}>
                                            <Text style={[styles.passwordRequirementText, hasNumber && styles.passwordRequirementTextDone]}>
                                                {hasNumber ? "✓" : "×"} Number
                                            </Text>
                                            <Text style={[styles.passwordRequirementText, hasSpecial && styles.passwordRequirementTextDone]}>
                                                {hasSpecial ? "✓" : "×"} Special
                                            </Text>
                                            <Text style={[styles.passwordRequirementText, isLengthValid && styles.passwordRequirementTextDone]}>
                                                {isLengthValid ? "✓" : "×"} Min 8 chars
                                            </Text>
                                        </View>
                                    </View>
                                )}

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

                    {/* Preferred Areas */}
                    <View style={styles.fieldGroup}>
                        <View style={styles.preferredAreasHeader}>
                            <Text style={styles.labelNoMargin}>Preferred Areas</Text>
                            <Text style={[
                                styles.selectedCountText,
                                selectedAreas.length >= 5 && styles.warningText
                            ]}>
                                {selectedAreas.length}/5 Selected
                            </Text>
                        </View>
                        <View style={styles.flexWrapRow}>
                            {KARACHI_AREAS.map(area => {
                                const selected = selectedAreas.includes(area);
                                return (
                                    <Pressable
                                        key={area}
                                        onPress={() => toggleArea(area)}
                                        style={[styles.areaChip, selected && styles.areaChipActive]}
                                    >
                                        <Text style={[styles.areaChipText, selected && styles.areaChipTextActive]}>
                                            {area}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                        {selectedAreas.length === 0 && (
                            <Text style={[styles.helperText, styles.helperError]}>Select at least one area.</Text>
                        )}
                    </View>

                    {/* Privacy Settings */}
                    <Text style={styles.sectionTitle}>Privacy Settings (Beta)</Text>
                    <View style={styles.privacySection}>
                        <View style={styles.toggleRow}>
                            <View style={styles.toggleInfo}>
                                <Text style={styles.toggleLabel}>Hide Areas Publicly</Text>
                                <Text style={styles.toggleSubtext}>Keep your preferred gaming zones private from others.</Text>
                            </View>
                            <Switch
                                value={hideAreasPublicly}
                                onValueChange={setHideAreasPublicly}
                                trackColor={{ false: COLORS.divider, true: COLORS.accent }}
                                thumbColor="#FFF"
                            />
                        </View>

                        <View style={styles.toggleRow}>
                            <View style={styles.toggleInfo}>
                                <Text style={styles.toggleLabel}>Hide Platform Usernames</Text>
                                <Text style={styles.toggleSubtext}>Linked platforms will show as "Verified" but hide your IDs.</Text>
                            </View>
                            <Switch
                                value={hidePlatformsPublicly}
                                onValueChange={setHidePlatformsPublicly}
                                trackColor={{ false: COLORS.divider, true: COLORS.accent }}
                                thumbColor="#FFF"
                            />
                        </View>

                        <View style={[styles.toggleRow, styles.borderBottomNone]}>
                            <View style={styles.toggleInfo}>
                                <Text style={styles.toggleLabel}>Restrict Match Invites</Text>
                                <Text style={styles.toggleSubtext}>Only allow friends to send you matchroom invitations.</Text>
                            </View>
                            <Switch
                                value={restrictInvitesToFriends}
                                onValueChange={setRestrictInvitesToFriends}
                                trackColor={{ false: COLORS.divider, true: COLORS.accent }}
                                thumbColor="#FFF"
                            />
                        </View>
                    </View>

                    <Text style={styles.sectionTitle}>Linked Platforms</Text>
                    <Text style={[styles.label, { marginBottom: 16 }]}>
                        Verify your profiles to start playing.
                    </Text>

                    {/* Steam */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Steam Profile URL</Text>
                        <View style={styles.platformInputRow}>
                            <View style={[styles.platformIcon, styles.steamIcon]}>
                                <MaterialIcons name="sports-esports" size={24} color={COLORS.steamBorder} />
                            </View>
                            <View style={styles.platformField}>
                                <View style={styles.inputBox}>
                                    <TextInput
                                        value={steamProfileUrl}
                                        onChangeText={(t) => {
                                            setSteamProfileUrl(t);
                                            // Reset verified state if changed significantly (optional, but safer)
                                            if (steamProfile && t !== '') setSteamProfile(null);
                                            setSteamStatus("idle");
                                        }}
                                        style={[styles.input, { fontSize: 13 }]}
                                        placeholder="https://steamcommunity.com/id/..."
                                        placeholderTextColor={COLORS.muted}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                </View>
                            </View>
                        </View>

                        <Pressable
                            onPress={handleSteamLookup}
                            disabled={steamLoading || !steamProfileUrl.trim()}
                            style={({ pressed }) => [
                                styles.platformButton,
                                isSteamVerified && { backgroundColor: "#1DB954", borderColor: "#1DB954" },
                                pressed && !steamLoading && { opacity: 0.9 },
                            ]}
                        >
                            <Text style={styles.platformButtonText}>
                                {steamLoading ? "Checking..." : isSteamVerified ? "Steam Verified" : "Verify Steam Profile"}
                            </Text>
                        </Pressable>

                        {steamProfile && (
                            <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
                                <Text style={styles.summaryLabel}>Verified Account</Text>
                                <Text style={[styles.summaryValue, { color: COLORS.accent, fontWeight: "600" }]}>
                                    {steamProfile.personaName}
                                    {steamProfile.cs2Hours ? ` · ~${Math.round(steamProfile.cs2Hours)}h CS2` : ""}
                                </Text>
                            </View>
                        )}
                        {steamStatus === "taken" && (
                            <Text style={[styles.helperText, styles.helperError]}>This link is already in use.</Text>
                        )}
                    </View>

                    {/* Faceit */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>FACEIT Profile URL</Text>
                        <View style={styles.platformInputRow}>
                            <View style={[styles.platformIcon, styles.faceitIcon]}>
                                <MaterialIcons name="verified" size={24} color={COLORS.faceitBorder} />
                            </View>
                            <View style={styles.platformField}>
                                <View style={styles.inputBox}>
                                    <TextInput
                                        value={faceitProfileUrl}
                                        onChangeText={(t) => {
                                            setFaceitProfileUrl(t);
                                            if (faceitProfile && t !== '') setFaceitProfile(null);
                                            setFaceitStatus("idle");
                                        }}
                                        style={[styles.input, { fontSize: 13 }]}
                                        placeholder="https://www.faceit.com/en/players/..."
                                        placeholderTextColor={COLORS.muted}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                </View>
                            </View>
                        </View>

                        <Pressable
                            onPress={handleFaceitLookup}
                            disabled={faceitLoading || !faceitProfileUrl.trim()}
                            style={({ pressed }) => [
                                styles.platformButton,
                                isFaceitVerified && { backgroundColor: "#1DB954", borderColor: "#1DB954" },
                                pressed && !faceitLoading && { opacity: 0.9 },
                            ]}
                        >
                            <Text style={styles.platformButtonText}>
                                {faceitLoading ? "Checking..." : isFaceitVerified ? "FACEIT Verified" : "Verify FACEIT Profile"}
                            </Text>
                        </Pressable>

                        {faceitProfile && (
                            <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
                                <Text style={styles.summaryLabel}>Verified Account</Text>
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <Text style={[styles.summaryValue, { color: COLORS.accent, fontWeight: "600" }]}>
                                        {faceitProfile.nickname}
                                    </Text>
                                    <View style={{ width: 8 }} />
                                    {faceitProfile.elo != null && (
                                        <Text style={styles.summaryValue}>ELO {faceitProfile.elo}</Text>
                                    )}
                                    {faceitProfile.skillLevel != null && (
                                        <View style={{ marginLeft: 8, flexDirection: "row", alignItems: "center" }}>
                                            {faceitLevelIcon ? (
                                                <Image source={faceitLevelIcon} style={{ width: 20, height: 20 }} resizeMode="contain" />
                                            ) : (
                                                <Text style={styles.summaryValue}>Lvl {faceitProfile.skillLevel}</Text>
                                            )}
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                        {faceitStatus === "taken" && (
                            <Text style={[styles.helperText, styles.helperError]}>This link is already in use.</Text>
                        )}
                    </View>

                    {/* PSN */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>PSN Online ID</Text>
                        <View style={styles.platformInputRow}>
                            <View style={[styles.platformIcon, styles.faceitIcon, { borderColor: '#003087', backgroundColor: '#eef2ff' }]}>
                                <MaterialIcons name="sports-esports" size={24} color="#003791" />
                            </View>
                            <View style={styles.platformField}>
                                <View style={styles.inputBox}>
                                    <TextInput
                                        value={psnOnlineId}
                                        onChangeText={(t) => {
                                            setPsnOnlineId(t);
                                            if (psnStats && t !== psnStats.psnOnlineId) setPsnStats(null);
                                            setPsnStatus("idle");
                                        }}
                                        style={[styles.input, { fontSize: 13 }]}
                                        placeholder="MyPsnId_123"
                                        placeholderTextColor={COLORS.muted}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                </View>
                            </View>
                        </View>

                        <Pressable
                            onPress={handlePsnLookup}
                            disabled={psnLoading || !psnOnlineId.trim()}
                            style={({ pressed }) => [
                                styles.platformButton,
                                isPsnVerified && { backgroundColor: "#1DB954", borderColor: "#1DB954" },
                                pressed && !psnLoading && { opacity: 0.9 },
                            ]}
                        >
                            <Text style={styles.platformButtonText}>
                                {psnLoading ? "Checking..." : isPsnVerified ? "PSN Verified" : "Verify PSN ID"}
                            </Text>
                        </Pressable>

                        {psnStats && (
                            <View style={styles.verifiedSummaryContainer}>
                                <Text style={styles.summaryLabel}>Verified Account</Text>
                                <View style={styles.flexColumn}>
                                    <Text style={[styles.summaryValue, styles.accentBoldText]}>
                                        {psnStats.psnOnlineId}
                                    </Text>
                                    <Text style={styles.psnSubValue}>
                                        Level {psnStats.trophyLevel} · {psnStats.totalTrophies?.platinum ?? 0} Platinums
                                    </Text>
                                </View>
                            </View>
                        )}
                        {psnStatus === "taken" && (
                            <Text style={[styles.helperText, styles.helperError]}>This link is already in use.</Text>
                        )}
                    </View>

                    <View style={{ height: 40 }} />

                </ScrollView>
            </KeyboardAvoidingView>

            {saving && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            )}
        </SafeAreaView>
    );
}
