import { StyleSheet } from "react-native";
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from "../../../src/theme";

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    loadingWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.backgroundDark,
    },
    content: {
        paddingBottom: SPACING.lg,
    },
    noticeBox: {
        borderWidth: 1,
        borderColor: "rgba(255, 193, 7, 0.35)",
        backgroundColor: "rgba(255, 193, 7, 0.1)",
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    noticeTitle: {
        color: COLORS.warning,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.caption + 1,
        marginBottom: 4,
    },
    noticeText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        lineHeight: 18,
    },
    topRow: {
        marginBottom: SPACING.md,
    },
    addButton: {
        height: 46,
        borderRadius: 14,
        backgroundColor: COLORS.accent,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: SPACING.xs,
    },
    addButtonPressed: {
        opacity: 0.9,
    },
    addButtonText: {
        color: "#fff",
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.label,
    },
    emptyWrap: {
        alignItems: "center",
        marginTop: SPACING.xl,
    },
    emptyTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
    },
    emptyText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
    },
    branchCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: 20,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        marginBottom: SPACING.md,
    },
    branchCardPressed: {
        opacity: 0.9,
    },
    branchCardRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    branchTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: SPACING.xs,
    },
    branchTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.lg,
    },
    primaryPill: {
        backgroundColor: "rgba(66, 165, 245, 0.15)",
        borderColor: "rgba(66, 165, 245, 0.32)",
        borderWidth: 1,
        borderRadius: RADII.pill,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
    },
    primaryPillText: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.xs + 1,
        textTransform: "uppercase",
    },
    legacyPill: {
        backgroundColor: "rgba(255, 193, 7, 0.16)",
        borderColor: "rgba(255, 193, 7, 0.36)",
        borderWidth: 1,
        borderRadius: RADII.pill,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
    },
    legacyPillText: {
        color: COLORS.warning,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.xs + 1,
        textTransform: "uppercase",
    },
    branchLocation: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        marginTop: 4,
    },
    branchAddress: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.xs + 1,
        marginTop: 2,
    },
});

