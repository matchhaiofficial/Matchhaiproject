import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../../src/theme';

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.screenPadding,
        paddingVertical: SPACING.md,
        backgroundColor: COLORS.backgroundDark,
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
        padding: SPACING.screenPadding,
        paddingBottom: SPACING.xl,
    },

    // Payment Card
    paymentCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        ...SHADOWS.cardSoft,
    },
    label: {
        color: COLORS.textSecondary,
        fontSize: 10,
        fontFamily: FONTS.heading,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: SPACING.md,
    },
    methodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundDark,
        padding: SPACING.md,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.accent + '30',
    },
    methodText: {
        flex: 1,
        marginLeft: SPACING.md,
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
    },

    infoBox: {
        flexDirection: 'row',
        backgroundColor: COLORS.accent + '10',
        padding: SPACING.md,
        borderRadius: RADII.md,
        marginTop: SPACING.xl,
        marginBottom: SPACING.lg,
        gap: SPACING.sm,
        borderWidth: 1,
        borderColor: COLORS.accent + '20',
    },
    infoText: {
        flex: 1,
        color: COLORS.accent,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
        lineHeight: 20,
    },

    // Success State
    successContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    successCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.success,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xl,
        ...SHADOWS.cardElevated,
    },
    successTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.xxl,
        fontFamily: FONTS.heading,
        marginBottom: SPACING.sm,
    },
    successSubtitle: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
        textAlign: 'center',
    },

    // Footer
    payBtn: {
        height: 56,
        backgroundColor: COLORS.accent,
        borderRadius: RADII.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.xl,
        ...SHADOWS.accentStrong,
    },
    payBtnDisabled: {
        backgroundColor: COLORS.disabled,
        shadowOpacity: 0,
        elevation: 0,
    },
    payBtnText: {
        color: '#FFF',
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
        fontWeight: 'bold',
    },

    // New styles for the improved Review & Pay screen
    amountCard: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        padding: SPACING.xl,
        alignItems: 'center',
        marginBottom: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        ...SHADOWS.cardSoft,
    },
    amountLabel: {
        color: COLORS.textSecondary,
        fontSize: 10,
        fontFamily: FONTS.heading,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: SPACING.sm,
    },
    amountValue: {
        color: COLORS.text,
        fontSize: 32,
        fontFamily: FONTS.heading,
        marginBottom: 4,
    },
    seatCount: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.heading,
    },
    card: {
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
        fontSize: 10,
        fontFamily: FONTS.heading,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: SPACING.md,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: SPACING.sm,
    },
    detailLabel: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
    },
    detailValue: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
    },
    methodOption: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: COLORS.backgroundDark,
        padding: SPACING.md,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.accent + '40',
        gap: SPACING.md,
        marginBottom: SPACING.sm,
    },
    methodOptionActive: {
        borderColor: COLORS.accent,
        backgroundColor: COLORS.accent + '12',
    },
    methodOptionDisabled: {
        borderColor: COLORS.cardBorder,
        backgroundColor: COLORS.cardDark,
        opacity: 0.75,
    },
    methodIcon: {
        width: 44,
        height: 44,
        borderRadius: RADII.sm,
        backgroundColor: COLORS.accent + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    methodName: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
    },
    methodCopy: {
        flex: 1,
        minWidth: 0,
        gap: 3,
    },
    methodDetail: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
        lineHeight: 18,
    },
    expiredText: {
        color: COLORS.warning,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
        lineHeight: 18,
        marginTop: SPACING.sm,
    },
    footer: {
        gap: SPACING.sm,
    },
    cancelHint: {
        color: COLORS.muted,
        fontSize: 12,
        fontFamily: FONTS.body,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundDark,
    },
    backButton: {
        padding: 4,
    },
});
