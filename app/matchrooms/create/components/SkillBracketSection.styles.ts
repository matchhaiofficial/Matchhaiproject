import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SPACING } from '../../../../src/theme';

export default StyleSheet.create({
    container: {
        marginBottom: SPACING.lg,
    },
    calibrateContainer: {
        width: '100%',
        backgroundColor: 'rgba(66, 165, 245, 0.05)',
        borderRadius: RADII.lg,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: 'rgba(66, 165, 245, 0.2)',
        marginBottom: SPACING.lg,
    },
    calibrateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    calibrateTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.accent,
    },
    calibrateBullet: {
        fontSize: 12,
        color: COLORS.muted,
        marginLeft: SPACING.sm,
    },
    calibrateDescription: {
        color: COLORS.textSecondary,
        fontSize: 12,
        lineHeight: 18,
        marginBottom: SPACING.md,
    },
    calibrateButton: {
        backgroundColor: COLORS.accent,
        borderRadius: RADII.md,
        paddingVertical: 12,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calibrateButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    sectionLabel: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 15,
        marginBottom: SPACING.md,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm,
    },
    optionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.cardBackground,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    optionChipActive: {
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
        borderColor: COLORS.accent,
    },
    optionChipText: {
        color: COLORS.muted,
        fontSize: 13,
    },
    optionChipTextActive: {
        color: COLORS.text,
        fontWeight: '600',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    // Skill Badge / Case A
    skillBadge: {
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        padding: 12,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.2)',
    },
    skillBadgeText: {
        color: COLORS.text,
        fontWeight: 'bold',
        fontSize: 15,
    },
    skillBadgeRating: {
        color: COLORS.muted,
        fontSize: 12,
        marginTop: 2,
    },
    helperTiny: {
        color: COLORS.muted,
        fontSize: 11,
        marginTop: 6,
    },
    loaderContainer: {
        padding: 20,
        alignItems: 'center',
    },
});

