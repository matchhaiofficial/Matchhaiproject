import { useWindowDimensions } from 'react-native';
import { StyleSheet } from 'react-native';

export default function useLogoHaloStyles() {
    const { width } = useWindowDimensions();
    const LOGO_SIZE = width * 0.42;      // visual size of the logo
    const WRAPPER_HEIGHT = width * 0.22; // how much vertical space it actually takes

    return StyleSheet.create({
        wrapper: {
            alignItems: "center",
            justifyContent: "center",
            height: WRAPPER_HEIGHT,       // fixed height — won't grow
            overflow: "visible",          // logo can render beyond this box
            marginBottom: 8,
        },
        logo: {
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            pointerEvents: "none",
        },
    });
}