import { router, useLocalSearchParams } from "expo-router";
// Auth operations handled via Better Auth
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    LayoutChangeEvent,
    Platform,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TextInput,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AGE_RANGES, CITY_OPTIONS, KARACHI_AREAS } from "../../../constants/profileOptions";
import AppHeader from "../../../src/components/AppHeader";
import { AppIcon } from "../../../src/components/AppIcon";
import { AppImage } from "../../../src/components/AppImage";
import { CustomSingleSelect } from "../../../src/components/CustomSingleSelect";
import { authClient } from "../../../src/lib/auth-client";
import { convex } from "../../../src/lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useAuth } from "../../../src/context/AuthContext";
import { useSessionRefreshPolling } from "../../../src/hooks/useSessionRefreshPolling";
import { useToast } from "../../../src/hooks/useToast";
import {
    FaceitProfileSummary,
    fetchFaceitProfileFromUrl,
    PsnVerificationResult,
    SteamProfileSummary,
    fetchSteamProfileFromUrl,
    verifyPsnProfile,
} from "../../../src/services/convex/externalApiService";
import Logger from "../../../src/utils/logger";
import {
    isFaceitIdAvailable,
    isPhoneAvailable,
    isPsnIdAvailable,
    isSteamIdAvailable,
    isUsernameAvailable,
} from "../../../src/services/userService";
import { COLORS } from "../../../src/theme";
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

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => reject(new Error(message)), timeoutMs);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
};

export default function EditProfile() {
    const { user, authUser, refreshSession, refreshUser } = useAuth();
    const params = useLocalSearchParams<{ focus?: string }>();
    const { showToast } = useToast();
    const touchDebugEnabled = __DEV__ && process.env.EXPO_PUBLIC_TOUCH_DEBUG === '1';
    const scrollRef = useRef<ScrollView | null>(null);
    const [preferredAreasSectionY, setPreferredAreasSectionY] = useState(0);

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
    const [phoneVerified, setPhoneVerified] = useState(false);

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
    const { isPhoneFormatValid, isEmailValid } = useMemo(() => {
        const phoneTrimmed = phone.trim();
        const normalizedPhone = phoneTrimmed.replace(/\s|-/g, "");
        const phoneRegex = /^(\+92|92|0)?3[0-9]{9}$/;
        const phoneFormatValid = phoneRegex.test(normalizedPhone);

        const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
        const emailValid = emailRegex.test(email.trim());

        return { isPhoneFormatValid: phoneFormatValid, isEmailValid: emailValid };
    }, [phone, email]);

    // New email validation
    const isNewEmailValid = useMemo(() => {
        const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
        const trimmedNew = newEmail.trim();
        return emailRegex.test(trimmedNew) && trimmedNew !== email;
    }, [newEmail, email]);

    const isEmailVerified = Boolean(authUser?.emailVerified) && !pendingEmail;

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user?._id) return;
            try {
                const data = await convex.query(api.users.getById, { userId: user._id as Id<"users"> });
                if (data) {
                    console.log("EditProfile loaded data:", JSON.stringify(data, null, 2));
                    setFullName((data as any).fullName || "");
                    setUsername((data as any).username || "");
                    setOriginalUsername((data as any).username || "");
                    setCity((data as any).city || "Karachi");
                    setAgeRange((data as any).ageRange || "");
                    // Store full email as-is
                    const session = await authClient.getSession();
                    const userEmail = session?.data?.user?.email || (data as any).email || "";
                    setEmail(userEmail);
                    setOriginalEmail(userEmail);
                    setPhone((data as any).phone || "");
                    setOriginalPhone((data as any).phone || "");
                    setPhoneVerified(Boolean((data as any).phoneValidated));
                    setSelectedAreas((data as any).areasPreferred || []);

                    // Load pending email if exists
                    setPendingEmail((data as any).pendingEmail || "");

                    setSteamProfileUrl((data as any).steamProfileUrl || "");
                    setFaceitProfileUrl((data as any).faceitProfileUrl || "");
                    setPsnOnlineId((data as any).psnOnlineId || "");

                    setHideAreasPublicly((data as any).hideAreasPublicly || false);
                    setHidePlatformsPublicly((data as any).hidePlatformsPublicly || false);
                    setRestrictInvitesToFriends((data as any).restrictInvitesToFriends || false);

                    // Hydrate verified profiles if available
                    if ((data as any).steamId) {
                        setSteamProfile({
                            steamId: (data as any).steamId,
                            personaName: (data as any).steamPersonaName,
                            cs2Hours: (data as any).steamCs2Hours,
                        } as SteamProfileSummary);
                        setSteamStatus("available");
                    }

                    if ((data as any).faceitId) {
                        setFaceitProfile({
                            faceitId: (data as any).faceitId,
                            nickname: (data as any).faceitNickname,
                            game: (data as any).faceitGame,
                            elo: (data as any).faceitElo,
                            skillLevel: (data as any).faceitSkillLevel,
                        } as FaceitProfileSummary);
                        setFaceitStatus("available");
                    }

                    if ((data as any).psnStats) {
                        setPsnStats((data as any).psnStats);
                        setPsnStatus("available");
                    }
                }
            } catch (e) {
                console.error("Failed to load profile", e);
                showToast({ type: "error", title: "Error", message: "Failed to load profile" });
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [user?._id]);

    useEffect(() => {
        if (loading || params.focus !== "areas" || preferredAreasSectionY <= 0) return;

        const frame = requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({
                y: Math.max(0, preferredAreasSectionY - 80),
                animated: true,
            });
        });

        return () => cancelAnimationFrame(frame);
    }, [loading, params.focus, preferredAreasSectionY]);

    useSessionRefreshPolling({
        enabled: Boolean(user?._id && pendingEmail),
        refreshSession,
    });

    // Auto-refresh auth state to check for email verification
    useEffect(() => {
        if (!user?._id || !pendingEmail) return;

        const checkEmailUpdate = async () => {
            try {
                const session = await authClient.getSession();
                if (!session?.data?.user) return;

                const currentEmail = session.data.user.email || "";
                if (currentEmail === pendingEmail) {
                    await convex.mutation(api.users.updateFullProfile, {
                        userId: user._id as Id<"users">,
                        updates: { pendingEmail: null },
                    });

                    setEmail(currentEmail);
                    setOriginalEmail(currentEmail);
                    setPendingEmail("");
                    await refreshUser();

                    showToast({
                        type: "success",
                        title: "Email Updated",
                        message: "Your email has been successfully updated."
                    });
                }
            } catch (e: any) {
                if (e?.code === 'auth/user-token-expired' || e?.code === 'auth/requires-recent-login') {
                    setPendingEmail("");
                    showToast({
                        type: "info",
                        title: "Email Verified",
                        message: "Your email was updated. Please log out and log back in to continue."
                    });
                    return;
                }
                console.error("Error checking email update:", e);
            }
        };

        void checkEmailUpdate();
    }, [pendingEmail, refreshUser, showToast, user?._id]);


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
            const available = await isUsernameAvailable(trimmed);
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
            const available = await isPhoneAvailable(normalizedPhone);
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

    const handleSteamLookup = async () => {
        const url = steamProfileUrl.trim();
        if (!url) {
            showToast({ type: "info", title: "Steam profile", message: "Please paste your Steam profile link first." });
            return;
        }
        setSteamLoading(true);
        try {
            const res = await fetchSteamProfileFromUrl(url);

            if (!res.ok) {
                showToast({ type: "error", title: "Steam lookup failed", message: res.message || "Verification failed." });
                setSteamProfile(null);
                setSteamStatus("idle");
                return;
            }

            const available = await isSteamIdAvailable(res.data.steamId, user?._id);
            if (!available) {
                setSteamStatus("taken");
                setSteamProfile(null);
                showToast({
                    type: "error",
                    title: "Link in use",
                    message: "This link is already in use.",
                });
                return;
            }

            setSteamStatus("available");
            setSteamProfile(res.data);
            showToast({ type: "success", title: "Verified", message: `Steam profile found: ${res.data.personaName}` });
        } catch (e: any) {
            console.error("Steam lookup failed", e);
            setSteamProfile(null);
            setSteamStatus("idle");
            showToast({ type: "error", title: "Steam lookup failed", message: e?.message || "Verification failed." });
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
            const res = await fetchFaceitProfileFromUrl(value);

            if (!res.ok) {
                showToast({ type: "error", title: "FACEIT lookup failed", message: res.message || "Verification failed." });
                setFaceitProfile(null);
                setFaceitStatus("idle");
                return;
            }

            const available = await withTimeout(
                isFaceitIdAvailable(res.data.faceitId, user?._id),
                10000,
                "FACEIT uniqueness check timed out."
            );
            if (!available) {
                setFaceitStatus("taken");
                setFaceitProfile(null);
                showToast({
                    type: "error",
                    title: "Link in use",
                    message: "This link is already in use.",
                });
                return;
            }

            setFaceitStatus("available");
            setFaceitProfile(res.data);
            showToast({ type: "success", title: "Verified", message: `FACEIT profile found: ${res.data.nickname}` });
        } catch (e: any) {
            console.error("FACEIT lookup failed", e);
            setFaceitProfile(null);
            setFaceitStatus("idle");
            showToast({ type: "error", title: "FACEIT lookup failed", message: e?.message || "Verification failed." });
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
            const res = await verifyPsnProfile(id, true, true);

            if (!res.ok) {
                showToast({ type: "error", title: "PSN lookup failed", message: res.message || "Verification failed." });
                setPsnStats(null);
                setPsnStatus("idle");
                return;
            }

            const available = await isPsnIdAvailable(res.data.psnAccountId, user?._id);
            if (!available) {
                setPsnStatus("taken");
                setPsnStats(null);
                showToast({
                    type: "error",
                    title: "Link in use",
                    message: "This link is already in use.",
                });
                return;
            }

            setPsnStatus("available");
            setPsnStats(res.data);
            showToast({ type: "success", title: "Verified", message: `PSN Found: ${res.data.psnOnlineId}` });
        } catch (e: any) {
            console.error("PSN lookup failed", e);
            setPsnStats(null);
            setPsnStatus("idle");
            showToast({ type: "error", title: "PSN lookup failed", message: e?.message || "Verification failed." });
        } finally {
            setPsnLoading(false);
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

        setPasswordUpdating(true);
        try {
            // Use Better Auth to change password
            const result = await (authClient as any).changePassword({
                currentPassword,
                newPassword: password,
            });

            if (result?.error) {
                throw result.error;
            }

            showToast({ type: "success", title: "Success", message: "Password updated successfully." });

            // Clean up
            setCurrentPassword("");
            setPassword("");
            setIsPasswordChanging(false);
        } catch (e: any) {
            console.error("Password update failed", e);
            let msg = "Failed to update password.";
            if (e.message?.includes("incorrect") || e.message?.includes("wrong")) msg = "Current password is incorrect.";
            if (e.message?.includes("recent") || e.message?.includes("session")) msg = "Session too old. Please re-login.";
            showToast({ type: "error", title: "Error", message: msg });
        } finally {
            setPasswordUpdating(false);
        }
    };

    // Email update handler
    const handleUpdateEmail = async () => {
        if (!isNewEmailValid || !user?._id) return;

        try {
            setEmailUpdating(true);
            // Use Better Auth to change email
            const result = await (authClient as any).changeEmail({
                newEmail: newEmail.trim(),
            });
            if (result?.error) throw result.error;

            // Store pending email in Convex
            await convex.mutation(api.users.updateFullProfile, {
                userId: user._id as Id<"users">,
                updates: { pendingEmail: newEmail.trim() },
            });

            // Update local state
            setPendingEmail(newEmail.trim());

            showToast({
                type: "success",
                title: "Verification Sent",
                message: "Check your new email for the verification link. Click it to complete the change."
            });

            setIsEmailChanging(false);
            setNewEmail("");
        } catch (e: any) {
            console.error("Email update failed", e);
            let msg = "Failed to send verification email";
            if (e.code === 'auth/invalid-email') msg = "Invalid email format.";
            if (e.code === 'auth/email-already-in-use') msg = "This email is already in use.";
            if (e.code === 'auth/requires-recent-login') msg = "Please re-login to change your email.";
            showToast({ type: "error", title: "Error", message: msg });
        } finally {
            setEmailUpdating(false);
        }
    };

    const handleSave = async () => {
        if (!user?._id) return;

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

        // Email validation if changed
        const localPart = email.trim();
        const fullEmail = localPart.length > 0 ? `${localPart}@gmail.com` : "";
        if (fullEmail !== originalEmail) {
            if (!fullEmail.includes("@gmail.com")) {
                showToast({ type: "error", title: "Invalid Email", message: "Only @gmail.com addresses allowed." });
                return;
            }
        }

        if (selectedAreas.length === 0) {
            showToast({ type: "error", title: "Areas Required", message: "Select at least 1 area." });
            return;
        }

        // Password logic removed from Main Save

        setSaving(true);
        try {
            const updates: any = {
                fullName: fullName.trim(),
                city,
                ageRange,
                phone: phone.trim(),
                areasPreferred: selectedAreas,
                steamProfileUrl: steamProfileUrl.trim() || null,
                faceitProfileUrl: faceitProfileUrl.trim() || null,
                psnOnlineId: psnOnlineId.trim() || null,
                hideAreasPublicly,
                hidePlatformsPublicly,
                restrictInvitesToFriends,
                updatedAt: Date.now(),
            };

            // Username update
            if (username.trim() !== originalUsername) {
                updates.username = username.trim();
                updates.usernameLower = username.trim().toLowerCase();
            }

            // Persist Verified Steam Profile
            if (steamProfile && steamProfileUrl.trim()) {
                updates.steamId = steamProfile.steamId ?? null;
                updates.steamPersonaName = steamProfile.personaName ?? null;
                updates.steamCs2Hours = steamProfile.cs2Hours ?? null;
                updates.steamStats = steamProfile;
                // Note: steamTekken8Hours and steamFc26Hours come from Steam API separately
            } else if (!steamProfileUrl.trim()) {
                // Clear ALL Steam data if URL is cleared
                updates.steamId = null;
                updates.steamPersonaName = null;
                updates.steamCs2Hours = null;
                updates.steamTekken8Hours = null;
                updates.steamFc26Hours = null;
                updates.steamStats = null;
            }

            // Persist Verified FACEIT Profile
            if (faceitProfile && faceitProfileUrl.trim()) {
                updates.faceitId = faceitProfile.faceitId ?? null;
                updates.faceitNickname = faceitProfile.nickname ?? null;
                updates.faceitGame = faceitProfile.game ?? null;
                updates.faceitElo = faceitProfile.elo ?? null;
                updates.faceitSkillLevel = faceitProfile.skillLevel ?? null;
                updates.faceitStats = faceitProfile;
            } else if (!faceitProfileUrl.trim()) {
                // Clear ALL FACEIT data if URL is cleared
                updates.faceitId = null;
                updates.faceitNickname = null;
                updates.faceitGame = null;
                updates.faceitElo = null;
                updates.faceitSkillLevel = null;
                updates.faceitStats = null;
            }

            // Persist Verified PSN Stats
            if (psnStats && psnOnlineId.trim()) {
                updates.psnAccountId = psnStats.psnAccountId ?? null;
                updates.psnStats = psnStats;
            } else if (!psnOnlineId.trim()) {
                // Clear ALL PSN data if ID is cleared
                updates.psnAccountId = null;
                updates.psnStats = null;
            }

            // Auth Updates - Email is read-only, no updates needed

            await convex.mutation(api.users.updateFullProfile, {
                userId: user._id as Id<"users">,
                updates,
            });
            await refreshUser();

            showToast({ type: "success", title: "Saved", message: "Profile updated successfully" });
            router.back();
        } catch (e: any) {
            console.error("Save failed", e);
            let msg = "Failed to save changes";
            if (e.code === 'auth/requires-recent-login') msg = "Please re-login to change sensitive data.";
            if (e.code === 'auth/wrong-password') msg = "Current password is incorrect.";
            if (e.code === 'auth/operation-not-allowed') msg = "Email change requires verification. Please contact support or use the current email.";
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
                }
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.flex1}
            >
                <ScrollView
                    ref={scrollRef}
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

                        {/* Pending Email Status */}
                        {pendingEmail && (
                            <View style={styles.pendingEmailContainer}>
                                <View style={styles.pendingEmailHeader}>
                                    <AppIcon name="pending" size={18} color={COLORS.warning} />
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
                                        <AppIcon
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
                                <AppIcon
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
                                        <AppIcon name={currentPasswordVisible ? "visibility" : "visibility-off"} size={20} color={COLORS.muted} />
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
                                        <AppIcon name={passwordVisible ? "visibility" : "visibility-off"} size={20} color={COLORS.muted} />
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
                    <View
                        style={styles.fieldGroup}
                        onLayout={(event: LayoutChangeEvent) => {
                            setPreferredAreasSectionY(event.nativeEvent.layout.y);
                        }}
                    >
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
                                <AppIcon name="sports-esports" size={24} color={COLORS.steamBorder} />
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
                                <AppIcon name="verified" size={24} color={COLORS.faceitBorder} />
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
                                                <AppImage
                                                    source={faceitLevelIcon}
                                                    containerStyle={{ width: 20, height: 20 }}
                                                    contentFit="contain"
                                                />
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
                                <AppIcon name="sports-esports" size={24} color="#003791" />
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
