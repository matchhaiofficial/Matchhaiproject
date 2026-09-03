import { StyleSheet } from "react-native";
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from "../../src/theme";

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    loadingWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    content: {
        padding: SPACING.screenPadding,
        paddingBottom: SPACING.xxl,
        gap: SPACING.md,
    },
    emptyCard: {
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        padding: SPACING.xl,
    },
    emptyTitle: {
        marginTop: SPACING.sm,
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
    },
    emptyText: {
        marginTop: 6,
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        textAlign: "center",
    },
    card: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        padding: SPACING.md,
        width: "100%",
        alignSelf: "stretch",
        ...SHADOWS.cardElevated,
    },
    cardPressed: {
        opacity: 0.9,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: SPACING.xs,
        gap: SPACING.sm,
    },
    title: {
        flex: 1,
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },
    status: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
        fontSize: 11,
        textTransform: "uppercase",
    },
    meta: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        marginTop: 3,
    },
    linkRow: {
        marginTop: SPACING.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    linkText: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.caption,
    },
});

