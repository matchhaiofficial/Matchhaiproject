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
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "center",
        padding: SPACING.lg,
    },
    modalContent: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.md,
        maxHeight: "60%",
        overflow: "hidden",
    },
    modalHeader: {
        padding: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.inputBorder,
    },
    modalTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },
    optionItem: {
        paddingVertical: 14,
        paddingHorizontal: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: "#333",
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
