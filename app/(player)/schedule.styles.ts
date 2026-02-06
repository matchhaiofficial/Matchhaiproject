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
