import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: SPACING.screenPadding,
        paddingBottom: SPACING.md,
        backgroundColor: COLORS.backgroundDark,
    },
    backButton: {
        marginRight: SPACING.md,
        padding: SPACING.xs,
    },
    headerTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
    },
    appHeader: {
        paddingHorizontal: SPACING.screenPadding,
        paddingBottom: SPACING.md,
        marginBottom: 0,
        backgroundColor: COLORS.backgroundDark,
    },
    saveButton: {
        marginLeft: 'auto',
        minHeight: 38,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs + 1,
        backgroundColor: COLORS.accent,
        borderRadius: RADII.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: TEXT_SIZES.label,
        fontFamily: FONTS.heading,
        fontWeight: '600',
    },
    saveButtonDisabled: {
        backgroundColor: COLORS.cardBorder,
        opacity: 0.5,
    },
    saveButtonPressed: {
        opacity: 0.9,
    },

    scrollContent: {
        padding: SPACING.screenPadding,
        paddingBottom: SPACING.screenPadding + SPACING.xxl,
    },

    sectionTitle: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.label,
        fontFamily: FONTS.heading,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: SPACING.md,
        marginTop: SPACING.lg,
    },

    // Form Fields
    fieldGroup: {
        marginBottom: SPACING.lg,
    },
    label: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.label,
        fontFamily: FONTS.body,
        marginBottom: SPACING.xs,
        marginLeft: 4,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.inputBackground,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        borderRadius: RADII.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
    },
    input: {
        flex: 1,
        color: COLORS.text,
        fontSize: TEXT_SIZES.input,
        fontFamily: FONTS.body,
        paddingVertical: SPACING.sm + 2,
    },
    helperText: {
        fontSize: TEXT_SIZES.caption,
        marginTop: 4,
        marginLeft: 4,
    },
    helperWarning: {
        color: COLORS.warning,
    },
    helperError: {
        color: COLORS.error,
    },
    helperOk: {
        color: COLORS.success,
    },

    // Platform Input
    platformInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    platformIcon: {
        width: 40,
        height: 40,
        borderRadius: RADII.sm,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.sm,
    },
    steamIcon: {
        backgroundColor: 'rgba(102, 192, 244, 0.1)',
        borderWidth: 1,
        borderColor: COLORS.steamBorder,
    },
    faceitIcon: {
        backgroundColor: 'rgba(255, 85, 0, 0.1)',
        borderWidth: 1,
        borderColor: COLORS.faceitBorder,
    },
    platformField: {
        flex: 1,
    },

    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },

    // Verification Button Styles
    platformButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.cardBackground,
        paddingVertical: 14,
        marginTop: SPACING.sm,
    },
    platformButtonActive: {
        borderColor: COLORS.accent,
        backgroundColor: "#1e2a38",
    },
    platformButtonText: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
    },

    // Verified Summary Styles
    summaryLabel: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        marginBottom: 2,
    },
    summaryValue: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.label - 1,
    },

    // Password Strength
    passwordStrengthWrapper: {
        marginTop: SPACING.sm,
        marginBottom: SPACING.xs,
    },
    strengthMeterTrack: {
        height: 4,
        borderRadius: 999,
        backgroundColor: "#3a3a3a",
        overflow: "hidden",
    },
    strengthMeterFill: {
        height: "100%",
        borderRadius: 999,
    },
    strengthLabel: {
        marginTop: SPACING.xs,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        fontWeight: '600',
    },
    passwordRequirementsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: SPACING.xs,
    },
    requirementColumn: {
        flex: 1,
    },
    passwordRequirementText: {
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        color: COLORS.muted,
        marginBottom: 2,
    },
    passwordRequirementTextDone: {
        color: COLORS.success,
    },

    // Password Action Buttons
    passwordUpdateButton: {
        flex: 1,
        backgroundColor: COLORS.accent,
        borderRadius: RADII.md,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    passwordUpdateButtonDisabled: {
        backgroundColor: COLORS.inputBorder,
        opacity: 0.6,
    },
    passwordCancelButton: {
        flex: 1,
        backgroundColor: 'transparent',
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        paddingVertical: SPACING.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    passwordButtonText: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
        fontWeight: '600',
    },

    // Area Chips
    areaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.cardBackground,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        marginRight: SPACING.sm,
        marginBottom: SPACING.xs,
    },
    areaChipActive: {
        backgroundColor: '#1e2a38',
        borderColor: COLORS.accent,
    },
    areaChipText: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.label - 1,
    },
    areaChipTextActive: {
        color: COLORS.text,
        fontWeight: '600',
    },

    // Privacy Toggles
    privacySection: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: RADII.lg,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        marginBottom: SPACING.xl,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    toggleInfo: {
        flex: 1,
        marginRight: SPACING.md,
    },
    toggleLabel: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.label,
        fontFamily: FONTS.bold,
        marginBottom: 2,
    },
    toggleSubtext: {
        color: COLORS.muted,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
    },
    // New Styles
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.backgroundDark,
    },
    disabledInput: {
        opacity: 0.6,
    },
    mutedHelperText: {
        fontSize: TEXT_SIZES.caption,
        marginTop: 4,
        marginLeft: 4,
        color: COLORS.muted,
        fontFamily: FONTS.body,
    },
    flexRowCentered: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconMarginRight: {
        marginRight: 8,
        opacity: 0.9,
    },
    pendingEmailContainer: {
        marginTop: 8,
        padding: 12,
        backgroundColor: COLORS.warning + '20',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.warning + '40',
    },
    pendingEmailHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    pendingEmailTitle: {
        color: COLORS.warning,
        fontSize: 13,
        fontWeight: '600',
        fontFamily: FONTS.heading,
    },
    pendingEmailText: {
        color: COLORS.text,
        fontSize: 12,
        marginTop: 4,
        fontFamily: FONTS.body,
    },
    marginTopSm: {
        marginTop: 8,
    },
    gapMdRow: {
        flexDirection: 'row',
        gap: 12,
    },
    gapMd: {
        gap: 12,
    },
    inputWithIcon: {
        flex: 1,
        color: COLORS.text,
        fontSize: TEXT_SIZES.input,
        fontFamily: FONTS.body,
        paddingVertical: SPACING.sm + 2,
        paddingRight: 40,
    },
    marginLeftSm: {
        marginLeft: 8,
    },
    marginTopNone: {
        marginTop: 0,
    },
    inputWithToggle: {
        flex: 1,
        color: COLORS.text,
        fontSize: TEXT_SIZES.input,
        fontFamily: FONTS.body,
        paddingVertical: SPACING.sm + 2,
        paddingRight: 44,
    },
    togglePosition: {
        position: 'absolute',
        right: 12,
    },
    passwordActionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
    preferredAreasHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    labelNoMargin: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.label,
        fontFamily: FONTS.body,
        marginLeft: 4,
    },
    selectedCountText: {
        fontSize: 12,
        fontWeight: '600',
        fontFamily: FONTS.body,
        color: COLORS.muted,
    },
    warningText: {
        color: COLORS.warning,
    },
    flexWrapRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    borderBottomNone: {
        borderBottomWidth: 0,
    },
    verifiedSummaryContainer: {
        marginTop: 8,
        paddingHorizontal: 4,
    },
    flexColumn: {
        flexDirection: "column",
    },
    accentBoldText: {
        color: COLORS.accent,
        fontWeight: "600",
    },
    psnSubValue: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: 11,
    },
    flex1: {
        flex: 1,
    },
    marginBottomLg: {
        marginBottom: 24,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        paddingVertical: 8,
        borderRadius: RADII.md,
    },
    friendBadge: {
        backgroundColor: COLORS.success + '20',
    },
    pendingBadge: {
        backgroundColor: COLORS.warning + '20',
    },
    statusBadgeText: {
        marginLeft: 8,
        fontSize: TEXT_SIZES.label,
        fontFamily: FONTS.bold,
    },
    mainButton: {
        flexDirection: 'row',
        height: 50,
        backgroundColor: COLORS.accent,
        borderRadius: RADII.md,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    mainButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        fontFamily: FONTS.heading,
    },
});

