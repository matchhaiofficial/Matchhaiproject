import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingTop: SPACING.md, // SafeArea handled by view or context usually
        paddingBottom: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
        backgroundColor: COLORS.background,
        elevation: 2,
        zIndex: 10,
    },
    headerTopRow: {
        paddingHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.md,
    },
    headerTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: TEXT_SIZES.heading,
        marginBottom: SPACING.md,
    },

    // Search Bar
    searchBar: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: RADII.md,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
        height: 48,
    },
    searchInput: {
        flex: 1,
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: TEXT_SIZES.input,
        paddingVertical: 0,
        paddingHorizontal: SPACING.sm,
    },

    // Segmented Control (Tabs)
    segmentContainer: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.screenPadding,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
        backgroundColor: COLORS.background,
    },
    segmentButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    segmentButtonActive: {
        borderBottomColor: COLORS.accent,
    },
    segmentText: {
        color: COLORS.textSecondary,
        fontFamily: FONTS.heading,
        fontSize: 14,
        fontWeight: '600',
    },
    segmentTextActive: {
        color: COLORS.accent,
    },

    // Global Chips
    itemFiltersScroll: {
        flexGrow: 0,
        marginBottom: 0, // Tight against bottom of header
    },
    itemFiltersContent: {
        paddingHorizontal: SPACING.screenPadding,
        paddingBottom: SPACING.sm,
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

    // FAB
    fabWrapper: {
        position: 'absolute',
        bottom: 110, // Adjust based on tab bar height if needed
        right: 24,
        zIndex: 1000,
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.cardElevated,
    },
});
