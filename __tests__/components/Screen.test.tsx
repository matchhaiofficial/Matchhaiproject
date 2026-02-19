import React from "react";
import { ScrollView, View } from "react-native";
import { render } from "@testing-library/react-native";
import Screen from "../../src/components/Screen";
import { SPACING } from "../../src/theme";

const mockUseSegments = jest.fn();

jest.mock("expo-router", () => ({
  useSegments: () => mockUseSegments(),
}));

jest.mock("../../src/hooks/useScreenPadding", () => ({
  useScreenPadding: () => 16,
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  const SafeAreaView = ({ children, ...props }) => (
    <View {...props}>{children}</View>
  );
  return { SafeAreaView };
});

const { SafeAreaView } = require("react-native-safe-area-context");

describe("Screen", () => {
  it("uses top-only edges for tabs screens", () => {
    mockUseSegments.mockReturnValue(["(tabs)"]);
    const { UNSAFE_getByType } = render(
      <Screen>
        <View />
      </Screen>
    );

    const safeArea = UNSAFE_getByType(SafeAreaView);
    expect(safeArea.props.edges).toEqual(["top"]);
  });

  it("uses top+bottom edges for non-tabs screens", () => {
    mockUseSegments.mockReturnValue(["auth"]);
    const { UNSAFE_getByType } = render(
      <Screen>
        <View />
      </Screen>
    );

    const safeArea = UNSAFE_getByType(SafeAreaView);
    expect(safeArea.props.edges).toEqual(["top", "bottom"]);
  });

  it("renders ScrollView when scroll is true", () => {
    mockUseSegments.mockReturnValue(["auth"]);
    const { UNSAFE_getByType } = render(
      <Screen scroll>
        <View />
      </Screen>
    );

    expect(UNSAFE_getByType(ScrollView)).toBeTruthy();
  });

  it("applies bottom padding for non-tabs screens", () => {
    mockUseSegments.mockReturnValue(["auth"]);
    const { UNSAFE_getByType } = render(
      <Screen scroll>
        <View />
      </Screen>
    );

    const scroll = UNSAFE_getByType(ScrollView);
    expect(scroll.props.contentContainerStyle).toEqual(
      expect.arrayContaining([expect.objectContaining({ paddingBottom: SPACING.xxl })])
    );
  });
});
