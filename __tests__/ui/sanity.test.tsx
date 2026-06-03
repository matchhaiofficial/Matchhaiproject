// Foundation sanity check: React Native render + testID query via RNTL.
import React from "react";
import { Text, View } from "react-native";
import { render, screen } from "@testing-library/react-native";

function Hello({ name }: { name: string }) {
  return (
    <View testID="hello-root">
      <Text>Hello {name}</Text>
    </View>
  );
}

describe("jest foundation (ui)", () => {
  it("renders a component and finds it by testID and text", () => {
    render(<Hello name="MatchHai" />);
    expect(screen.getByTestId("hello-root")).toBeTruthy();
    expect(screen.getByText("Hello MatchHai")).toBeTruthy();
  });
});
