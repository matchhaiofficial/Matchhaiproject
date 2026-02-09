import { StyleSheet } from "react-native";
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from "../../../theme";

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    heroCard: {
        backgroundColor: COLORS.cardDark,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderRadius: 20,
        padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    heroTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
    },
    heroSubtitle: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        marginTop: SPACING.xs,
        lineHeight: 18,
    },
    content: {
        paddingBottom: SPACING.xxl + 24,
    },
    blockCard: {
        backgroundColor: COLORS.cardDark,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        borderRadius: 20,
        padding: SPACING.md,
        marginBottom: SPACING.md,
    },
    blockTitle: {
        color: COLORS.text,
        fontFamily: FONTS.montserratSemiBold,
        fontSize: TEXT_SIZES.body,
        marginBottom: SPACING.sm,
    },
    blockPointRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginBottom: SPACING.xs,
    },
    blockPointText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        lineHeight: 18,
        marginLeft: SPACING.sm,
        flex: 1,
    },
    footerHintCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(66,165,245,0.16)",
        borderWidth: 1,
        borderColor: "rgba(66,165,245,0.32)",
        borderRadius: 16,
        padding: SPACING.md,
    },
    footerHintText: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        marginLeft: SPACING.sm,
        flex: 1,
    },
});
