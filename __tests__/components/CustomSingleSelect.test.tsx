import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { CustomSingleSelect } from "../../src/components/CustomSingleSelect";

describe("CustomSingleSelect", () => {
  it("shows placeholder when no value is selected", () => {
    const { getByText } = render(
      <CustomSingleSelect
        label="City"
        value=""
        options={["Karachi", "Lahore"]}
        onChange={jest.fn()}
        placeholder="Choose city"
      />
    );

    expect(getByText("Choose city")).toBeTruthy();
  });

  it("opens modal and selects an option", () => {
    const onChange = jest.fn();
    const { getByText } = render(
      <CustomSingleSelect
        label="City"
        value=""
        options={["Karachi", "Lahore"]}
        onChange={onChange}
        placeholder="Choose city"
      />
    );

    fireEvent.press(getByText("Choose city"));
    expect(getByText("Select City")).toBeTruthy();

    fireEvent.press(getByText("Lahore"));
    expect(onChange).toHaveBeenCalledWith("Lahore");
  });
});
