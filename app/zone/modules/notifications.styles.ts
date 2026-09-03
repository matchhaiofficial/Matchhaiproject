import { StyleSheet } from "react-native";
import { COLORS, FONTS, RADII, SHADOWS, SPACING } from "../../../src/theme";

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    segmentTabs: {
        marginTop: SPACING.md,
    },
    content: {
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.xxl + 24,
    },
    markAllReadButton: {
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    markAllReadText: {
        color: COLORS.accent,
        fontSize: 13,
        fontWeight: "700",
    },
    notificationCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        padding: SPACING.md + 2,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        ...SHADOWS.cardSoft,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: SPACING.sm,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        marginRight: SPACING.md,
        backgroundColor: "rgba(66, 165, 245, 0.1)",
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.accent,
        position: "absolute",
        left: -4,
        top: "50%",
        marginTop: -4,
    },
    headerInfo: {
        flex: 1,
        minWidth: 0,
    },
    typeText: {
        color: COLORS.text,
        fontSize: 15,
        fontFamily: FONTS.heading,
        fontWeight: "700",
    },
    timeText: {
        color: COLORS.muted,
        fontSize: 11,
        fontFamily: FONTS.body,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: RADII.pill,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
    },
    statusText: {
        color: COLORS.textSecondary,
        fontSize: 10,
        fontFamily: FONTS.heading,
        textTransform: "uppercase",
    },
    cardBody: {
        backgroundColor: "rgba(255, 255, 255, 0.035)",
        padding: SPACING.md,
        borderRadius: RADII.md + 2,
        marginBottom: SPACING.sm,
    },
    messageText: {
        color: COLORS.textSecondary,
        fontSize: 14,
        lineHeight: 20,
        fontFamily: FONTS.body,
    },
    metaText: {
        color: COLORS.muted,
        fontSize: 12,
        lineHeight: 18,
        fontFamily: FONTS.body,
        marginTop: 6,
    },
    actionRow: {
        flexDirection: "row",
        gap: SPACING.sm,
        marginTop: SPACING.xs,
    },
    actionButton: {
        flex: 1,
    },
});
