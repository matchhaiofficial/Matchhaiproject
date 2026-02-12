import { StyleSheet } from "react-native";
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from "../../src/theme";

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        padding: SPACING.screenPadding,
        paddingBottom: SPACING.xxl,
        gap: SPACING.md,
    },
    loaderWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    emptyText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
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
    sectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: SPACING.xs,
    },
    sectionTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },
    meta: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        marginBottom: 4,
    },
    warningText: {
        color: COLORS.warning,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
    },
    sectionTitleSpacing: {
        marginTop: SPACING.sm,
    },
    highlightCard: {
        marginTop: SPACING.xs,
        borderWidth: 1,
        borderColor: COLORS.success,
        borderRadius: RADII.sm,
        padding: SPACING.sm,
        backgroundColor: "rgba(34, 197, 94, 0.12)",
    },
    highlightTitle: {
        color: COLORS.successBright || COLORS.success,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.caption,
        marginBottom: 4,
    },
    highlightText: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },
    highlightSubtext: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
    },
    chatButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: COLORS.accent,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        borderRadius: RADII.sm,
    },
    chatButtonText: {
        color: "#FFF",
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.caption,
    },
    primaryButton: {
        marginTop: SPACING.sm,
        backgroundColor: COLORS.accent,
        borderRadius: RADII.md,
        paddingVertical: SPACING.md,
        alignItems: "center",
    },
    primaryButtonDisabled: {
        opacity: 0.65,
    },
    primaryButtonText: {
        color: "#FFF",
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },
    secondaryButton: {
        marginTop: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.accent,
        borderRadius: RADII.md,
        paddingVertical: SPACING.md,
        alignItems: "center",
        backgroundColor: "rgba(66,165,245,0.1)",
    },
    secondaryButtonText: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },
    rejectButton: {
        marginTop: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.error,
        borderRadius: RADII.md,
        paddingVertical: SPACING.md,
        alignItems: "center",
        backgroundColor: "rgba(255,82,82,0.1)",
    },
    rejectButtonText: {
        color: COLORS.error,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },
    inlineButton: {
        marginTop: SPACING.xs,
        alignSelf: "flex-start",
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        borderRadius: RADII.sm,
        borderWidth: 1,
        borderColor: COLORS.accent,
        backgroundColor: "rgba(66,165,245,0.12)",
    },
    inlineButtonText: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.caption,
    },
});
