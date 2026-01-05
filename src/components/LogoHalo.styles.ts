import { StyleSheet } from 'react-native';

const LOGO_SIZE = 110;

export default StyleSheet.create({
    wrapper: {
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
    },
    logo: {
        width: LOGO_SIZE,
        height: LOGO_SIZE,
        resizeMode: "contain",
        transform: [{ scale: 2 }],
    },
});
