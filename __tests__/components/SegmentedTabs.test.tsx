import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import SegmentedTabs from "../../src/components/SegmentedTabs";

describe("SegmentedTabs", () => {
  it("calls onChange when a different tab is pressed", () => {
    const onChange = jest.fn();
    const { getByText } = render(
      <SegmentedTabs
        items={[
          { key: "a", label: "Tab A" },
          { key: "b", label: "Tab B" },
        ]}
        value="a"
        onChange={onChange}
      />
    );

    fireEvent.press(getByText("Tab B"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("does not call onChange when disabled tab is pressed", () => {
    const onChange = jest.fn();
    const { getByText } = render(
      <SegmentedTabs
        items={[
          { key: "a", label: "Tab A" },
          { key: "b", label: "Tab B", disabled: true },
        ]}
        value="a"
        onChange={onChange}
      />
    );

    fireEvent.press(getByText("Tab B"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
