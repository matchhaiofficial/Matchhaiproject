// src/components/LogoHalo.tsx
import React from "react";
import { View } from "react-native";

import { AppImage } from "./AppImage";
import styles from "./LogoHalo.styles";

export default function LogoHalo() {
  return (
    <View style={styles.wrapper}>
      <AppImage
        source={require("../../assets/logo.png")}
        containerStyle={styles.logo}
        contentFit="contain"
      />
    </View>
  );
}

