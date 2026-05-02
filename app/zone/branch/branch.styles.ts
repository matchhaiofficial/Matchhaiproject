import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        padding: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: 20,
        fontFamily: FONTS.heading,
    },
    appHeader: {
        paddingHorizontal: SPACING.screenPadding,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
        marginBottom: 0,
    },
    backButton: {
        marginRight: SPACING.lg,
    },
    content: {
        padding: SPACING.lg,
        paddingBottom: SPACING.lg + SPACING.xxl,
    },
    sectionLabel: {
        color: COLORS.muted,
        fontSize: 14,
        fontFamily: FONTS.heading,
        marginBottom: SPACING.md,
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
        borderRadius: RADII.md,
        minHeight: 48,
        paddingHorizontal: SPACING.md,
        paddingVertical: 0,
        color: COLORS.text,
        fontSize: TEXT_SIZES.input,
        lineHeight: 20,
        fontFamily: FONTS.body,
        includeFontPadding: false,
        textAlignVertical: "center",
    },
    textArea: {
        minHeight: 80,
        paddingVertical: SPACING.sm,
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
        borderRadius: RADII.md,
        overflow: 'hidden',
    },
    picker: {
        color: COLORS.text,
        height: 48,
    },
    submitButton: {
        backgroundColor: COLORS.accent,
        height: 46,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
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
        backgroundColor: COLORS.backgroundDark,
    },
});
