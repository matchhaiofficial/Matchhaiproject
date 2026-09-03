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
    sectionCardSpacing: {
        marginBottom: SPACING.lg,
    },
    totalAmount: {
        fontSize: TEXT_SIZES.lg,
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
    walletWarning: {
        color: COLORS.warning,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
        lineHeight: 18,
        marginTop: SPACING.sm,
    },
    paymentStateRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.sm,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.success + '24',
        backgroundColor: COLORS.success + '10',
        padding: SPACING.md,
        marginTop: SPACING.md,
    },
    paymentStateText: {
        flex: 1,
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
        lineHeight: 18,
    },
    bottomActionContent: {
        gap: SPACING.sm,
    },
    easypaisaDialogCard: {
        width: '100%',
    },
    easypaisaDialogContent: {
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.md,
    },
    easypaisaAmountLabel: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
        marginBottom: SPACING.lg,
    },
    easypaisaPhoneLabel: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.heading,
        marginBottom: SPACING.sm,
    },
    easypaisaPhoneInput: {
        minHeight: 52,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        borderRadius: RADII.md,
        backgroundColor: COLORS.backgroundDark,
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
        paddingHorizontal: SPACING.md,
    },
    easypaisaDialogFooter: {
        paddingHorizontal: SPACING.xl,
    },
    easypaisaActions: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    easypaisaActionButton: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.backgroundDark,
    },
});
