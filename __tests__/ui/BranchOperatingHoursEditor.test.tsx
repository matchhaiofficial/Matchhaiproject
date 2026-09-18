import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

jest.mock("../../src/components/AppModalPrimitives", () => {
  const React = require("react");
  return {
    AppPickerSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? React.createElement(React.Fragment, null, children) : null,
    AppModalBody: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

import BranchOperatingHoursEditor from "../../app-shared/zone/branch/components/BranchOperatingHoursEditor";
import { createDefaultBranchOperatingHours } from "../../constants/branchOperatingHours";

describe("BranchOperatingHoursEditor", () => {
  it("does not silently configure legacy branches", () => {
    const onChange = jest.fn();
    render(<BranchOperatingHoursEditor value={null} onChange={onChange} />);
    expect(screen.getByText(/Not configured/)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText("Configure Hours"));
    expect(onChange).toHaveBeenCalledWith(createDefaultBranchOperatingHours());
  });

  it("updates closed days and adds an exceptional closure", () => {
    const onChange = jest.fn();
    const value = createDefaultBranchOperatingHours();
    render(<BranchOperatingHoursEditor value={value} onChange={onChange} />);

    fireEvent.press(screen.getAllByText("Open")[1]);
    expect(onChange.mock.calls[0][0].weekly[1].isClosed).toBe(true);

    fireEvent.press(screen.getByText("Add date"));
    expect(onChange.mock.calls[1][0].exceptions).toHaveLength(1);
    expect(onChange.mock.calls[1][0].exceptions[0]).toMatchObject({ isClosed: true, label: "Closed" });
  });

  it("uses the in-app time picker instead of the native Android clock", () => {
    render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 360, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <BranchOperatingHoursEditor value={createDefaultBranchOperatingHours()} onChange={jest.fn()} />
      </SafeAreaProvider>,
    );
    fireEvent.press(screen.getByLabelText("Sunday opening time"));
    expect(screen.getByText("Select time")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
  });
});
