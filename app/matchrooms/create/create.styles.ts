// app/matchrooms/create/create.styles.ts
import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        flexGrow: 1,
        padding: SPACING.screenPadding,
    },

    // Header
    header: {
        marginBottom: SPACING.lg,
    },
    headerTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.heading,
        marginBottom: SPACING.xs,
    },
    headerSubtitle: {
        color: COLORS.muted,
        fontFamily: FONTS.subheading,
        fontSize: TEXT_SIZES.subheading,
    },

    // Section
    section: {
        marginBottom: SPACING.lg,
    },
    sectionLabel: {
        color: 'rgba(253, 253, 253, 0.85)',
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.label - 1,
        marginBottom: SPACING.sm,
    },

    // Game cards
    gameGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginHorizontal: -SPACING.xs,
    },
    gameCard: {
        width: '48%',
        marginHorizontal: '1%',
        marginBottom: SPACING.sm,
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.md,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        alignItems: 'center',
    },
    gameCardActive: {
        backgroundColor: '#1e2a38',
        borderColor: COLORS.accent,
    },
    gameIcon: {
        marginBottom: SPACING.xs,
    },
    gameName: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        textAlign: 'center',
    },
    gameNameActive: {
        color: COLORS.text,
    },

    // Role chips (read-only)
    rolesContainer: {
        marginTop: SPACING.sm,
    },
    roleChipReadOnly: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.accent,
        backgroundColor: '#1e2a38',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm - 1,
        marginRight: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    roleChipTextReadOnly: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.label - 1,
    },

    // Input Box (reuse from register)
    inputBox: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: RADII.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
    },
    input: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.input,
        paddingVertical: SPACING.sm + 1,
    },

    // Chip Row (multi-select)
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: SPACING.sm,
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
        marginRight: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    optionChipActive: {
        backgroundColor: COLORS.cardDark,
        borderColor: COLORS.accent,
    },
    optionChipText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: 13,
    },
    optionChipTextActive: {
        color: COLORS.text,
        fontWeight: 'bold',
    },

    // Button
    buttonWrapper: {
        marginTop: SPACING.lg + SPACING.md,
        marginBottom: SPACING.xxl,
    },
    primaryButton: {
        backgroundColor: COLORS.accent,
        borderRadius: RADII.lg,
        paddingVertical: SPACING.lg - 2,
        alignItems: 'center',
        ...SHADOWS.accentStrong,
    },
    primaryButtonDisabled: {
        backgroundColor: COLORS.inputBorder,
        ...SHADOWS.cardElevated,
    },
    primaryButtonText: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },

    // Zone Cards (New)
    zoneCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    zoneCardActive: {
        backgroundColor: '#1e2a38',
        borderColor: COLORS.accent,
    },
    zoneName: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
        marginBottom: 2,
    },
    zoneDetail: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
    },
    zonePrice: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        padding: SPACING.md,
    },
    modalContainer: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.lg,
        maxHeight: '80%',
        width: '100%',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.inputBorder,
    },
    modalTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },
    modalSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBackground,
        margin: SPACING.md,
        paddingHorizontal: SPACING.md,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
    },
    modalSearchInput: {
        flex: 1,
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.input,
        paddingVertical: SPACING.sm,
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.inputBorder,
    },
    modalItemText: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
    },

    // Calibrate Level
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
    calibrateButton: {
        backgroundColor: COLORS.accent,
        borderRadius: RADII.md,
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.sm,
    },
    calibrateButtonText: {
        color: '#fff',
        fontWeight: 'bold',
    },

    // Layout Helpers
    flex1: {
        flex: 1,
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    row: {
        flexDirection: 'row',
    },
    gap8: {
        gap: 8,
    },
    marginBottom8: {
        marginBottom: 8,
    },
    marginBottom16: {
        marginBottom: 16,
    },
    marginLeft4: {
        marginLeft: 4,
    },
    marginLeft8: {
        marginLeft: 8,
    },
    marginTop4: {
        marginTop: 4,
    },
    marginTop8: {
        marginTop: 8,
    },
    helperText: {
        color: COLORS.muted,
        fontSize: 12,
    },
    helperTextTiny: {
        color: COLORS.muted,
        fontSize: 11,
    },
    accentText: {
        color: COLORS.accent,
    },

    // Info Boxes
    infoBox: {
        marginBottom: 16,
        padding: 12,
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(66, 165, 245, 0.3)',
    },
    infoBoxText: {
        color: COLORS.text,
        fontSize: 13,
        fontFamily: FONTS.body, // Standard fallback
        lineHeight: 18,
    },
});

