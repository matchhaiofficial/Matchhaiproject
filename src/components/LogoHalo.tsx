import React from "react";
import { View } from "react-native";

import { AppImage } from "./AppImage";
import useLogoHaloStyles from "./LogoHalo.styles";

export default function LogoHalo() {
    const styles = useLogoHaloStyles();

    return (
        <View style={styles.wrapper} pointerEvents="none">
            <AppImage
                source={require("../../assets/logo.png")}
                containerStyle={styles.logo}
                contentFit="contain"
            />
        </View>
    );
}

