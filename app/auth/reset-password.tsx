import { useLocalSearchParams, router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import registerStyles from "./register.styles";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { AppButton } from "../../src/components/AppPrimitives";
import { AppIcon } from "../../src/components/AppIcon";
import LogoHalo from "../../src/components/LogoHalo";
import { useToast } from "../../src/hooks/useToast";
import { resetPasswordWithToken } from "../../src/services/convex/authService";
import { COLORS, INPUT_PADDING } from "../../src/theme";
import styles from "./login.styles";

type FocusField = "password" | "confirm" | null;

export default function ResetPassword() {
    const params = useLocalSearchParams<{
        error?: string | string[];
        token?: string | string[];
    }>();
    const { showToast } = useToast();

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [focused, setFocused] = useState<FocusField>(null);
    const [submitting, setSubmitting] = useState(false);
    const confirmInputRef = useRef<TextInput>(null);

    const {
        hasUpper,
        hasLower,
        hasNumber,
        hasSpecial,
        hasMinLength,
        isPasswordValid,
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

        let nextStrengthLabel: string | null = null;
        let nextStrengthColor = COLORS.muted;
        let nextStrengthWidth = 0;

        if (password.length > 0) {
            if (rulesMet <= 2 || !lengthOkRule) {
                nextStrengthLabel = "Weak";
                nextStrengthColor = COLORS.error;
                nextStrengthWidth = 25;
            } else if (rulesMet === 3) {
                nextStrengthLabel = "Fair";
                nextStrengthColor = "#ffb74d";
                nextStrengthWidth = 50;
            } else if (rulesMet === 4) {
                nextStrengthLabel = "Strong";
                nextStrengthColor = COLORS.success;
                nextStrengthWidth = 75;
            } else {
                nextStrengthLabel = "Very strong";
                nextStrengthColor = COLORS.success;
                nextStrengthWidth = 100;
            }
        }

        return {
            hasUpper: hasUpperRule,
            hasLower: hasLowerRule,
            hasNumber: hasNumberRule,
            hasSpecial: hasSpecialRule,
            hasMinLength: lengthOkRule,
            isPasswordValid: hasUpperRule && hasLowerRule && hasNumberRule && hasSpecialRule && lengthOkRule,
            strengthLabel: nextStrengthLabel,
            strengthColor: nextStrengthColor,
            strengthWidth: nextStrengthWidth,
        };
    }, [password]);

    const resetToken = useMemo(() => {
        const rawToken = Array.isArray(params.token) ? params.token[0] : params.token;
        return String(rawToken || "").trim();
    }, [params.token]);
    const resetError = useMemo(() => {
        const rawError = Array.isArray(params.error) ? params.error[0] : params.error;
        return String(rawError || "").trim();
    }, [params.error]);
    const isFormValid = isPasswordValid && password === confirm;
    const showRequirements =
        password.length > 0 &&
        !(hasUpper && hasLower && hasNumber && hasSpecial && hasMinLength);

    const handleReset = async () => {
        if (!resetToken) {
            showToast({ type: "error", title: "Invalid link", message: "Reset token is missing. Please request a new reset link." });
            return;
        }
        if (!isFormValid) {
            showToast({
                type: "info",
                title: "Check passwords",
                message: password !== confirm ? "Passwords do not match." : "Password does not meet strength requirements.",
            });
            return;
        }

        setSubmitting(true);
        try {
            const result = await resetPasswordWithToken(resetToken, password);
            if (!result.ok) {
                showToast({ type: "error", title: "Reset failed", message: result.message || "Could not reset password. Try again." });
                return;
            }
            showToast({ type: "success", title: "Password updated", message: "Your password has been reset. Please sign in." });
            router.replace("/auth/login");
        } catch (e: any) {
            showToast({ type: "error", title: "Reset failed", message: e?.message ?? "Something went wrong. Please try again." });
        } finally {
            setSubmitting(false);
        }
    };

    const Container: any = Platform.OS === "ios" ? KeyboardAvoidingView : View;
    const containerProps = Platform.OS === "ios"
        ? { style: styles.screen, behavior: "padding" as const }
        : { style: styles.screen };

    if (!resetToken) {
        return (
            <Container {...containerProps}>
                <View style={styles.container}>
                    <LogoHalo />
                    <Text style={styles.heading}>Invalid link</Text>
                    <Text style={styles.sub}>
                        {resetError
                            ? "This reset link is invalid or has expired. Please request a new one."
                            : "This reset link is invalid or has already been used. Please request a new one."}
                    </Text>
                    <AppButton onPress={() => router.replace("/auth/forgot-password")}>Request new link</AppButton>
                </View>
            </Container>
        );
    }

    return (
        <Container {...containerProps}>
            <ScrollView
                contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <LogoHalo />
                <Text style={styles.heading}>Set new password</Text>
                <Text style={styles.sub}>Choose a strong password for your MatchHai account.</Text>

                {/* New password */}
                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>New password</Text>
                    <View style={styles.inputBox}>
                        <View style={styles.inputRow}>
                            <AppIcon
                                name="lock"
                                size={20}
                                style={styles.prefixIcon}
                                color={isPasswordValid && password.length > 0 ? COLORS.accent : COLORS.muted}
                            />
                            <TextInput
                                placeholder="Password"
                                placeholderTextColor={COLORS.muted}
                                style={[styles.input, { paddingRight: INPUT_PADDING.withToggle }]}
                                selectionColor={COLORS.accent}
                                secureTextEntry={!passwordVisible}
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={password}
                                onChangeText={setPassword}
                                onFocus={() => setFocused("password")}
                                onBlur={() => setFocused(null)}
                                returnKeyType="next"
                                onSubmitEditing={() => confirmInputRef.current?.focus()}
                                textContentType="newPassword"
                                autoComplete="new-password"
                            />
                            <Pressable onPress={() => setPasswordVisible((v) => !v)} hitSlop={10}>
                                <AppIcon
                                    name={passwordVisible ? "visibility" : "visibility-off"}
                                    size={18}
                                    style={styles.suffixIcon}
                                    color={COLORS.muted}
                                />
                            </Pressable>
                        </View>
                        <View style={[styles.focusBar, { opacity: focused === "password" ? 1 : 0 }]} />
                    </View>

                    {/* Strength meter */}
                    {password.length > 0 && (
                        <View style={registerStyles.passwordStrengthWrapper}>
                            <View style={registerStyles.strengthMeterTrack}>
                                <View
                                    style={[
                                        registerStyles.strengthMeterFill,
                                        { width: `${strengthWidth}%`, backgroundColor: strengthColor } as any,
                                    ]}
                                />
                            </View>
                            {strengthLabel && (
                                <Text style={[styles.strengthLabel, { color: strengthColor || COLORS.muted }]}>
                                    Strength: {strengthLabel}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* Requirements checklist */}
                    {showRequirements && (
                        <View style={registerStyles.passwordRequirementsRow}>
                            <View style={registerStyles.requirementColumn}>
                                <Text style={[registerStyles.passwordRequirementText, hasUpper && registerStyles.passwordRequirementTextDone]}>
                                    {hasUpper ? "OK" : "X"} 1 uppercase character
                                </Text>
                                <Text style={[registerStyles.passwordRequirementText, hasLower && registerStyles.passwordRequirementTextDone]}>
                                    {hasLower ? "OK" : "X"} 1 lowercase character
                                </Text>
                            </View>
                            <View style={registerStyles.requirementColumn}>
                                <Text style={[registerStyles.passwordRequirementText, hasNumber && registerStyles.passwordRequirementTextDone]}>
                                    {hasNumber ? "OK" : "X"} 1 numeric character
                                </Text>
                                <Text style={[registerStyles.passwordRequirementText, hasSpecial && registerStyles.passwordRequirementTextDone]}>
                                    {hasSpecial ? "OK" : "X"} 1 special character
                                </Text>
                                <Text style={[registerStyles.passwordRequirementText, hasMinLength && registerStyles.passwordRequirementTextDone]}>
                                    {hasMinLength ? "OK" : "X"} 8+ characters
                                </Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Confirm password */}
                <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Confirm password</Text>
                    <View style={styles.inputBox}>
                        <View style={styles.inputRow}>
                            <AppIcon
                                name="lock"
                                size={20}
                                style={styles.prefixIcon}
                                color={confirm.length > 0 && password === confirm ? COLORS.accent : COLORS.muted}
                            />
                            <TextInput
                                ref={confirmInputRef}
                                placeholder="Repeat your password"
                                placeholderTextColor={COLORS.muted}
                                style={[styles.input, { paddingRight: INPUT_PADDING.withToggle }]}
                                selectionColor={COLORS.accent}
                                secureTextEntry={!confirmVisible}
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={confirm}
                                onChangeText={setConfirm}
                                onFocus={() => setFocused("confirm")}
                                onBlur={() => setFocused(null)}
                                returnKeyType="done"
                                onSubmitEditing={handleReset}
                                textContentType="newPassword"
                                autoComplete="new-password"
                            />
                            <Pressable onPress={() => setConfirmVisible((v) => !v)} hitSlop={10}>
                                <AppIcon
                                    name={confirmVisible ? "visibility" : "visibility-off"}
                                    size={18}
                                    style={styles.suffixIcon}
                                    color={COLORS.muted}
                                />
                            </Pressable>
                        </View>
                        <View style={[styles.focusBar, { opacity: focused === "confirm" ? 1 : 0 }]} />
                    </View>
                    {confirm.length > 0 && password !== confirm && (
                        <Text style={[styles.helperText, styles.helperWarning]}>Passwords do not match.</Text>
                    )}
                </View>

                <View style={[styles.buttonShadowWrapper, isFormValid && !submitting && styles.buttonShadowWrapperActive]}>
                    <AppButton onPress={handleReset} disabled={submitting || !isFormValid} loading={submitting}>
                        Reset password
                    </AppButton>
                </View>
            </ScrollView>
        </Container>
    );
}
