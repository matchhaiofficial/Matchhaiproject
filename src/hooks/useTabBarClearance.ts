import React from "react";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Dimensions } from "react-native";

export function useTabBarClearance(extra = 20) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = React.useContext(BottomTabBarHeightContext) ?? 0;

  // Our app uses a floating custom tab bar. In some cases React Navigation reports 0 for the
  // tab bar height, so fall back to the app's known tab bar sizing.
  const { width } = Dimensions.get("window");
  const isSmall = width < 360;
  const baseTabBarHeight = isSmall ? 58 : 64;
  const minBottomPad = 8;
  const bottomPad = Math.max(insets.bottom, minBottomPad);

  const fallbackHeight = baseTabBarHeight + bottomPad;
  const effectiveHeight = Math.max(tabBarHeight, fallbackHeight);
  return effectiveHeight + extra;
}
