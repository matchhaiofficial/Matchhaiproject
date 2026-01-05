import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        padding: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: 20,
        fontFamily: FONTS.heading,
    },
    backButton: {
        marginRight: SPACING.lg,
    },
    content: {
        padding: SPACING.lg,
    },
    sectionLabel: {
        color: COLORS.muted,
        fontSize: 14,
        fontFamily: FONTS.heading,
        marginBottom: SPACING.lg,
        marginTop: SPACING.sm,
        textTransform: "uppercase",
    },
    inputGroup: {
        marginBottom: SPACING.lg,
    },
    inputLabel: {
        color: COLORS.text,
        marginBottom: SPACING.sm,
        fontFamily: FONTS.body,
    },
    input: {
        backgroundColor: COLORS.inputBackground,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        borderRadius: RADII.sm,
        padding: SPACING.md,
        color: COLORS.text,
        fontSize: TEXT_SIZES.input,
        fontFamily: FONTS.body,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: "top",
    },
    row: {
        flexDirection: "row",
        gap: SPACING.md,
        marginBottom: SPACING.lg,
    },
    flex1: {
        flex: 1,
    },
    pickerContainer: {
        backgroundColor: COLORS.inputBackground,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        borderRadius: RADII.sm,
        overflow: 'hidden',
    },
    picker: {
        color: COLORS.text,
    },
    submitButton: {
        backgroundColor: COLORS.accent,
        padding: SPACING.lg,
        borderRadius: RADII.md,
        alignItems: "center",
        marginTop: SPACING.md,
    },
    submitButtonText: {
        color: "#fff",
        fontSize: 16,
        fontFamily: FONTS.heading,
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: COLORS.background,
    },
});
