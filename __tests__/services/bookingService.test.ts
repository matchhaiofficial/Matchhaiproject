jest.mock("../../src/config/firebaseConfig", () => ({
  auth: { currentUser: null },
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn(),
}));

import {
  FAIR_BAND_DELTA_BY_GAME,
  generateIntentId,
  getHostCaptainUid,
  getSlotIdHash,
  isWithinFairnessBand,
} from "../../src/services/bookingService";

describe("bookingService helpers", () => {
  it("calculates fairness band based on game delta", () => {
    const delta = FAIR_BAND_DELTA_BY_GAME.cs2;
    expect(isWithinFairnessBand(50, 50 + delta, "cs2")).toBe(true);
    expect(isWithinFairnessBand(50, 50 + delta + 1, "cs2")).toBe(false);
  });

  it("hashes slot ids deterministically", () => {
    const a = getSlotIdHash(["b", "a"]);
    const b = getSlotIdHash(["a", "b"]);
    expect(a).toBe(b);
  });

  it("generates deterministic intent id", () => {
    const id = generateIntentId("room1", "A", "user1", ["s1", "s2"]);
    expect(id).toBe("intent_room1_A_user1_s1_s2");
  });

  it("selects captain/host fallback", () => {
    expect(getHostCaptainUid({ captainUidA: "a", hostUid: "h" } as any)).toBe("a");
    expect(getHostCaptainUid({ captainUidB: "b", hostUid: "h" } as any)).toBe("b");
    expect(getHostCaptainUid({ hostUid: "h" } as any)).toBe("h");
  });
});
