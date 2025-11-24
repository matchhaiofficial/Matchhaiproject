// src/store/requestStore.ts
import { create } from "zustand";
import type { BookingRequest, RequestOffer } from "../services/requestService";

type RequestStatus =
  | "idle"
  | "pending"
  | "offers-pending"
  | "offer-accepted"
  | "offer-rejected"
  | "expired";

interface RequestState {
  activeRequest?: BookingRequest;
  offers: RequestOffer[];
  status: RequestStatus;
  setActiveRequest: (request?: BookingRequest) => void;
  setOffers: (offers: RequestOffer[]) => void;
  upsertOffer: (offer: RequestOffer) => void;
  setStatus: (status: RequestStatus) => void;
}

export const useRequestStore = create<RequestState>((set) => ({
  activeRequest: undefined,
  offers: [],
  status: "idle",
  setActiveRequest: (activeRequest) =>
    set((state) => ({
      ...state,
      activeRequest,
      status: (activeRequest?.status as RequestStatus) || state.status,
    })),
  setOffers: (offers) => set((state) => ({ ...state, offers })),
  upsertOffer: (offer) =>
    set((state) => {
      const existing = state.offers.findIndex((o) => o.id === offer.id);
      if (existing >= 0) {
        const updated = [...state.offers];
        updated[existing] = offer;
        return { ...state, offers: updated };
      }
      return { ...state, offers: [...state.offers, offer] };
    }),
  setStatus: (status) => set((state) => ({ ...state, status })),
}));
