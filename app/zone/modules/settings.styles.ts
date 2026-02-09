import { StyleSheet } from "react-native";
import { COLORS, FONTS, SPACING, TEXT_SIZES } from "../../../src/theme";

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    content: {
        paddingBottom: SPACING.xxl + 24,
    },
    card: {
        backgroundColor: COLORS.cardDark,
        borderColor: COLORS.cardBorder,
        borderWidth: 1,
        borderRadius: 20,
        padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    statusRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: SPACING.sm,
    },
    statusDot: {
        width: 9,
        height: 9,
        borderRadius: 5,
        marginRight: SPACING.xs,
    },
    statusText: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
    },
    cardTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
        marginBottom: SPACING.sm,
    },
    cardDescription: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        lineHeight: 18,
    },
    metricsRow: {
        flexDirection: "row",
        gap: SPACING.md,
        marginTop: SPACING.md,
        marginBottom: SPACING.md,
    },
    metricCard: {
        flex: 1,
        backgroundColor: "rgba(255,255,255,0.04)",
        borderColor: COLORS.cardBorder,
        borderWidth: 1,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 74,
        paddingHorizontal: SPACING.sm,
    },
    metricValue: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.xl,
        marginBottom: 2,
    },
    metricLabel: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.xs + 1,
    },
    primaryButton: {
        height: 46,
        borderRadius: 14,
        backgroundColor: COLORS.accent,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: SPACING.sm,
    },
    primaryButtonDisabled: {
        opacity: 0.6,
    },
    primaryButtonText: {
        color: "#FFF",
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.label,
    },
    pointRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginTop: SPACING.sm,
    },
    pointText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        lineHeight: 18,
        marginLeft: SPACING.sm,
        flex: 1,
    },
});

