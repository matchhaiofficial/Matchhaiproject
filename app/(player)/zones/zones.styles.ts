import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.screenPadding,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
        backgroundColor: COLORS.background,
    },
    backButton: {
        marginRight: SPACING.md,
        padding: SPACING.xs,
    },
    headerTitle: {
        flex: 1,
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.heading,
    },
    scrollContent: {
        paddingBottom: 40,
    },

    // Banner Section
    banner: {
        height: 180,
        backgroundColor: COLORS.cardDark,
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    bannerOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: SPACING.lg,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    venueName: {
        color: '#FFF',
        fontSize: 24,
        fontFamily: FONTS.heading,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
        textAlign: 'center',
        flexShrink: 1,
        maxWidth: '100%',
    },

    // Info Section
    infoCard: {
        backgroundColor: COLORS.cardDark,
        marginVertical: SPACING.sm,
        padding: SPACING.lg,
        borderRadius: RADII.lg,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        ...SHADOWS.cardElevated,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    locationText: {
        color: COLORS.textSecondary,
        fontSize: 14,
        marginLeft: 8,
        flex: 1,
    },

    // Section Styling
    section: {
        marginTop: SPACING.lg,
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: 16,
        fontFamily: FONTS.heading,
        fontWeight: 'bold',
        marginBottom: SPACING.md,
    },

    // Game Tags
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: RADII.pill,
        borderWidth: 1,
        borderColor: 'rgba(66, 165, 245, 0.3)',
    },
    tagText: {
        color: COLORS.accent,
        fontSize: 12,
        fontWeight: '600',
    },

    // Pricing Row
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
    },
    priceLabel: {
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    priceValue: {
        color: COLORS.successBright,
        fontSize: 14,
        fontWeight: 'bold',
    },
    pricingCategory: {
        fontWeight: 'bold',
        color: COLORS.accent,
        marginBottom: 8,
        fontSize: 12,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },

    // Action Button
    actionButton: {
        backgroundColor: COLORS.accent,
        padding: 16,
        borderRadius: RADII.md,
        alignItems: 'center',
        marginTop: SPACING.xl,
        ...SHADOWS.accentSoft,
    },
    actionButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: FONTS.bold,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },

    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    errorText: {
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: 12,
    },
});
