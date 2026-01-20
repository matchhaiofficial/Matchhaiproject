import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { EmailAuthProvider, reauthenticateWithCredential, reload, updatePassword, verifyBeforeUpdateEmail } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
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
import { auth, db } from "../../../src/config/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";
import { useToast } from "../../../src/hooks/useToast";
import { FaceitProfileSummary, fetchFaceitProfileFromUrl } from "../../../src/services/faceitApi";
import { PsnVerificationResult, verifyPsnProfile } from "../../../src/services/psnApi";
import { fetchSteamProfileFromUrl, SteamProfileSummary } from "../../../src/services/steamApi";
import {
    isEaIdAvailable,
    isFaceitIdAvailable,
    isPhoneAvailable,
    isPsnIdAvailable,
    isSteamIdAvailable,
    isUsernameAvailable,
    isXboxIdAvailable,
} from "../../../src/services/userService";
import { COLORS, INPUT_PADDING } from "../../../src/theme";
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
    const [eaProfileUrl, setEaProfileUrl] = useState("");
    const [xboxGamertag, setXboxGamertag] = useState("");

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
    const [eaLoading, setEaLoading] = useState(false);
    const [xboxLoading, setXboxLoading] = useState(false);

    // availability status
    const [steamStatus, setSteamStatus] = useState<"idle" | "available" | "taken">("idle");
    const [faceitStatus, setFaceitStatus] = useState<"idle" | "available" | "taken">("idle");
    const [psnStatus, setPsnStatus] = useState<"idle" | "available" | "taken">("idle");
    const [eaStatus, setEaStatus] = useState<"idle" | "available" | "taken">("idle");
    const [xboxStatus, setXboxStatus] = useState<"idle" | "available" | "taken">("idle");

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

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user?.uid) return;
            try {
                const docRef = doc(db, "users", user.uid);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    console.log("EditProfile loaded data:", JSON.stringify(data, null, 2));
                    setFullName(data.fullName || "");
                    setUsername(data.username || "");
                    setOriginalUsername(data.username || "");
                    setCity(data.city || "Karachi");
                    setAgeRange(data.ageRange || "");
                    // Store full email as-is
                    const userEmail = auth.currentUser?.email || "";
                    setEmail(userEmail);
                    setOriginalEmail(userEmail);
                    setPhone(data.phone || "");
                    setOriginalPhone(data.phone || "");
                    setSelectedAreas(data.areasPreferred || []);

                    // Load pending email if exists
                    setPendingEmail(data.pendingEmail || "");

                    setSteamProfileUrl(data.steamProfileUrl || "");
                    setFaceitProfileUrl(data.faceitProfileUrl || "");
                    setPsnOnlineId(data.psnOnlineId || "");
                    setEaProfileUrl(data.eaProfileUrl || "");
                    setXboxGamertag(data.xboxGamertag || "");

                    setHideAreasPublicly(data.hideAreasPublicly || false);
                    setHidePlatformsPublicly(data.hidePlatformsPublicly || false);
                    setRestrictInvitesToFriends(data.restrictInvitesToFriends || false);

                    // Hydrate verified profiles if available
                    if (data.steamId) {
                        setSteamProfile({
                            steamId: data.steamId,
                            personaName: data.steamPersonaName,
                            cs2Hours: data.steamCs2Hours,
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

                    if (data.eaId) {
                        setEaStatus("available");
                    }
                    if (data.xboxId) {
                        setXboxStatus("available");
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
    }, [user?.uid]);

    // Auto-refresh auth state to check for email verification
    useEffect(() => {
        if (!user?.uid || !pendingEmail) return;

        const checkEmailUpdate = async () => {
            try {
                if (!auth.currentUser) return;

                // Reload auth state
                await reload(auth.currentUser);

                // Check if email has been updated
                const currentEmail = auth.currentUser.email || "";
                if (currentEmail === pendingEmail) {
                    // Email verified and updated!
                    console.log("Email verified! Updating Firestore...");

                    // Clear pending email from Firestore
                    const userRef = doc(db, "users", user.uid);
                    await updateDoc(userRef, {
                        pendingEmail: null,
                        updatedAt: new Date()
                    });

                    // Update local state
                    setEmail(currentEmail);
                    setOriginalEmail(currentEmail);
                    setPendingEmail("");

                    showToast({
                        type: "success",
                        title: "Email Updated",
                        message: "Your email has been successfully updated."
                    });
                }
            } catch (e: any) {
                // Handle token expiration - common when email is verified
                if (e?.code === 'auth/user-token-expired' || e?.code === 'auth/requires-recent-login') {
                    // Clear the pending email state
                    setPendingEmail("");

                    // Show helpful message
                    showToast({
                        type: "info",
                        title: "Email Verified",
                        message: "Your email was updated. Please log out and log back in to continue."
                    });

                    // Stop checking
                    return;
                }
                // Log other unexpected errors
                console.error("Error checking email update:", e);
            }
        };

        // Check immediately
        checkEmailUpdate();

        // Then check every 5 seconds
        const interval = setInterval(checkEmailUpdate, 5000);

        return () => clearInterval(interval);
    }, [user?.uid, pendingEmail]);


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
        const res = await fetchSteamProfileFromUrl(url);
        setSteamLoading(false);

        if (!res.ok) {
            showToast({ type: "error", title: "Steam lookup failed", message: res.message || "Verification failed." });
            setSteamProfile(null);
            setSteamStatus("idle");
            return;
        }

        // Check uniqueness
        const available = await isSteamIdAvailable(res.data.steamId, user?.uid);
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
    };

    const handleFaceitLookup = async () => {
        const value = faceitProfileUrl.trim();
        if (!value) {
            showToast({ type: "info", title: "FACEIT profile", message: "Paste your FACEIT profile link or nickname." });
            return;
        }
        setFaceitLoading(true);
        const res = await fetchFaceitProfileFromUrl(value);
        setFaceitLoading(false);

        if (!res.ok) {
            showToast({ type: "error", title: "FACEIT lookup failed", message: res.message || "Verification failed." });
            setFaceitProfile(null);
            setFaceitStatus("idle");
            return;
        }

        // Check uniqueness
        const available = await isFaceitIdAvailable(res.data.faceitId, user?.uid);
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
    };

    const handlePsnLookup = async () => {
        const id = psnOnlineId.trim();
        if (!id) {
            showToast({ type: "info", title: "PSN ID", message: "Enter your PSN Online ID first." });
            return;
        }
        setPsnLoading(true);
        // Request stats for both games as we are in profile setup
        const res = await verifyPsnProfile(id, true, true);
        setPsnLoading(false);

        if (!res.ok) {
            showToast({ type: "error", title: "PSN lookup failed", message: res.message || "Verification failed." });
            setPsnStats(null);
            setPsnStatus("idle");
            return;
        }

        // Check uniqueness
        const available = await isPsnIdAvailable(res.data.psnAccountId, user?.uid);
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
    };

    const handleEaLookup = async () => {
        const value = eaProfileUrl.trim();
        if (!value) {
            showToast({ type: "info", title: "EA ID", message: "Enter your EA ID first." });
            return;
        }
        setEaLoading(true);
        const available = await isEaIdAvailable(value, user?.uid);
        setEaLoading(false);

        if (!available) {
            setEaStatus("taken");
            showToast({
                type: "error",
                title: "Link in use",
                message: "This link is already in use.",
            });
        } else {
            setEaStatus("available");
            showToast({ type: "success", title: "Verified", message: "EA ID is available and linked." });
        }
    };

    const handleXboxLookup = async () => {
        const value = xboxGamertag.trim();
        if (!value) {
            showToast({ type: "info", title: "Xbox Gamertag", message: "Enter your Xbox Gamertag first." });
            return;
        }
        setXboxLoading(true);
        const available = await isXboxIdAvailable(value, user?.uid);
        setXboxLoading(false);

        if (!available) {
            setXboxStatus("taken");
            showToast({
                type: "error",
                title: "Link in use",
                message: "This link is already in use.",
            });
        } else {
            setXboxStatus("available");
            showToast({ type: "success", title: "Verified", message: "Xbox Gamertag is available and linked." });
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
            if (!auth.currentUser || !auth.currentUser.email) return;

            // Re-authenticate
            const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
            await reauthenticateWithCredential(auth.currentUser, cred);

            // Update
            await updatePassword(auth.currentUser, password);

            showToast({ type: "success", title: "Success", message: "Password updated successfully." });

            // Clean up
            setCurrentPassword("");
            setPassword("");
            setIsPasswordChanging(false);
        } catch (e: any) {
            console.error("Password update failed", e);
            let msg = "Failed to update password.";
            if (e.code === 'auth/wrong-password') msg = "Current password is incorrect.";
            if (e.code === 'auth/requires-recent-login') msg = "Session too old. Please re-login.";
            showToast({ type: "error", title: "Error", message: msg });
        } finally {
            setPasswordUpdating(false);
        }
    };

    // Email update handler
    const handleUpdateEmail = async () => {
        if (!auth.currentUser || !isNewEmailValid || !user?.uid) return;

        try {
            setEmailUpdating(true);
            await verifyBeforeUpdateEmail(auth.currentUser, newEmail.trim());

            // Store pending email in Firestore
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                pendingEmail: newEmail.trim(),
                updatedAt: new Date()
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
            psnStatus === "taken" ||
            eaStatus === "taken" ||
            xboxStatus === "taken"
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
                eaProfileUrl: eaProfileUrl.trim() || null,
                xboxGamertag: xboxGamertag.trim() || null,
                hideAreasPublicly,
                hidePlatformsPublicly,
                restrictInvitesToFriends,
                updatedAt: new Date(),
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
            } else if (!faceitProfileUrl.trim()) {
                // Clear ALL FACEIT data if URL is cleared
                updates.faceitId = null;
                updates.faceitNickname = null;
                updates.faceitGame = null;
                updates.faceitElo = null;
                updates.faceitSkillLevel = null;
            }

            // Persist Verified PSN Stats
            if (psnStats && psnOnlineId.trim()) {
                updates.psnStats = psnStats;
            } else if (!psnOnlineId.trim()) {
                // Clear ALL PSN data if ID is cleared
                updates.psnStats = null;
            }

            // EA / Xbox IDs
            if (eaStatus === "available" && eaProfileUrl.trim()) {
                updates.eaId = eaProfileUrl.trim();
            } else if (!eaProfileUrl.trim()) {
                updates.eaId = null;
            }

            if (xboxStatus === "available" && xboxGamertag.trim()) {
                updates.xboxId = xboxGamertag.trim();
            } else if (!xboxGamertag.trim()) {
                updates.xboxId = null;
            }

            // Auth Updates - Email is read-only, no updates needed

            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, updates);

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
                <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
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

                <TouchableOpacity
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    <Text style={styles.saveButtonText}>{saving ? "Saving..." : "Save"}</Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

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
                        <View style={[styles.inputBox, { opacity: 0.6 }]}>
                            <TextInput
                                value={username}
                                style={styles.input}
                                placeholder="Unique username"
                                placeholderTextColor={COLORS.muted}
                                autoCapitalize="none"
                                editable={false}
                            />
                        </View>
                        <Text style={[styles.helperText, { color: COLORS.muted }]}>Usernames are permanent and cannot be changed</Text>
                    </View>

                    {/* City & Age */}
                    <View style={{ marginBottom: 24 }}>
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
                        <View style={[styles.inputBox, { opacity: 0.6 }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                <MaterialIcons
                                    name="email"
                                    size={20}
                                    style={{ marginRight: 8, opacity: 0.9 }}
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
                            <View style={{
                                marginTop: 8,
                                padding: 12,
                                backgroundColor: COLORS.warning + '20',
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: COLORS.warning + '40'
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <MaterialIcons name="pending" size={18} color={COLORS.warning} />
                                    <Text style={{ color: COLORS.warning, fontSize: 13, fontWeight: '600' }}>
                                        Pending Verification
                                    </Text>
                                </View>
                                <Text style={{ color: COLORS.text, fontSize: 12, marginTop: 4 }}>
                                    {pendingEmail}
                                </Text>
                            </View>
                        )}

                        {!isEmailChanging ? (
                            <Pressable
                                onPress={() => setIsEmailChanging(true)}
                                style={[styles.platformButton, { marginTop: 8 }]}
                            >
                                <Text style={styles.platformButtonText}>Change Email</Text>
                            </Pressable>
                        ) : (
                            <View style={{ gap: 12, marginTop: 12 }}>
                                {/* New Email Input */}
                                <View style={styles.inputBox}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <MaterialIcons
                                            name="email"
                                            size={20}
                                            style={{ marginRight: 8, opacity: 0.9 }}
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

                                <View style={{ flexDirection: 'row', gap: 12 }}>
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
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                <MaterialIcons
                                    name="phone-android"
                                    size={20}
                                    style={{ marginRight: 8, opacity: 0.9 }}
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
                                    style={[styles.input, { paddingRight: INPUT_PADDING.withIcon }]}
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
                                        style={{ marginLeft: 8 }}
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
                                style={[styles.platformButton, { marginTop: 0 }]}
                            >
                                <Text style={styles.platformButtonText}>Change Password</Text>
                            </Pressable>
                        ) : (
                            <View style={{ gap: 12 }}>
                                {/* Current */}
                                <View style={styles.inputBox}>
                                    <TextInput
                                        value={currentPassword}
                                        onChangeText={setCurrentPassword}
                                        style={[styles.input, { paddingRight: INPUT_PADDING.withToggle }]}
                                        placeholder="Current Password"
                                        placeholderTextColor={COLORS.muted}
                                        secureTextEntry={!currentPasswordVisible}
                                    />
                                    <Pressable onPress={() => setCurrentPasswordVisible(!currentPasswordVisible)} style={{ position: 'absolute', right: 12 }}>
                                        <MaterialIcons name={currentPasswordVisible ? "visibility" : "visibility-off"} size={20} color={COLORS.muted} />
                                    </Pressable>
                                </View>

                                {/* New */}
                                <View style={styles.inputBox}>
                                    <TextInput
                                        value={password}
                                        onChangeText={setPassword}
                                        style={[styles.input, { paddingRight: INPUT_PADDING.withToggle }]}
                                        placeholder="New Password"
                                        placeholderTextColor={COLORS.muted}
                                        secureTextEntry={!passwordVisible}
                                    />
                                    <Pressable onPress={() => setPasswordVisible(!passwordVisible)} style={{ position: 'absolute', right: 12 }}>
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

                                <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
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
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <Text style={[styles.label, { marginBottom: 0 }]}>Preferred Areas</Text>
                            <Text style={{
                                color: selectedAreas.length >= 5 ? COLORS.warning : COLORS.muted,
                                fontSize: 12,
                                fontWeight: '600'
                            }}>
                                {selectedAreas.length}/5 Selected
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
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

                        <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
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
                            <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
                                <Text style={styles.summaryLabel}>Verified Account</Text>
                                <View style={{ flexDirection: "column" }}>
                                    <Text style={[styles.summaryValue, { color: COLORS.accent, fontWeight: "600" }]}>
                                        {psnStats.psnOnlineId}
                                    </Text>
                                    <Text style={[styles.summaryValue, { fontSize: 11 }]}>
                                        Level {psnStats.trophyLevel} · {psnStats.totalTrophies?.platinum ?? 0} Platinums
                                    </Text>
                                </View>
                            </View>
                        )}
                        {psnStatus === "taken" && (
                            <Text style={[styles.helperText, styles.helperError]}>This link is already in use.</Text>
                        )}
                    </View>

                    {/* EA */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>EA Account / Club</Text>
                        <View style={styles.platformInputRow}>
                            <View style={[styles.platformIcon, { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '10' }]}>
                                <MaterialIcons name="sports-soccer" size={24} color={COLORS.accent} />
                            </View>
                            <View style={styles.platformField}>
                                <View style={styles.inputBox}>
                                    <TextInput
                                        value={eaProfileUrl}
                                        onChangeText={(t) => {
                                            setEaProfileUrl(t);
                                            setEaStatus("idle");
                                        }}
                                        style={[styles.input, { fontSize: 13 }]}
                                        placeholder="Club link or EA ID"
                                        placeholderTextColor={COLORS.muted}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                </View>
                            </View>
                        </View>

                        <Pressable
                            onPress={handleEaLookup}
                            disabled={eaLoading || !eaProfileUrl.trim()}
                            style={({ pressed }) => [
                                styles.platformButton,
                                eaStatus === "available" && { backgroundColor: "#1DB954", borderColor: "#1DB954" },
                                pressed && !eaLoading && { opacity: 0.9 },
                            ]}
                        >
                            <Text style={styles.platformButtonText}>
                                {eaLoading ? "Checking..." : eaStatus === "available" ? "EA Linked" : "Verify EA Account"}
                            </Text>
                        </Pressable>
                        {eaStatus === "taken" && (
                            <Text style={[styles.helperText, styles.helperError]}>This link is already in use.</Text>
                        )}
                    </View>

                    {/* Xbox */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Xbox Gamertag</Text>
                        <View style={styles.platformInputRow}>
                            <View style={[styles.platformIcon, { borderColor: '#107C10', backgroundColor: '#e6f2e6' }]}>
                                <MaterialIcons name="sports-esports" size={24} color="#107C10" />
                            </View>
                            <View style={styles.platformField}>
                                <View style={styles.inputBox}>
                                    <TextInput
                                        value={xboxGamertag}
                                        onChangeText={(t) => {
                                            setXboxGamertag(t);
                                            setXboxStatus("idle");
                                        }}
                                        style={[styles.input, { fontSize: 13 }]}
                                        placeholder="Your Xbox gamertag"
                                        placeholderTextColor={COLORS.muted}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                </View>
                            </View>
                        </View>

                        <Pressable
                            onPress={handleXboxLookup}
                            disabled={xboxLoading || !xboxGamertag.trim()}
                            style={({ pressed }) => [
                                styles.platformButton,
                                xboxStatus === "available" && { backgroundColor: "#1DB954", borderColor: "#1DB954" },
                                pressed && !xboxLoading && { opacity: 0.9 },
                            ]}
                        >
                            <Text style={styles.platformButtonText}>
                                {xboxLoading ? "Checking..." : xboxStatus === "available" ? "Xbox Linked" : "Verify Xbox Gamertag"}
                            </Text>
                        </Pressable>
                        {xboxStatus === "taken" && (
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
