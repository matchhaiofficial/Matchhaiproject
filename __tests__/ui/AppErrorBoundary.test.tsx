import React from "react";
import { act, render } from "@testing-library/react-native";
import { Text } from "react-native";

import AppErrorBoundary from "../../src/components/AppErrorBoundary";

jest.mock("../../src/lib/monitoring", () => ({
  captureException: jest.fn(),
}));

describe("AppErrorBoundary", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    consoleErrorSpy.mockRestore();
    jest.useRealTimers();
  });

  it("automatically remounts a subtree after a transient render failure", () => {
    let shouldThrow = true;

    function TransientChild() {
      if (shouldThrow) {
        throw new Error("temporary render failure");
      }
      return <Text>Recovered screen</Text>;
    }

    const view = render(
      <AppErrorBoundary autoRetry maxAutoRetries={2} autoRetryBaseDelayMs={10}>
        <TransientChild />
      </AppErrorBoundary>,
    );

    expect(view.getByText("Restoring your session...")).toBeTruthy();

    act(() => {
      shouldThrow = false;
      jest.advanceTimersByTime(10);
    });

    expect(view.getByText("Recovered screen")).toBeTruthy();
    view.unmount();
  });

  it("isolates a failed optional subtree with a custom fallback", () => {
    function BrokenChild(): React.ReactNode {
      throw new Error("optional service failed");
    }

    const view = render(
      <AppErrorBoundary fallback={() => null}>
        <BrokenChild />
      </AppErrorBoundary>,
    );

    expect(view.toJSON()).toBeNull();
    view.unmount();
  });
});
