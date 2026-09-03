import React from "react";
import { BackHandler } from "react-native";
import { act, render } from "@testing-library/react-native";

import RegistrationStepHeader from "../../app/auth/components/RegistrationStepHeader";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(effect, [effect]);
  },
}));

describe("RegistrationStepHeader", () => {
  it("uses the current step back action for Android hardware back", () => {
    const onBack = jest.fn();
    let hardwareBackHandler: (() => boolean) | undefined;
    const remove = jest.fn();

    jest.spyOn(BackHandler, "addEventListener").mockImplementation((event, handler) => {
      if (event === "hardwareBackPress") {
        hardwareBackHandler = () => Boolean(handler());
      }
      return { remove };
    });

    const view = render(
      <RegistrationStepHeader
        title="Play Preferences"
        subtitle=""
        stepTitle="Step 2 of 4"
        stepSubtitle="Location and interests"
        progress="50%"
        onBack={onBack}
      />,
    );

    expect(hardwareBackHandler).toBeDefined();
    act(() => {
      expect(hardwareBackHandler?.()).toBe(true);
    });
    expect(onBack).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
