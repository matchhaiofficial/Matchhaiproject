import {
  BROADCAST_COUNTER_RESPONSE_WINDOW_MS as backendCounterWindow,
  BROADCAST_OFFER_RESPONSE_WINDOW_MS as backendOfferWindow,
  BROADCAST_ZONE_RESPONSE_WINDOW_MS as backendZoneWindow,
  HOUR_MS,
  MINUTE_MS,
} from "../../convex/timing";
import {
  BROADCAST_COUNTER_RESPONSE_WINDOW_MS as clientCounterWindow,
  BROADCAST_OFFER_RESPONSE_WINDOW_MS as clientOfferWindow,
  BROADCAST_ZONE_RESPONSE_WINDOW_MS as clientZoneWindow,
} from "../../src/constants/timing";

describe("broadcast timing contracts", () => {
  it("keeps backend and UI discovery/offer windows aligned", () => {
    expect(backendZoneWindow).toBe(2 * HOUR_MS);
    expect(backendOfferWindow).toBe(30 * MINUTE_MS);
    expect(backendCounterWindow).toBe(30 * MINUTE_MS);
    expect(clientZoneWindow).toBe(backendZoneWindow);
    expect(clientOfferWindow).toBe(backendOfferWindow);
    expect(clientCounterWindow).toBe(backendCounterWindow);
  });
});
