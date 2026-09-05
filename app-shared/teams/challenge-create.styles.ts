import { StyleSheet } from "react-native";
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from "../../src/theme";

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    content: {
        padding: SPACING.screenPadding,
        paddingBottom: SPACING.xxl,
        gap: SPACING.md,
    },
    card: {
        backgroundColor: COLORS.cardDark,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderRadius: RADII.md,
        padding: SPACING.md,
    },
    title: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
        marginBottom: SPACING.xs,
    },
    meta: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        marginBottom: 4,
    },
    sectionTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
        marginBottom: SPACING.xs,
    },
    row: {
        flexDirection: "row",
        gap: SPACING.sm,
    },
    inputWrap: {
        flex: 1,
    },
    label: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 11,
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.backgroundDark,
        borderRadius: RADII.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.sm,
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
    },
    chipRow: {
        flexDirection: "row",
        gap: SPACING.sm,
        flexWrap: "wrap",
    },
    chip: {
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        borderRadius: RADII.sm,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: COLORS.backgroundDark,
    },
    chipActive: {
        borderColor: COLORS.accent,
        backgroundColor: "rgba(66, 165, 245, 0.18)",
    },
    chipText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
    },
    chipTextActive: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
    },
    warningText: {
        color: COLORS.warning,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
    },
    primaryButton: {
        marginTop: SPACING.xs,
        backgroundColor: COLORS.accent,
        borderRadius: RADII.md,
        paddingVertical: SPACING.md,
        alignItems: "center",
    },
    primaryButtonDisabled: {
        opacity: 0.6,
    },
    primaryButtonText: {
        color: "#FFF",
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },
});

