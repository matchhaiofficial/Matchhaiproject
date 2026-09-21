import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from '../theme';

export default StyleSheet.create({
    container: {
        marginBottom: SPACING.md,
    },
    label: {
        color: "rgba(253, 253, 253, 0.85)",
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.label - 1,
        marginBottom: SPACING.xs,
    },
    inputBox: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: RADII.md,
        paddingHorizontal: SPACING.md,
        height: 50,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        flexDirection: "row",
        alignItems: "center",
    },
    prefixIcon: {
        marginRight: SPACING.sm,
        opacity: 0.9,
    },
    input: {
        flex: 1,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.input,
    },
    modalBodyContent: {
        paddingTop: SPACING.xs,
        paddingBottom: SPACING.xs,
    },
    searchBox: {
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        borderRadius: RADII.md,
        backgroundColor: COLORS.inputBackground,
        paddingHorizontal: SPACING.md,
        marginBottom: SPACING.sm,
    },
    searchInput: {
        flex: 1,
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
        paddingVertical: SPACING.sm,
    },
    emptyText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
        textAlign: "center",
        paddingVertical: SPACING.xl,
    },
    optionItem: {
        paddingVertical: SPACING.md + 2,
        paddingHorizontal: SPACING.xs,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.inputBorder,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    optionText: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
    },
    optionTextSelected: {
        color: COLORS.accent,
        fontFamily: FONTS.bold,
    },
});
