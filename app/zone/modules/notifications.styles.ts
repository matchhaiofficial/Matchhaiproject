import { StyleSheet } from "react-native";
import { COLORS, FONTS, SPACING, TEXT_SIZES } from "../../../src/theme";

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    segmentTabs: {
        marginBottom: SPACING.md,
    },
    content: {
        paddingBottom: SPACING.xxl + 24,
        gap: SPACING.md,
    },
    clearActionRow: {
        marginBottom: SPACING.xs,
    },
    infoStack: {
        gap: SPACING.sm,
    },
    messageText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption + 1,
        lineHeight: 20,
    },
});
