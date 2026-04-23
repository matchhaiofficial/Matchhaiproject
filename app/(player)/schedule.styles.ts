import { StyleSheet } from "react-native";
import { COLORS, FONTS, SPACING } from "../../src/theme";

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    loaderWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    tabs: {
        marginBottom: SPACING.md,
    },
    content: {
        paddingBottom: SPACING.xxl,
        gap: SPACING.md,
    },
    timelineCard: {
        gap: SPACING.xs,
    },
    timelineTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: SPACING.sm,
    },
    timelineTitle: {
        flex: 1,
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 16,
    },
    timelineSubtitle: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 13,
        lineHeight: 20,
    },
    timelineMeta: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 12,
    },
    timelineCta: {
        marginTop: 4,
        color: COLORS.accent,
        fontFamily: FONTS.interSemiBold,
        fontSize: 13,
    },
    emptyCard: {
        alignItems: "center",
    },
    emptyTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 16,
        marginBottom: 6,
    },
    emptyText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 13,
        textAlign: "center",
    },
});
