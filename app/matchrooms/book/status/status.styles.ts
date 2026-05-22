import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../../src/theme';

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    screenContent: {
        paddingBottom: 0,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundDark,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.screenPadding,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.overlayLight,
        backgroundColor: COLORS.backgroundDark,
    },
    backButton: {
        marginRight: SPACING.md,
        padding: 4,
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.subheading,
        fontFamily: FONTS.heading,
    },
    body: {
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    content: {
        alignItems: 'stretch',
        paddingBottom: SPACING.lg,
    },
    statusDisplay: {
        width: '100%',
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    statusPill: {
        marginTop: SPACING.sm,
    },
    statusIconBg: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
        backgroundColor: COLORS.overlayLight,
    },
    statusTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.xxl,
        fontFamily: FONTS.heading,
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    timerPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.accent + '20',
        paddingHorizontal: SPACING.md,
        paddingVertical: 6,
        borderRadius: RADII.pill,
        gap: 6,
    },
    timerText: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.body,
    },

    // Card Styles
    card: {
        width: '100%',
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        marginBottom: SPACING.lg,
        ...SHADOWS.cardSoft,
    },
    sectionCardSpacing: {
        marginBottom: SPACING.lg,
    },
    cardTitle: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.heading,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: SPACING.lg,
    },

    // Stepper
    stepper: {
        gap: 0,
    },
    stepContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.md,
        minHeight: 58,
    },
    stepLineWrapper: {
        alignItems: 'center',
        height: '100%',
    },
    stepIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.backgroundDark,
        borderWidth: 2,
        borderColor: COLORS.cardBorder,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    stepIconApproved: {
        backgroundColor: COLORS.success,
        borderColor: COLORS.success,
    },
    stepIconPending: {
        borderColor: COLORS.accent,
    },
    stepIconDeclined: {
        backgroundColor: COLORS.error,
        borderColor: COLORS.error,
    },
    idleDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.disabled,
    },
    stepLine: {
        width: 2,
        flex: 1,
        backgroundColor: COLORS.cardBorder,
        marginVertical: -2,
    },
    stepLineActive: {
        backgroundColor: COLORS.success,
    },
    stepLabel: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
        marginTop: 2,
    },
    stepLabelActive: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
    },
    stepLabelDeclined: {
        color: COLORS.error,
    },

    // Details Area
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },
    detailLabel: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.body,
    },
    detailValue: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
    },
    totalAmount: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.xl,
        fontFamily: FONTS.heading,
    },
    expiredHint: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        textAlign: 'center',
        marginTop: SPACING.md,
        fontStyle: 'italic',
    },
    orderRow: {
        marginTop: SPACING.md,
        alignItems: 'flex-start',
        gap: SPACING.md,
    },
    orderLabel: {
        flex: 0,
    },
    orderValue: {
        flex: 1,
        textAlign: 'right',
    },
    settlementRow: {
        alignItems: 'flex-start',
        gap: SPACING.lg,
    },
    settlementLabel: {
        flex: 0,
        minWidth: 56,
    },
    settlementValue: {
        flex: 1,
        textAlign: 'right',
        lineHeight: 18,
    },

    // Footer Actions
    footer: {
        gap: SPACING.md,
        width: '100%',
    },
    bottomActionContent: {
        gap: SPACING.md,
    },
    footerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        width: '100%',
    },
    secondaryAction: {
        flex: 1,
    },
    primaryBtn: {
        height: 56,
        width: '100%',
        backgroundColor: COLORS.accent,
        borderRadius: RADII.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        ...SHADOWS.accentStrong,
    },
    primaryBtnText: {
        color: '#FFF',
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
        fontWeight: 'bold',
    },
    secondaryBtn: {
        height: 56,
        width: '100%',
        backgroundColor: 'transparent',
        borderRadius: RADII.lg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    secondaryBtnText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
    },
    secondaryDangerText: {
        color: COLORS.error,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
    },
});
