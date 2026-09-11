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
        fontFamily: FONTS.heading,
        color: COLORS.accent,
    },
    calibrateBullet: {
        fontSize: 12,
        fontFamily: FONTS.body,
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
        fontFamily: FONTS.heading,
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
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    optionChipActive: {
        backgroundColor: COLORS.cardDark,
        borderColor: COLORS.accent,
    },
    optionChipText: {
        color: COLORS.muted,
        fontSize: 13,
        fontFamily: FONTS.body,
    },
    optionChipTextActive: {
        color: COLORS.text,
        fontWeight: 'bold',
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
        fontFamily: FONTS.heading,
        fontWeight: 'bold',
        fontSize: 15,
    },
    skillBadgeRating: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
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

