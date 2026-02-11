import { StyleSheet } from 'react-native';
import { COLORS, FONTS, RADII, SHADOWS, SPACING, TEXT_SIZES } from '../../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    screenContent: {
        paddingTop: 0,
        paddingBottom: 0,
    },
    header: {
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.divider,
        backgroundColor: COLORS.background,
    },
    headerTopRow: {
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
    segmentTabs: {
        marginTop: SPACING.xs,
    },

    // Global Chips
    itemFiltersScroll: {
        flexGrow: 0,
        marginBottom: 0, // Tight against bottom of header
    },
    itemFiltersContent: {
        flexGrow: 1,
        paddingBottom: SPACING.sm,
    },
    optionChip: {
        minWidth: 84,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        backgroundColor: COLORS.cardBackground,
        paddingHorizontal: 14,
        paddingVertical: 7,
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
        right: 24,
        zIndex: 20,
        elevation: 12,
        pointerEvents: 'box-none',
    },
    fab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8, // Explicit elevation for Android
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
});
