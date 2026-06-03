// Phase 2 (3) — filters/tabs present, active state, disabled behavior, badges.
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import SegmentedTabs from "../../src/components/SegmentedTabs";

const items = [
  { key: "open", label: "Open" },
  { key: "mine", label: "Mine", badge: 3 },
  { key: "done", label: "Completed", disabled: true },
] as const;

describe("SegmentedTabs", () => {
  it("renders all tab labels and a badge", () => {
    render(<SegmentedTabs items={items as any} value="open" onChange={() => {}} />);
    expect(screen.getByText("Open")).toBeTruthy();
    expect(screen.getByText("Mine")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy(); // badge
  });

  it("fires onChange when an enabled tab is tapped", () => {
    const onChange = jest.fn();
    render(<SegmentedTabs items={items as any} value="open" onChange={onChange} />);
    fireEvent.press(screen.getByText("Mine"));
    expect(onChange).toHaveBeenCalledWith("mine");
  });

  it("does NOT fire onChange for a disabled tab", () => {
    const onChange = jest.fn();
    render(<SegmentedTabs items={items as any} value="open" onChange={onChange} />);
    fireEvent.press(screen.getByText("Completed"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
