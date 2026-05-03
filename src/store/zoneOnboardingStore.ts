// src/store/zoneOnboardingStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// STEP 1 – account + brand
export type ZoneStep1Data = {
  ownerFullName: string;
  venueBrandName: string;
  contactEmail: string;
  contactPhone: string;
  password: string;
  type: 'gaming' | 'sports' | 'hybrid';
};

// Branch Data Structure (combines old Step 2 & Step 3 per branch)
export type BranchData = {
  id: string; // unique temp id
  // Location Details
  branchDisplayName: string;
  city: string;
  areaLabel: string;
  addressLine1: string;
  googleMapsUrl: string;
  contactPhone?: string;

  // Inventory & Pricing
  supportsCs2: boolean;
  supportsFc25: boolean;
  supportsTekken8: boolean;
  supportsFutsal: boolean;
  supportsIndoorCricket: boolean;
  supportsPadel: boolean;
  supportsPickleball: boolean;

  pricing: {
    pc?: {
      regular?: { count: string; price: string };
      premium?: { count: string; price: string };
      elite?: { count: string; price: string };
    };
    console?: {
      regular?: { count: string; price1v1: string; price2v2: string };
      premium?: { count: string; price1v1: string; price2v2: string };
      elite?: { count: string; price1v1: string; price2v2: string };
      ps5?: { count: string; price1v1: string; price2v2: string };
      xbox?: { count: string; price1v1: string; price2v2: string };
    };
    futsal?: {
      [key: string]: { count: string; price: string }; // key = court type
    };
    indoor_cricket?: {
      [key: string]: { count: string; price: string }; // key = surface
    };
    padel?: {
      [key: string]: { count: string; price: string }; // key = surface
    };
    pickleball?: {
      [key: string]: { count: string; price: string }; // key = surface
    };
  };

  specs?: string;
  notes: string;
};

// STEP 4 – agreements
export type ZoneStep4Data = {
  agreeTerms: boolean;
  agreeRevenueShare: boolean;
};

export type ZoneOnboardingState = {
  currentStep: number;

  step1: ZoneStep1Data;
  branches: BranchData[]; // Array of branches
  step4: ZoneStep4Data;

  setCurrentStep: (step: number) => void;

  setStep1: (data: Partial<ZoneStep1Data>) => void;

  // Branch Management
  addBranch: (branch: BranchData) => void;
  updateBranch: (id: string, data: Partial<BranchData>) => void;
  removeBranch: (id: string) => void;
  setBranches: (branches: BranchData[]) => void;

  setStep4: (data: Partial<ZoneStep4Data>) => void;

  clearAll: () => void;
  resetAll: () => void;
};

const initialState: Omit<
  ZoneOnboardingState,
  | "setCurrentStep"
  | "setStep1"
  | "addBranch"
  | "updateBranch"
  | "removeBranch"
  | "setBranches"
  | "setStep4"
  | "clearAll"
  | "resetAll"
> = {
  currentStep: 1,
  step1: {
    ownerFullName: "",
    venueBrandName: "",
    contactEmail: "",
    contactPhone: "",
    password: "",
    type: "gaming",
  },
  branches: [],
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

      addBranch: (branch) =>
        set((state) => ({ branches: [...state.branches, branch] })),

      updateBranch: (id, data) =>
        set((state) => ({
          branches: state.branches.map((b) =>
            b.id === id ? { ...b, ...data } : b
          ),
        })),

      removeBranch: (id) =>
        set((state) => ({
          branches: state.branches.filter((b) => b.id !== id),
        })),

      setBranches: (branches) => set(() => ({ branches })),

      setStep4: (data) =>
        set((state) => ({ step4: { ...state.step4, ...data } })),

      clearAll: () => set(() => ({ ...initialState })),
      resetAll: () => set(() => ({ ...initialState })),
    }),
    {
      name: "matchhai-zone-onboarding",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
