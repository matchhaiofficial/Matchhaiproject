// src/services/requestService.ts
import { API_BASE_URL } from "../config/apiConfig";

export type PartyType =
  | "solo"
  | "duo"
  | "trio"
  | "quad"
  | "team";

export interface BookingRequestPayload {
  sport: string;
  timeWindow: string;
  partyType: PartyType;
  preferredAreas: string[];
  preferredZones: string[];
  requester?: {
    uid?: string;
    name?: string;
    email?: string;
    partySize?: number;
  };
  expiresInMs?: number;
}

export interface BookingRequest extends BookingRequestPayload {
  id: string;
  status: "pending" | "offers-pending" | "offer-accepted" | "offer-rejected" | "expired";
  createdAt: number;
  expiresAt?: number;
}

export interface RequestOffer {
  id: string;
  requestId: string;
  zoneId: string;
  zoneName?: string;
  adminContact?: string;
  slotTime?: string;
  price?: number;
  notes?: string;
  status: "pending" | "accepted" | "rejected" | "expired";
  createdAt?: number;
}

async function handleJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function submitBookingRequest(
  payload: BookingRequestPayload
): Promise<BookingRequest> {
  const res = await fetch(`${API_BASE_URL}/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await handleJson<{ ok: boolean; request: BookingRequest }>(res);
  return json.request;
}

export async function loadRequestWithOffers(requestId: string): Promise<{
  request: BookingRequest;
  offers: RequestOffer[];
}> {
  const res = await fetch(`${API_BASE_URL}/requests/${requestId}`);
  const json = await handleJson<{
    ok: boolean;
    request: BookingRequest;
    offers: RequestOffer[];
  }>(res);
  return { request: json.request, offers: json.offers || [] };
}

export async function acceptOffer(
  requestId: string,
  offerId: string
): Promise<{ request: BookingRequest; offers: RequestOffer[] }> {
  const res = await fetch(`${API_BASE_URL}/requests/${requestId}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offerId }),
  });

  const json = await handleJson<{
    ok: boolean;
    request: BookingRequest;
    offers: RequestOffer[];
  }>(res);
  return { request: json.request, offers: json.offers || [] };
}
