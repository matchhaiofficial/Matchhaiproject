import { StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../src/theme';

export default StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.backgroundDark,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        color: COLORS.text,
        fontFamily: FONTS.heading,
        fontSize: 22,
        marginBottom: 16,
        textAlign: 'center',
    },
    link: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: COLORS.accent,
        borderRadius: 14,
    },
    linkText: {
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: 16,
    },
});

