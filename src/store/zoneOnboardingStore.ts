// src/store/zoneOnboardingStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// STEP 1 – account + brand
export type ZoneStep1Data = {
  ownerFullName: string;   // main contact person
  venueBrandName: string;  // e.g. "O2 Esports Gaming Arena"
  contactEmail: string;
  contactPhone: string;
  password: string;
};

// STEP 2 – branch basics (supports multiple branches)
export type ZoneBranchLocation = {
  branchDisplayName: string; // e.g. "O2 – FB Area"
  city: string;              // "Karachi"
  areaLabel: string;         // "FB Area, Block 7"
  addressLine1: string;      // street / building
  googleMapsUrl: string;     // optional
};

export type ZoneStep2Data = {
  branches: ZoneBranchLocation[]; // first entry is considered primary
  // legacy single-branch fields kept for backward compatibility with summary screens
  branchDisplayName?: string;
  city?: string;
  areaLabel?: string;
  addressLine1?: string;
  googleMapsUrl?: string;
};

// STEP 3 – supported games / sports & basic inventory
export type ZoneStep3Data = {
  // game / sport flags
  supportsCs2: boolean;
  supportsFc25: boolean;
  supportsTekken8: boolean;
  supportsFutsal: boolean;
  supportsIndoorCricket: boolean;
  supportsPadel: boolean;
  supportsPickleball: boolean;

  // PC setups (for CS2)
  pcSeats: string; // approx. number of PC setups

  // Console setups (for FC / Tekken)
  consoleSeats: string;        // approx. number of console pods
  consolePlatform: string;     // e.g. "ps5", "ps4", "xbox-series", "mixed", "other"

  // Futsal courts
  futsalCourts: string;        // number of futsal courts
  futsalCourtType: string;     // e.g. "belgian-turf", "rubber-turf", etc.

  // Indoor cricket
  indoorCricketNets: string;   // number of indoor cricket nets / lanes
  indoorCricketSurface: string;

  // Padel
  padelCourts: string;
  padelCourtSurface: string;

  // Pickleball
  pickleballCourts: string;
  pickleballSurface: string;

  // Optional notes
  notes: string;
};

// STEP 4 – agreements only (no payout here)
export type ZoneStep4Data = {
  agreeTerms: boolean;
  agreeRevenueShare: boolean;
};

export type ZoneOnboardingState = {
  currentStep: number;

  step1: ZoneStep1Data;
  step2: ZoneStep2Data;
  step3: ZoneStep3Data;
  step4: ZoneStep4Data;

  setCurrentStep: (step: number) => void;

  setStep1: (data: Partial<ZoneStep1Data>) => void;
  setStep2: (data: Partial<ZoneStep2Data>) => void;
  setStep3: (data: Partial<ZoneStep3Data>) => void;
  setStep4: (data: Partial<ZoneStep4Data>) => void;

  clearAll: () => void;

  // aliases (like player onboarding)
  updateStep1: (data: Partial<ZoneStep1Data>) => void;
  updateStep2: (data: Partial<ZoneStep2Data>) => void;
  updateStep3: (data: Partial<ZoneStep3Data>) => void;
  updateStep4: (data: Partial<ZoneStep4Data>) => void;
  resetAll: () => void;
};

const initialState: Omit<
  ZoneOnboardingState,
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
    ownerFullName: "",
    venueBrandName: "",
    contactEmail: "",
    contactPhone: "",
    password: "",
  },
  step2: {
    branches: [
      {
        branchDisplayName: "",
        city: "",
        areaLabel: "",
        addressLine1: "",
        googleMapsUrl: "",
      },
    ],
    branchDisplayName: "",
    city: "",
    areaLabel: "",
    addressLine1: "",
    googleMapsUrl: "",
  },
  step3: {
    supportsCs2: false,
    supportsFc25: false,
    supportsTekken8: false,
    supportsFutsal: false,
    supportsIndoorCricket: false,
    supportsPadel: false,
    supportsPickleball: false,

    pcSeats: "",

    consoleSeats: "",
    consolePlatform: "",

    futsalCourts: "",
    futsalCourtType: "",

    indoorCricketNets: "",
    indoorCricketSurface: "",

    padelCourts: "",
    padelCourtSurface: "",

    pickleballCourts: "",
    pickleballSurface: "",

    notes: "",
  },
  step4: {
    agreeTerms: false,
    agreeRevenueShare: false,
  },
};

export const useZoneOnboardingStore = create<ZoneOnboardingState>()(
  persist(
    (set) => ({
      ...initialState,

      setCurrentStep: (step: number) => set(() => ({ currentStep: step })),

      setStep1: (data) =>
        set((state) => ({ step1: { ...state.step1, ...data } })),
      setStep2: (data) =>
        set((state) => ({ step2: { ...state.step2, ...data } })),
      setStep3: (data) =>
        set((state) => ({ step3: { ...state.step3, ...data } })),
      setStep4: (data) =>
        set((state) => ({ step4: { ...state.step4, ...data } })),

      clearAll: () => set(() => ({ ...initialState })),

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
      name: "matchhai-zone-onboarding",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
