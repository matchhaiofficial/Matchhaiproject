import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    content: {
        backgroundColor: COLORS.cardDark,
        borderTopLeftRadius: RADII.xl,
        borderTopRightRadius: RADII.xl,
        minHeight: '50%',
        maxHeight: '85%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.xl,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
    },
    title: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.lg,
    },
    subtitle: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        marginTop: 2,
    },
    closeBtn: {
        padding: 4,
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    listBody: {
        flexShrink: 1,
        minHeight: 0,
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.md,
    },
    listScroller: {
        flexGrow: 0,
    },
    list: {
        paddingBottom: SPACING.sm,
    },
    friendItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    friendInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(66, 165, 245, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    avatarText: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
        fontSize: 14,
    },
    friendName: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.body,
    },
    inviteBtn: {
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
        borderWidth: 1,
        borderColor: COLORS.accent,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: RADII.sm,
    },
    inviteBtnDisabled: {
        borderColor: 'transparent',
        backgroundColor: 'transparent',
    },
    inviteBtnText: {
        color: COLORS.accent,
        fontFamily: FONTS.heading,
        fontSize: 12,
        fontWeight: '700',
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.subheading,
        marginTop: SPACING.md,
    },
    emptySubtext: {
        color: COLORS.muted,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.caption,
        textAlign: 'center',
        marginTop: 4,
    },
    modalFooter: {
        paddingHorizontal: SPACING.xl,
    },
});
