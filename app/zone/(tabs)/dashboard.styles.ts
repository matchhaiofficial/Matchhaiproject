import { StyleSheet } from "react-native";
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from "../../../src/theme";
import { Dimensions } from "react-native";

const SCREEN_W = Dimensions.get("window").width;
const GRID_GAP = 8;
// No extra paddingHorizontal on the grid — parent container already has it
// Subtract a small buffer (12px each side) for the parent's padding
const CARD_W = (SCREEN_W - 24 - GRID_GAP) / 2.2;
const CARD_H = Math.round(CARD_W * 1.15);

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    screenContent: {
        flex: 1,        // ← add this
        paddingTop: 0,
        paddingBottom: 0,
    },
    container: {
        paddingBottom: 0,
    },
    zoneAdmincontainer: {
        paddingBottom: 300,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: COLORS.backgroundDark,
    },
    noZoneContainer: {
        flex: 1,
        justifyContent: "center",
        paddingBottom: SPACING.xl,
    },
    noZoneCard: {
        paddingVertical: SPACING.xxl,
    },
    rejectedReasonWrap: {
        marginTop: SPACING.md,
        alignItems: "center",
    },
    rejectReason: {
        color: COLORS.error,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        textAlign: "center",
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        backgroundColor: COLORS.cardDark,
    },
    iconButtonPressed: {
        opacity: 0.85,
    },
    headerActionsRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.sm,
    },
    notificationBadge: {
        position: "absolute",
        top: -4,
        right: -6,
        minWidth: 20,
        height: 20,
        paddingHorizontal: 4,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.error,
        borderWidth: 2,
        borderColor: COLORS.backgroundDark,
    },
    notificationBadgeText: {
        color: "#fff",
        fontFamily: FONTS.heading,
        fontSize: 11,
    },
    heroCard: {
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderRadius: 20,
        backgroundColor: COLORS.cardDark,
        padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    heroRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatarIconWrap: {
        width: 54,
        height: 54,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(66,165,245,0.15)",
        borderWidth: 1,
        borderColor: "rgba(66,165,245,0.38)",
    },
    heroTextWrap: {
        marginLeft: SPACING.md,
        flex: 1,
    },
    heroEyebrow: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.xs,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    heroTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.lg,
        marginTop: 2,
    },
    heroSubtitle: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        marginTop: 2,
    },
    tagsRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: SPACING.sm,
        gap: SPACING.sm,
    },
    coreGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: SPACING.sm,
        marginBottom: SPACING.md,
    },
    coreCard: {
        width: "48%",
    },
    section: {
        marginTop: SPACING.sm,
    },
    matchroomsWrap: {
        gap: SPACING.sm,
    },
    moduleGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: GRID_GAP,
    },
    moduleCard: {
        width: CARD_W,
        height: CARD_H,
        overflow: "hidden",  // clips content neatly if it overflows
    },
    opsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: GRID_GAP,
    },
    opsTile: {
        width: CARD_W,
        height: Math.round(CARD_W * 1.0), // slightly shorter for ops cards
        overflow: "hidden",
    },
});


