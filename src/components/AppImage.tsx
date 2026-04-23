import React from "react";
import {
  ImageSourcePropType,
  StyleProp,
  View,
  ImageStyle,
  ViewStyle,
} from "react-native";
import { Image, ImageContentFit, ImageProps } from "expo-image";

type Source = ImageProps["source"] | ImageSourcePropType;

export function AppImage({
  source,
  style,
  containerStyle,
  contentFit = "cover",
  transition = 180,
  cachePolicy = "memory-disk",
  fallbackBackground = "transparent",
  ...rest
}: Omit<ImageProps, "source" | "style" | "contentFit"> & {
  source: Source;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  fallbackBackground?: string;
}) {
  return (
    <View style={[{ overflow: "hidden", backgroundColor: fallbackBackground }, containerStyle]}>
      <Image
        source={source as ImageProps["source"]}
        style={[{ width: "100%", height: "100%" }, style]}
        contentFit={contentFit}
        transition={transition}
        cachePolicy={cachePolicy}
        {...rest}
      />
    </View>
  );
}
