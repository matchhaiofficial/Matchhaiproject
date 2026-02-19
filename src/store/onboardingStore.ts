// src/store/onboardingStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { FaceitProfileSummary } from "../services/faceitApi";
import type { SteamProfileSummary } from "../services/steamApi";

type Step1Data = {
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  city: string;
  ageRange: string;
};

type Step2Data = {
  selectedAreas: string[];
  playTimes: string[]; // multi-select

  // esports
  playsCs2: boolean;
  playsFc: boolean;
  playsTekken: boolean;
  cs2Role: string | null;
  fcTeam: string;
  fcFormation: string | null;
  tekkenFavorites: string[];

  // 🏟️ offline sports (MVP)
  playsFutsal: boolean;
  playsIndoorCricket: boolean;
  playsPadel: boolean;
  playsPickleball: boolean;

  futsalPositions: string[];          // multi-select
  indoorCricketRole: string | null;   // one role
  padelRole: string | null;           // one style
  pickleballRole: string | null;      // one mode

  // NEW: indoor cricket styles
  indoorCricketBowlingStyle: string | null;
  indoorCricketBattingStyle: string | null;

  // NEW Tekken fields
  tekkenExperienceDuration?: string | null;
  tekkenPlayEnvironment?: string | null;
  tekkenSelfAssessment?: string | null;
  tekkenSkillScore?: number;
  tekkenSkillBracket?: "A" | "B" | "C" | "D";
};

// Step 3 data
type Step3Data = {
  steamProfileUrl: string;
  faceitProfileUrl: string;
  psnOnlineId: string;

  // hydrated from API lookups (optional)
  steamProfile: SteamProfileSummary | null;
  faceitProfile: FaceitProfileSummary | null;
  psnProfile: any | null;
};

type Step4Data = {
  agreeTerms: boolean;
  agreePrivacy: boolean;
  consentMatchHistory: boolean;
};

export type OnboardingState = {
  currentStep: number;

  step1: Step1Data;
  step2: Step2Data;
  step3: Step3Data;
  step4: Step4Data;

  // step navigation
  setCurrentStep: (step: number) => void;

  // original API (used in your screens)
  setStep1: (data: Partial<Step1Data>) => void;
  setStep2: (data: Partial<Step2Data>) => void;
  setStep3: (data: Partial<Step3Data>) => void;
  setStep4: (data: Partial<Step4Data>) => void;
  clearAll: () => void;

  // optional newer aliases (same behaviour)
  updateStep1: (data: Partial<Step1Data>) => void;
  updateStep2: (data: Partial<Step2Data>) => void;
  updateStep3: (data: Partial<Step3Data>) => void;
  updateStep4: (data: Partial<Step4Data>) => void;
  resetAll: () => void;
};

const initialState: Omit<
  OnboardingState,
  | "setCurrentStep"
  | "setStep1"
  | "setStep2"
  | "setStep3"
  | "setStep4"
  | "clearAll"
  | "updateStep1"
  | "updateStep2"
  | "updateStep3"
  | "updateStep4"
  | "resetAll"
> = {
  currentStep: 1,
  step1: {
    fullName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    city: "Karachi",
    ageRange: "",
  },
  step2: {
    selectedAreas: [],
    playTimes: [],

    // esports
    playsCs2: false,
    playsFc: false,
    playsTekken: false,
    cs2Role: null,
    fcTeam: "",
    fcFormation: null,
    tekkenFavorites: [],

    // offline sports
    playsFutsal: false,
    playsIndoorCricket: false,
    playsPadel: false,
    playsPickleball: false,

    futsalPositions: [],
    indoorCricketRole: null,
    padelRole: null,
    pickleballRole: null,

    // NEW defaults
    indoorCricketBowlingStyle: null,
    indoorCricketBattingStyle: null,

    // Tekken defaults
    tekkenExperienceDuration: null,
    tekkenPlayEnvironment: null,
    tekkenSelfAssessment: null,
    tekkenSkillScore: 0,
    tekkenSkillBracket: undefined,
  },
  step3: {
    steamProfileUrl: "",
    faceitProfileUrl: "",
    psnOnlineId: "",
    steamProfile: null,
    faceitProfile: null,
    psnProfile: null,
  },
  step4: {
    agreeTerms: false,
    agreePrivacy: false,
    consentMatchHistory: false,
  },
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,

      setCurrentStep: (step: number) => set(() => ({ currentStep: step })),

      // core helpers
      setStep1: (data) =>
        set((state) => ({ step1: { ...state.step1, ...data } })),
      setStep2: (data) =>
        set((state) => ({ step2: { ...state.step2, ...data } })),
      setStep3: (data) =>
        set((state) => ({ step3: { ...state.step3, ...data } })),
      setStep4: (data) =>
        set((state) => ({ step4: { ...state.step4, ...data } })),

      clearAll: () => set(() => ({ ...initialState })),

      // aliases (same implementations)
      updateStep1: (data) =>
        set((state) => ({ step1: { ...state.step1, ...data } })),
      updateStep2: (data) =>
        set((state) => ({ step2: { ...state.step2, ...data } })),
      updateStep3: (data) =>
        set((state) => ({ step3: { ...state.step3, ...data } })),
      updateStep4: (data) =>
        set((state) => ({ step4: { ...state.step4, ...data } })),
      resetAll: () => set(() => ({ ...initialState })),
    }),
    {
      name: "matchhai-onboarding",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
