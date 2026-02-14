// app/matchrooms/create/create.styles.ts
import { StyleSheet } from 'react-native';
import { COLORS, CTA, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        flexGrow: 1,
    },
    createNonScrollContent: {
        flex: 1,
        paddingBottom: 0,
    },
    createPageLayout: {
        flex: 1,
        position: 'relative',
    },
    createScrollView: {
        flex: 1,
    },
    createScrollContent: {
        flexGrow: 1,
        paddingBottom: SPACING.xxl,
    },

    // Header
    header: {
        marginBottom: SPACING.lg,
    },
    headerTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.heading,
        fontWeight: '700',
        marginBottom: SPACING.xs,
    },
    headerSubtitle: {
        color: COLORS.muted,
        fontFamily: FONTS.subheading,
        fontSize: TEXT_SIZES.subheading,
    },

    tabContainer: {
        flexDirection: 'row',
        gap: SPACING.md,
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
    sectionTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
        fontWeight: '700',
    },
    fieldLabel: {
        color: 'rgba(253, 253, 253, 0.85)',
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.label - 1,
        marginBottom: 6,
    },
    requiredAsterisk: {
        color: COLORS.error,
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
        marginBottom: SPACING.lg,
    },
    input: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.input,
        paddingVertical: SPACING.sm + 1,
    },
    inputPicker: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
        marginTop: SPACING.md,
        marginBottom: SPACING.lg,
    },
    submitSummaryWrapper: {
        marginTop: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    stickyFooter: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        elevation: 30,
        borderTopWidth: 1,
        borderTopColor: COLORS.cardBorder,
        backgroundColor: COLORS.background,
        paddingTop: SPACING.md,
        paddingHorizontal: 0,
    },
    primaryButton: {
        ...CTA.primaryButton,
    },
    primaryButtonDisabled: {
        ...CTA.primaryButtonDisabled,
    },
    primaryButtonPressed: {
        ...CTA.primaryButtonPressed,
    },
    primaryButtonText: {
        ...CTA.primaryButtonText,
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
    modalItemTextActive: {
        color: COLORS.accent,
        fontWeight: 'bold',
        fontFamily: FONTS.heading,
    },
    modalItemSubtitle: {
        color: COLORS.muted,
        fontSize: 11,
        marginTop: 2,
        fontFamily: FONTS.body,
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
    walkInRosterWrap: {
        marginTop: SPACING.md,
    },
    walkInPlayerCard: {
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        borderRadius: RADII.md,
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
    },
    walkInPlayerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
    },
    walkInPlayerTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.caption + 1,
    },
    walkInCaptainChip: {
        marginRight: 0,
        marginBottom: 0,
        paddingVertical: 6,
    },
    submitHintText: {
        marginTop: 10,
        textAlign: 'center',
        color: COLORS.warning,
    },
    accentText: {
        color: COLORS.accent,
    },
    italicHelper: {
        fontSize: 12,
        color: COLORS.muted,
        marginTop: 6,
        fontStyle: 'italic',
        fontFamily: FONTS.body,
    },

    // Info Boxes
    infoBox: {
        marginBottom: SPACING.sm,
        padding: 12,
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(66, 165, 245, 0.3)',
    },
    summaryCard: {
        marginBottom: SPACING.sm,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    infoBoxText: {
        color: COLORS.text,
        fontSize: 13,
        fontFamily: FONTS.body,
        lineHeight: 18,
    },
    infoBoxTitle: {
        color: COLORS.text,
        fontSize: 12,
        fontFamily: FONTS.heading,
        marginBottom: 4,
    },
    infoBoxSmall: {
        color: COLORS.muted,
        fontSize: 11,
        fontFamily: FONTS.body,
    },
    flex1Center: {
        flex: 1,
        justifyContent: 'center',
    },
    mutedText: {
        color: COLORS.muted,
    },
    emptyContainer: {
        paddingVertical: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        color: COLORS.muted,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 20,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
    },
    actionButton: {
        backgroundColor: COLORS.accent,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: RADII.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionButtonText: {
        color: COLORS.background,
        fontSize: TEXT_SIZES.body,
        fontWeight: 'bold',
        fontFamily: FONTS.heading,
    },
    noResultsText: {
        color: COLORS.muted,
        fontSize: 12,
        marginTop: 8,
        fontFamily: FONTS.body,
    },
    zoneListScroll: {
        maxHeight: 300,
    },
    zoneInfoWrapper: {
        flex: 1,
        maxWidth: '65%',
        marginRight: 12,
    },
    zonePriceWrapper: {
        alignItems: 'flex-end',
        minWidth: 80,
    },
    memberGrid: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.md,
    },
    memberCard: {
        width: '47.5%',
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        padding: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        ...SHADOWS.cardSoft,
    },
    memberCardSelected: {
        borderColor: COLORS.accent,
        backgroundColor: `${COLORS.accent}12`,
    },
    memberAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.surfaceHighlight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: COLORS.accent,
    },
    memberAvatarText: {
        fontSize: TEXT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.text,
    },
    memberInfo: {
        flex: 1,
        gap: 4,
    },
    memberName: {
        fontSize: TEXT_SIZES.label,
        color: COLORS.text,
        fontWeight: '600',
    },
    memberRoleBadge: {
        alignSelf: 'flex-start',
    },
    memberRoleText: {
        fontSize: TEXT_SIZES.xs,
        color: COLORS.accent,
        backgroundColor: `${COLORS.accent}15`,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: RADII.xs,
        overflow: 'hidden',
    },
    marginTop12: {
        marginTop: 12,
    },
    creationHelperText: {
        color: COLORS.muted,
        fontSize: 12,
        marginBottom: 8,
        fontFamily: FONTS.body,
    },
    pickerOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingHorizontal: SPACING.md,
        paddingBottom: SPACING.md,
    },
    pickerBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    pickerSheet: {
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: RADII.lg,
        borderTopRightRadius: RADII.lg,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        ...SHADOWS.cardElevated,
    },
    pickerHandle: {
        width: 44,
        height: 5,
        borderRadius: 999,
        backgroundColor: COLORS.cardBorder,
        alignSelf: 'center',
        marginBottom: SPACING.sm,
    },
    pickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
    },
    pickerTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
        fontWeight: '700',
    },
    pickerAction: {
        color: COLORS.accent,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.label,
    },
    calendarContainer: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.md,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
    },
    calendarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
    },
    calendarNavButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.cardDark,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
    },
    calendarNavText: {
        color: COLORS.text,
        fontSize: 18,
        fontFamily: FONTS.heading,
    },
    calendarTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
        fontWeight: '700',
    },
    weekdayRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.xs,
    },
    weekdayLabel: {
        width: '14.28%',
        textAlign: 'center',
        color: COLORS.muted,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
        borderRadius: RADII.sm,
    },
    dayCellDisabled: {
        opacity: 0.35,
    },
    dayCellSelected: {
        borderWidth: 1,
        borderColor: COLORS.accent,
        backgroundColor: 'transparent',
    },
    dayText: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
    },
    dayTextDisabled: {
        color: COLORS.muted,
    },
    dayTextSelected: {
        color: COLORS.text,
        fontWeight: '700',
    },
    timePickerRow: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.sm,
    },
    timeColumn: {
        flex: 1,
        gap: SPACING.sm,
    },
    timeOption: {
        paddingVertical: 10,
        borderRadius: RADII.md,
        backgroundColor: COLORS.cardBackground,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        alignItems: 'center',
    },
    timeOptionActive: {
        backgroundColor: 'transparent',
        borderColor: COLORS.accent,
    },
    timeOptionText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
    },
    timeOptionTextActive: {
        color: COLORS.text,
        fontWeight: '700',
    },
});

