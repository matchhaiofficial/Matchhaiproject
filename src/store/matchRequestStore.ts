// src/store/matchRequestStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SportCode =
  | "cs2"
  | "fc25"
  | "tekken8"
  | "futsal"
  | "indoorCricket"
  | "padel"
  | "pickleball";

export type PartyType = "solo" | "duo" | "trio" | "quad" | "team";

export interface BroadcastRequestForm {
  sport: SportCode;
  timePreference: string; // e.g. "10:00 PM"
  partyType: PartyType;
  preferredAreas: string[];
  preferredZones: string[];
  notes: string;
}

export interface MatchOffer {
  id: string;
  requestId: string;
  zoneId: string;
  zoneName: string;
  areaLabel: string;
  sport: SportCode;
  time: string;
  pricePerPlayer?: number;
  totalPrice?: number;
  currency?: string;
  slotsSummary?: string;
  responseEtaMinutes?: number;
  message?: string;
  status?: "pending" | "accepted" | "expired" | "declined";
}

export interface BroadcastRequestState {
  form: BroadcastRequestForm;
  requestId?: string;
  offers: MatchOffer[];
  selectedOfferId?: string;
  expiresAt?: string;
  status: "idle" | "submitting" | "awaiting_offers" | "offers_ready" | "accepting";
  lastError?: string;

  setForm: (data: Partial<BroadcastRequestForm>) => void;
  setRequestResult: (data: {
    requestId: string;
    offers: MatchOffer[];
    expiresAt?: string;
    status?: BroadcastRequestState["status"];
  }) => void;
  setStatus: (status: BroadcastRequestState["status"]) => void;
  setSelectedOffer: (offerId: string) => void;
  setOffers: (offers: MatchOffer[]) => void;
  setError: (message?: string) => void;
  resetAll: () => void;
}

const initialState: Omit<
  BroadcastRequestState,
  | "setForm"
  | "setRequestResult"
  | "setStatus"
  | "setSelectedOffer"
  | "setOffers"
  | "setError"
  | "resetAll"
> = {
  form: {
    sport: "cs2",
    timePreference: "",
    partyType: "solo",
    preferredAreas: [],
    preferredZones: [],
    notes: "",
  },
  requestId: undefined,
  offers: [],
  selectedOfferId: undefined,
  expiresAt: undefined,
  status: "idle",
  lastError: undefined,
};

export const useMatchRequestStore = create<BroadcastRequestState>()(
  persist(
    (set) => ({
      ...initialState,
      setForm: (data) =>
        set((state) => ({
          form: {
            ...state.form,
            ...data,
          },
        })),
      setRequestResult: ({ requestId, offers, expiresAt, status }) =>
        set(() => ({
          requestId,
          offers,
          expiresAt,
          status: status || "offers_ready",
          lastError: undefined,
        })),
      setStatus: (status) => set(() => ({ status })),
      setSelectedOffer: (offerId) => set(() => ({ selectedOfferId: offerId })),
      setOffers: (offers) => set(() => ({ offers })),
      setError: (message) => set(() => ({ lastError: message })),
      resetAll: () => set(() => ({ ...initialState })),
    }),
    {
      name: "matchhai-match-requests",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);
