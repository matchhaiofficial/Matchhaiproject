import { StyleSheet } from "react-native";
import { Dimensions } from "react-native";
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from "../../src/theme";

const DRAWER_WIDTH = Math.min(420, Math.round(Dimensions.get("window").width * 0.94));

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
    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.sm,
        marginBottom: SPACING.md,
        width: "100%",
    },
    searchBar: {
        flex: 1,
        minWidth: 0,
        backgroundColor: COLORS.inputBackground,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: SPACING.md,
        height: 48,
    },
    searchInput: {
        flex: 1,
        minWidth: 0,
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.input,
        paddingVertical: 0,
        paddingHorizontal: SPACING.sm,
    },
    filterButton: {
        width: 48,
        height: 48,
        flexShrink: 0,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.inputBackground,
        alignItems: "center",
        justifyContent: "center",
    },
    filterButtonPressed: {
        opacity: 0.9,
    },
    filterBadge: {
        position: "absolute",
        top: -4,
        right: -4,
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: COLORS.accent,
        borderWidth: 2,
        borderColor: COLORS.backgroundDark,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 4,
    },
    filterBadgeText: {
        color: "#FFF",
        fontFamily: FONTS.heading,
        fontSize: 10,
        fontWeight: "700",
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
    cardActions: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACING.md,
        marginTop: 2,
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
    drawer: {
        width: DRAWER_WIDTH,
        flex: 1,
    },
    drawerContent: {
        flex: 1,
    },
    drawerBody: {
        gap: SPACING.md,
        paddingBottom: SPACING.lg,
    },
    drawerFooter: {
        backgroundColor: COLORS.cardDark,
    },
    drawerFooterRow: {
        flexDirection: "row",
        gap: SPACING.sm,
    },
    drawerFooterButton: {
        flex: 1,
    },
});
