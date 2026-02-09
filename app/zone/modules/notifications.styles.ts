import { StyleSheet } from "react-native";
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from "../../../src/theme";

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    segmentTabs: {
        marginBottom: SPACING.md,
    },
    content: {
        paddingBottom: SPACING.xxl + 24,
    },
    errorBox: {
        borderWidth: 1,
        borderColor: COLORS.error,
        backgroundColor: "rgba(239, 83, 80, 0.12)",
        borderRadius: RADII.sm,
        padding: SPACING.sm,
        marginBottom: SPACING.md,
    },
    errorText: {
        color: COLORS.error,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
    },
    emptyText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
    },
    card: {
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        backgroundColor: COLORS.cardDark,
        borderRadius: 20,
        padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    cardTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: SPACING.sm,
    },
    cardTitle: {
        flex: 1,
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.caption + 1,
    },
    cardStatus: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.xs + 1,
        textTransform: "uppercase",
        backgroundColor: "rgba(66, 165, 245, 0.15)",
        borderWidth: 1,
        borderColor: "rgba(66, 165, 245, 0.35)",
        borderRadius: RADII.pill,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    cardType: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        marginTop: 4,
    },
    cardTime: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.xs + 1,
        marginTop: 2,
    },
    openRow: {
        marginTop: SPACING.xs,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    openText: {
        color: COLORS.accent,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.xs + 1,
    },
});

