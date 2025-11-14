// src/components/LogoHalo.tsx
import React from "react";
import { Image, StyleSheet, View } from "react-native";

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

const LOGO_SIZE = 110; // layout size (keeps spacing the same)

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20, // fields stay where they are
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    resizeMode: "contain",
    transform: [{ scale: 2 }], // visually larger (~25% bigger)
  },
});
