import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
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
    content: {
        padding: SPACING.screenPadding,
        paddingBottom: 100,
    },

    // Main Info Card
    mainCard: {
        marginBottom: SPACING.lg,
    },
    gameDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    gameBadge: {
        backgroundColor: COLORS.accent,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: RADII.sm,
        marginRight: SPACING.sm,
    },
    gameText: {
        color: '#FFF',
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.heading,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    dateText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
    },
    title: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.xxl,
        fontFamily: FONTS.heading,
        marginBottom: SPACING.sm,
        lineHeight: 32,
    },
    description: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.body,
        lineHeight: 22,
    },

    // Info Grid (Location, Price, etc)
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.md,
        marginBottom: SPACING.xl,
        backgroundColor: COLORS.cardDark,
        padding: SPACING.md,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    infoItem: {
        width: '45%',
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoIcon: {
        marginRight: SPACING.sm,
    },
    infoLabel: {
        color: COLORS.textSecondary,
        fontSize: 10,
        fontFamily: FONTS.body,
    },
    infoValue: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
    },

    // Section Headers
    sectionTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.subheading,
        fontFamily: FONTS.heading,
        marginBottom: SPACING.md,
    },

    // Roles / Players
    playersContainer: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.md,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        marginBottom: SPACING.xl,
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
        paddingBottom: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.overlayLight,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.overlayMedium,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    avatarText: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: 'bold',
    },
    playerInfo: {
        flex: 1,
    },
    playerName: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
    },
    playerRole: {
        color: COLORS.accent,
        fontSize: TEXT_SIZES.caption,
        fontFamily: FONTS.body,
    },
    hostBadge: {
        backgroundColor: COLORS.overlayLight,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
        marginLeft: 6,
    },
    hostText: {
        color: COLORS.textSecondary,
        fontSize: 10,
        fontWeight: 'bold',
    },

    // Footer Actions
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: COLORS.cardDark,
        padding: SPACING.screenPadding,
        borderTopWidth: 1,
        borderTopColor: COLORS.overlayLight,
        paddingBottom: SPACING.lg + 20,
    },
    footerRow: {
        flexDirection: 'row',
        gap: SPACING.md,
        alignItems: 'center',
    },
    joinButton: {
        backgroundColor: COLORS.accent,
        paddingVertical: 14,
        borderRadius: RADII.md,
        alignItems: 'center',
        ...SHADOWS.accentStrong,
    },
    joinButtonText: {
        color: '#FFF',
        fontSize: TEXT_SIZES.body,
        fontFamily: FONTS.heading,
        fontWeight: 'bold',
    },
    joinedButton: {
        backgroundColor: COLORS.success + '15',
        paddingVertical: 14,
        borderRadius: RADII.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.success + '50',
    },
    joinedText: {
        color: COLORS.success,
        fontFamily: FONTS.heading,
        fontSize: 14,
        fontWeight: 'bold',
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        paddingVertical: 14,
        borderRadius: RADII.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.error + '50',
    },
    secondaryButtonText: {
        color: COLORS.error,
        fontSize: 14,
        fontFamily: FONTS.heading,
        fontWeight: 'bold', // Match weight with primary buttons
    },
    fullButton: {
        backgroundColor: COLORS.overlayMedium,
        paddingVertical: 14,
        borderRadius: RADII.md,
        alignItems: 'center',
    },
    fullText: {
        color: COLORS.textSecondary,
        fontWeight: 'bold',
    },

    // Role Selection Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        padding: SPACING.lg,
    },
    modalContent: {
        backgroundColor: COLORS.cardDark,
        borderRadius: RADII.lg,
        padding: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    modalTitle: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.heading,
        fontFamily: FONTS.heading,
        marginBottom: SPACING.md,
        textAlign: 'center',
    },
    roleOption: {
        padding: SPACING.md,
        backgroundColor: COLORS.overlayLight,
        borderRadius: RADII.sm,
        marginBottom: SPACING.sm,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    roleOptionSelected: {
        borderColor: COLORS.accent,
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
    },
    roleOptionText: {
        color: COLORS.text,
        fontSize: TEXT_SIZES.body,
        textAlign: 'center',
    },
    modalActions: {
        flexDirection: 'row',
        gap: SPACING.md,
        marginTop: SPACING.md,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: RADII.sm,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: COLORS.overlayMedium,
    },
    confirmButton: {
        backgroundColor: COLORS.accent,
    },
});
