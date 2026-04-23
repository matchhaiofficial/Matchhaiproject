import { StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, TEXT_SIZES } from '../../../theme';

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        alignItems: 'stretch',
    },
    resultsCount: {
        paddingTop: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    resultsCountText: {
        color: COLORS.textSecondary,
        fontSize: TEXT_SIZES.caption,
    },
    card: {
        width: '100%',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: SPACING.sm,
        minWidth: 0,
    },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(66, 165, 245, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    cardIconSports: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 230, 118, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: SPACING.md,
    },
    cardTitle: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 16,
        fontWeight: 'bold',
    },
    cardBody: {
        flex: 1,
        minWidth: 0,
    },
    cardSubtitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        minWidth: 0,
    },
    cardSubtitle: {
        color: COLORS.textSecondary,
        fontSize: 12,
        marginLeft: 4,
        flex: 1,
        minWidth: 0,
    },
    priceTag: {
        marginLeft: SPACING.sm,
        flexShrink: 0,
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 4,
        gap: 8,
    },
});
export default styles;
