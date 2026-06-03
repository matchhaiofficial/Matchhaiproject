// Phase 2 (5) — ZonePicker: loading, empty, zone cards, rate label, no-gameKey.
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";

// Mock the data layer so no Convex/network is touched.
jest.mock("../../src/services/convex/zoneService", () => ({
  getActiveZones: jest.fn(),
}));

import ZonePicker from "../../app/matchrooms/create/components/ZonePicker";
import { getActiveZones } from "../../src/services/convex/zoneService";

const mockGetActiveZones = getActiveZones as jest.Mock;

const zoneWithRate = {
  id: "zone_1",
  venueBrandName: "Arena One",
  effectiveRate: 300,
  primaryBranch: { areaLabel: "Bahadurabad" },
};
const zoneNoRate = {
  id: "zone_2",
  venueBrandName: "Arena Two",
  primaryBranch: { areaLabel: "Gulshan" },
};

describe("ZonePicker", () => {
  it("renders nothing until a game is selected", () => {
    render(<ZonePicker gameKey={null} onZoneSelect={jest.fn()} />);
    expect(screen.queryByText(/Select Zone/)).toBeNull();
  });

  it("shows the zone list with rate label and 'Rate TBD' fallback", async () => {
    mockGetActiveZones.mockResolvedValue({ ok: true, data: [zoneWithRate, zoneNoRate] });
    render(<ZonePicker gameKey="valorant" onZoneSelect={jest.fn()} />);

    expect(await screen.findByText("Arena One")).toBeTruthy();
    expect(screen.getByText("Arena Two")).toBeTruthy();
    expect(screen.getByText("From Rs 300/hr")).toBeTruthy();
    expect(screen.getByText("Rate TBD")).toBeTruthy();
    expect(screen.getByText("Bahadurabad")).toBeTruthy();
  });

  it("shows an empty state when no zones are available", async () => {
    mockGetActiveZones.mockResolvedValue({ ok: true, data: [] });
    render(<ZonePicker gameKey="valorant" onZoneSelect={jest.fn()} />);
    await waitFor(() => expect(screen.getByText("No zones available")).toBeTruthy());
  });
});
