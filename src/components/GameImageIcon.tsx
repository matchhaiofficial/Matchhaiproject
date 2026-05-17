import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";

import { normalizeGameKey } from "../features/discover/utils/gameKeys";
import { COLORS, RADII } from "../theme";
import { AppIcon, type AppIconName } from "./AppIcon";
import { AppImage } from "./AppImage";

const GAME_IMAGE_SOURCES = {
  cs2: require("../../assets/images/Icons/Counter Strike 2.png"),
  cs16: require("../../assets/images/Icons/Counter Strike 1.6.png"),
  fc26: require("../../assets/images/Icons/FC 26.png"),
  tekken8: require("../../assets/images/Icons/Tekken 8.png"),
  valorant: require("../../assets/images/Icons/Valorant.png"),
} as const;

type GameImageKey = keyof typeof GAME_IMAGE_SOURCES;

export function getGameImageSource(game: string | null | undefined) {
  const normalized = normalizeGameKey(game);
  if (!normalized || normalized === "all") return null;
  return GAME_IMAGE_SOURCES[normalized as GameImageKey] || null;
}

export function GameImageIcon({
  game,
  size = 28,
  rounded = true,
  containerStyle,
  fallbackIconName = "sports-esports",
  fallbackIconColor = COLORS.textSecondary,
}: {
  game: string | null | undefined;
  size?: number;
  rounded?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  fallbackIconName?: AppIconName | string;
  fallbackIconColor?: string;
}) {
  const source = getGameImageSource(game);
  const containerSize = { width: size, height: size };

  if (!source) {
    return (
      <View
        style={[
          containerSize,
          { alignItems: "center", justifyContent: "center" },
          containerStyle,
        ]}
      >
        <AppIcon name={fallbackIconName} size={Math.max(12, Math.round(size * 0.72))} color={fallbackIconColor} />
      </View>
    );
  }

  return (
    <AppImage
      source={source}
      contentFit="contain"
      contentPosition="center"
      fallbackBackground="transparent"
      containerStyle={[
        containerSize,
        {
          alignSelf: "center",
          borderRadius: rounded ? Math.min(RADII.sm, size / 4) : 0,
        },
        containerStyle,
      ]}
    />
  );
}
