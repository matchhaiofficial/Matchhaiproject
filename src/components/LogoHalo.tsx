// src/components/LogoHalo.tsx
import React from "react";
import { Image, View } from "react-native";
import styles from "./LogoHalo.styles";

export default function LogoHalo() {
  return (
    <View style={styles.wrapper}>
      <Image
        source={require("../../assets/logo.png")}
        style={styles.logo}
      />
    </View>
  );
}

