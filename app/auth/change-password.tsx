import { Redirect, router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
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
import { useAuth } from "../../src/context/AuthContext";
import { useToast } from "../../src/hooks/useToast";
import { authClient } from "../../src/lib/auth-client";
import { convex } from "../../src/lib/convex";
import { api } from "../../convex/_generated/api";
import { getDefaultSignedInRoute } from "../../src/utils/accountRouting";
import { COLORS, INPUT_PADDING } from "../../src/theme";
import registerStyles from "./register.styles";
import styles from "./login.styles";

type FocusField = "current" | "password" | "confirm" | null;

// Forced first-login password change. Reached only when the signed-in user is
// flagged `mustChangePassword` (e.g. a system-provisioned partner Super Admin).
// It cannot be skipped: there is no back/cancel path out of it while flagged.
export default function ForcedChangePassword() {
    const { user, loading: authLoading, refreshUser } = useAuth();
    const { showToast } = useToast();

    const [currentPassword, setCurrentPassword] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [currentVisible, setCurrentVisible] = useState(false);
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [focused, setFocused] = useState<FocusField>(null);
    const [submitting, setSubmitting] = useState(false);
    const passwordInputRef = useRef<TextInput>(null);
    const confirmInputRef = useRef<TextInput>(null);

    const {
        hasUpper,
        hasLower,
        hasNumber,
        hasSpecial,
        hasMinLength,
        isPasswordValid,
    } = useMemo(() => {
        const hasUpperRule = /[A-Z]/.test(password);
        const hasLowerRule = /[a-z]/.test(password);
        const hasNumberRule = /[0-9]/.test(password);
        const hasSpecialRule = /[^A-Za-z0-9]/.test(password);
        const lengthOkRule = password.length >= 8;
        return {
            hasUpper: hasUpperRule,
            hasLower: hasLowerRule,
            hasNumber: hasNumberRule,
            hasSpecial: hasSpecialRule,
            hasMinLength: lengthOkRule,
            isPasswordValid: hasUpperRule && hasLowerRule && hasNumberRule && hasSpecialRule && lengthOkRule,
        };
    }, [password]);

    const newDiffersFromCurrent = password.length === 0 || password !== currentPassword;
    const isFormValid =
        currentPassword.length > 0 && isPasswordValid && password === confirm && newDiffersFromCurrent;
    const showRequirements =
        password.length > 0 &&
        !(hasUpper && hasLower && hasNumber && hasSpecial && hasMinLength);

    // Not flagged → nobody should sit on this screen. Route them home/login.
    if (!authLoading && (!user || user.mustChangePassword !== true)) {
        return <Redirect href={(user ? getDefaultSignedInRoute(user as any) : "/auth/login") as any} />;
    }

    const handleSubmit = async () => {
        if (!isFormValid) {
            showToast({
                type: "info",
                title: "Check passwords",
                message: !newDiffersFromCurrent
                    ? "New password must be different from your current password."
                    : password !== confirm
                        ? "Passwords do not match."
                        : "Password does not meet strength requirements.",
            });
            return;
        }

        setSubmitting(true);
        try {
            const result = await (authClient as any).changePassword({
                currentPassword,
                newPassword: password,
            });
            if (result?.error) {
                throw result.error;
            }

            // Lift the in-app gate only AFTER the auth password actually changed.
            await convex.mutation(api.users.completeForcedPasswordChange, {});
            await refreshUser();

            showToast({ type: "success", title: "Password updated", message: "Your password has been changed." });
            const destination = user ? getDefaultSignedInRoute(user as any) : "/auth/login";
            router.replace(destination as any);
        } catch (e: any) {
            const raw = String(e?.message || "");
            let message = "Could not change your password. Please try again.";
            if (raw.includes("incorrect") || raw.includes("wrong") || raw.includes("invalid")) {
                message = "Current password is incorrect.";
            } else if (raw.includes("recent") || raw.includes("session")) {
                message = "Your session is too old. Please sign in again.";
            }
            showToast({ type: "error", title: "Change failed", message });
        } finally {
            setSubmitting(false);
        }
    };

    const Container: any = Platform.OS === "ios" ? KeyboardAvoidingView : View;
    const containerProps = Platform.OS === "ios"
        ? { style: styles.screen, behavior: "padding" as const }
        : { style: styles.screen };

    const renderPasswordField = (opts: {
        label: string;
        value: string;
        onChange: (text: string) => void;
        visible: boolean;
        toggleVisible: () => void;
        field: FocusField;
        placeholder: string;
        inputRef?: React.RefObject<TextInput | null>;
        onSubmitEditing?: () => void;
        returnKeyType?: "next" | "done";
        textContentType?: "password" | "newPassword";
        autoComplete?: "current-password" | "new-password";
    }) => (
        <View style={styles.fieldGroup}>
            <Text style={styles.label}>{opts.label}</Text>
            <View style={styles.inputBox}>
                <View style={styles.inputRow}>
                    <AppIcon
                        name="lock"
                        size={20}
                        style={styles.prefixIcon}
                        color={opts.value.length > 0 ? COLORS.accent : COLORS.muted}
                    />
                    <TextInput
                        ref={opts.inputRef}
                        placeholder={opts.placeholder}
                        placeholderTextColor={COLORS.muted}
                        style={[styles.input, { paddingRight: INPUT_PADDING.withToggle }]}
                        selectionColor={COLORS.accent}
                        secureTextEntry={!opts.visible}
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={opts.value}
                        onChangeText={opts.onChange}
                        onFocus={() => setFocused(opts.field)}
                        onBlur={() => setFocused(null)}
                        returnKeyType={opts.returnKeyType}
                        onSubmitEditing={opts.onSubmitEditing}
                        textContentType={opts.textContentType}
                        autoComplete={opts.autoComplete}
                    />
                    <Pressable onPress={opts.toggleVisible} hitSlop={10}>
                        <AppIcon
                            name={opts.visible ? "visibility" : "visibility-off"}
                            size={18}
                            style={styles.suffixIcon}
                            color={COLORS.muted}
                        />
                    </Pressable>
                </View>
                <View style={[styles.focusBar, { opacity: focused === opts.field ? 1 : 0 }]} />
            </View>
        </View>
    );

    return (
        <Container {...containerProps}>
            <ScrollView
                contentContainerStyle={[styles.container, { paddingBottom: 32 }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <LogoHalo />
                <Text style={styles.heading}>Change your password</Text>
                <Text style={styles.sub}>
                    For security, you must set a new password before continuing.
                </Text>

                {renderPasswordField({
                    label: "Current password",
                    value: currentPassword,
                    onChange: setCurrentPassword,
                    visible: currentVisible,
                    toggleVisible: () => setCurrentVisible((v) => !v),
                    field: "current",
                    placeholder: "Current password",
                    onSubmitEditing: () => passwordInputRef.current?.focus(),
                    returnKeyType: "next",
                    textContentType: "password",
                    autoComplete: "current-password",
                })}

                {renderPasswordField({
                    label: "New password",
                    value: password,
                    onChange: setPassword,
                    visible: passwordVisible,
                    toggleVisible: () => setPasswordVisible((v) => !v),
                    field: "password",
                    placeholder: "New password",
                    inputRef: passwordInputRef,
                    onSubmitEditing: () => confirmInputRef.current?.focus(),
                    returnKeyType: "next",
                    textContentType: "newPassword",
                    autoComplete: "new-password",
                })}

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

                {renderPasswordField({
                    label: "Confirm new password",
                    value: confirm,
                    onChange: setConfirm,
                    visible: confirmVisible,
                    toggleVisible: () => setConfirmVisible((v) => !v),
                    field: "confirm",
                    placeholder: "Repeat new password",
                    inputRef: confirmInputRef,
                    onSubmitEditing: handleSubmit,
                    returnKeyType: "done",
                    textContentType: "newPassword",
                    autoComplete: "new-password",
                })}

                {confirm.length > 0 && password !== confirm && (
                    <Text style={[styles.helperText, styles.helperWarning]}>Passwords do not match.</Text>
                )}

                <View style={[styles.buttonShadowWrapper, isFormValid && !submitting && styles.buttonShadowWrapperActive]}>
                    <AppButton onPress={handleSubmit} disabled={submitting || !isFormValid} loading={submitting}>
                        Update password
                    </AppButton>
                </View>
            </ScrollView>
        </Container>
    );
}
