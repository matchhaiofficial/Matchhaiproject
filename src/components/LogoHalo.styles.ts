import { StyleSheet } from 'react-native';

const LOGO_SIZE = 110;

export default StyleSheet.create({
    wrapper: {
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 8,
    },
    logo: {
        width: LOGO_SIZE,
        height: LOGO_SIZE,
        transform: [{ scale: 2 }],
    },
});
