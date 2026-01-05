// src/ui/toastStyles.ts
import { StyleSheet } from "react-native";
import { COLORS } from "../theme";

export const toastStyles = StyleSheet.create({
    baseContainer: {
        position: "absolute",
        bottom: 90, // Clear the tab bar (65px + safe area)
        left: "5%",
        right: "5%",
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
        // Glassmorphism backdrop
        backgroundColor: "rgba(30, 30, 30, 0.95)",
    },
    errorContainer: {
        borderColor: COLORS.error,
        // Bloom/glow effect for error
        shadowColor: COLORS.error,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
        elevation: 12,
    },
    successContainer: {
        borderColor: COLORS.successBright,
        // Bloom/glow effect for success
        shadowColor: COLORS.successBright,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
        elevation: 12,
    },
    warningContainer: {
        borderColor: COLORS.warning,
        // Bloom/glow effect for warning
        shadowColor: COLORS.warning,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 18,
        elevation: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    errorIcon: {
        backgroundColor: `${COLORS.error}20`,
    },
    successIcon: {
        backgroundColor: `${COLORS.successBright}20`,
    },
    warningIcon: {
        backgroundColor: `${COLORS.warning}20`,
    },
    textColumn: {
        flex: 1,
    },
    errorTitle: {
        color: COLORS.error,
        fontSize: 14,
        fontWeight: "700",
        marginBottom: 4,
        letterSpacing: 0.3,
    },
    successTitle: {
        color: COLORS.successBright,
        fontSize: 14,
        fontWeight: "700",
        marginBottom: 4,
        letterSpacing: 0.3,
    },
    warningTitle: {
        color: COLORS.warning,
        fontSize: 14,
        fontWeight: "700",
        marginBottom: 4,
        letterSpacing: 0.3,
    },
    messageText: {
        fontSize: 13,
        color: COLORS.text,
        opacity: 0.9,
        lineHeight: 18,
    },
});
