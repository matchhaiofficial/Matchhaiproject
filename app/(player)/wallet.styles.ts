import { StyleSheet } from "react-native";
import { COLORS, FONTS, RADII, SPACING } from "../../src/theme";

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    tabs: {
        marginBottom: SPACING.md,
    },
    content: {
        paddingBottom: SPACING.xxl,
    },
    summaryCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
    },
    summaryTitle: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 12,
        textTransform: "uppercase",
        marginBottom: 4,
    },
    summaryValue: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 30,
    },
    summarySubText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 12,
        marginTop: 4,
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: SPACING.md,
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        padding: SPACING.md,
        marginRight: SPACING.sm,
    },
    statCardLast: {
        marginRight: 0,
    },
    statLabel: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 11,
        marginBottom: 4,
    },
    statValue: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 18,
    },
    transactionCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
    },
    transactionTopRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
    },
    transactionTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 14,
        flex: 1,
        marginRight: SPACING.sm,
    },
    transactionAmount: {
        color: COLORS.successBright,
        fontFamily: FONTS.heading,
        fontSize: 13,
    },
    transactionMeta: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: 12,
        marginBottom: 2,
    },
    statusPill: {
        alignSelf: "flex-start",
        marginTop: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: RADII.pill,
        borderWidth: 1,
    },
    statusText: {
        fontFamily: FONTS.body,
        fontSize: 10,
        textTransform: "uppercase",
        fontWeight: "700",
    },
    emptyCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        padding: SPACING.lg,
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
