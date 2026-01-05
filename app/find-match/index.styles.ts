// app/find-match/index.styles.ts
import { StyleSheet } from 'react-native';
import {
    COLORS,
    RADII,
    SPACING,
    TEXT_SIZES
} from '../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    header: {
        padding: SPACING.lg,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },

    backButton: {
        marginRight: SPACING.lg,
    },

    headerTitle: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: 'bold',
    },

    scrollContent: {
        padding: SPACING.lg,
    },

    intro: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.label,
        marginBottom: SPACING.xxl,
        lineHeight: 20,
    },

    section: {
        marginBottom: SPACING.xxl,
    },

    sectionTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.subheading,
        fontWeight: 'bold',
        marginBottom: SPACING.md,
    },

    selectionGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm + 2,
    },

    selectionChip: {
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm + 2,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.divider,
        backgroundColor: COLORS.cardBackground,
    },

    selectionChipActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },

    selectionChipText: {
        color: COLORS.text,
        fontWeight: '600',
        fontSize: TEXT_SIZES.label,
    },

    selectionChipTextActive: {
        color: '#fff',
    },

    timeSelectionRow: {
        flexDirection: 'row',
        gap: SPACING.sm + 2,
    },

    timeButton: {
        flex: 1,
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.md,
        borderRadius: RADII.sm,
        alignItems: 'center',
        borderWidth: 1,
    },

    timeButtonActive: {
        borderColor: COLORS.accent,
    },

    timeButtonInactive: {
        borderColor: COLORS.divider,
    },

    timeButtonText: {
        fontSize: TEXT_SIZES.label,
    },

    timeButtonTextActive: {
        color: COLORS.text,
    },

    timeButtonTextInactive: {
        color: COLORS.muted,
    },

    submitButton: {
        backgroundColor: COLORS.accent,
        padding: SPACING.lg,
        borderRadius: RADII.md,
        alignItems: 'center',
        marginTop: SPACING.xl,
    },

    submitButtonPressed: {
        opacity: 0.92,
    },

    submitButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
