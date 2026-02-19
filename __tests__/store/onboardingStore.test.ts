import { useOnboardingStore } from "../../src/store/onboardingStore";

describe("onboardingStore", () => {
  beforeEach(() => {
    useOnboardingStore.getState().resetAll();
  });

  it("initializes with defaults", () => {
    const state = useOnboardingStore.getState();
    expect(state.step1.city).toBe("Karachi");
    expect(state.step3.steamProfileUrl).toBe("");
    expect(state.step4.agreeTerms).toBe(false);
  });

  it("updates step1 and step3 data", () => {
    useOnboardingStore.getState().setStep1({ fullName: "Test User" });
    useOnboardingStore.getState().setStep3({ steamProfileUrl: "steam://test" });

    const state = useOnboardingStore.getState();
    expect(state.step1.fullName).toBe("Test User");
    expect(state.step3.steamProfileUrl).toBe("steam://test");
  });

  it("resetAll restores defaults", () => {
    useOnboardingStore.getState().setStep2({ playsCs2: true });
    useOnboardingStore.getState().resetAll();

    const state = useOnboardingStore.getState();
    expect(state.step2.playsCs2).toBe(false);
  });
});
