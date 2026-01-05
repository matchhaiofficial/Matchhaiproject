import { StyleSheet } from 'react-native';
import { COLORS } from '../../../src/theme';

export default StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
        alignItems: "center",
        justifyContent: "center",
    },
    text: {
        color: COLORS.text,
        fontSize: 18,
    },
});
