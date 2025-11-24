// src/services/matchRequestService.ts
import { API_BASE_URL } from "../config/apiConfig";
import type {
  BroadcastRequestForm,
  MatchOffer,
  PartyType,
  SportCode,
} from "../store/matchRequestStore";

export interface BroadcastRequestPayload {
  sport: SportCode;
  timePreference: string;
  partyType: PartyType;
  preferredAreas: string[];
  preferredZones?: string[];
  notes?: string;
  userId?: string;
  userName?: string;
  email?: string;
}

export interface BroadcastRequestResponse {
  requestId: string;
  offers: MatchOffer[];
  expiresAt?: string;
}

type Result<T> = { ok: true; data: T } | { ok: false; message: string };

const normalizeList = (value?: string[] | string): string[] => {
  if (Array.isArray(value)) {
    return value.map((v) => v.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

const mockZones = [
  {
    zoneId: "zone_o2",
    zoneName: "O2",
    areaLabel: "Federal B Area",
    basePrice: 450,
    sports: ["cs2", "fc25", "tekken8"],
  },
  {
    zoneId: "zone_nuketown",
    zoneName: "Nuke Town",
    areaLabel: "Tariq Road",
    basePrice: 500,
    sports: ["cs2", "fc25"],
  },
  {
    zoneId: "zone_velocity",
    zoneName: "Velocity",
    areaLabel: "Defence",
    basePrice: 520,
    sports: ["cs2", "tekken8"],
  },
  {
    zoneId: "zone_maidan",
    zoneName: "Maidan",
    areaLabel: "Gulshan",
    basePrice: 700,
    sports: ["futsal"],
  },
];

const mockOffers = (
  payload: BroadcastRequestPayload,
  requestId: string
): MatchOffer[] => {
  const preferredAreas = normalizeList(payload.preferredAreas);
  const filtered = mockZones.filter((zone) => {
    const areaMatch =
      preferredAreas.length === 0 || preferredAreas.includes(zone.areaLabel);
    const zoneMatch =
      !payload.preferredZones ||
      payload.preferredZones.length === 0 ||
      payload.preferredZones.includes(zone.zoneName);
    const sportMatch = zone.sports.includes(payload.sport);
    return areaMatch && zoneMatch && sportMatch;
  });

  const source = filtered.length > 0 ? filtered : mockZones;

  return source.map((zone, idx) => {
    const rate = zone.basePrice + idx * 30;
    return {
      id: `offer_${requestId}_${idx}`,
      requestId,
      zoneId: zone.zoneId,
      zoneName: zone.zoneName,
      areaLabel: zone.areaLabel,
      sport: payload.sport,
      time: payload.timePreference,
      pricePerPlayer: rate,
      currency: "PKR",
      slotsSummary:
        payload.partyType === "team"
          ? "Team booking"
          : `${payload.partyType} booking`,
      responseEtaMinutes: 5 + idx * 2,
      message: payload.notes?.trim()
        ? `${zone.zoneName} can host. ${payload.notes.trim()}`
        : `${zone.zoneName} can host this slot.`,
      status: "pending",
    };
  });
};

export async function createBroadcastRequest(
  payload: BroadcastRequestPayload
): Promise<Result<BroadcastRequestResponse>> {
  const preparedPayload = {
    ...payload,
    preferredAreas: normalizeList(payload.preferredAreas),
    preferredZones: normalizeList(payload.preferredZones),
  };

  if (!API_BASE_URL) {
    const requestId = `req_${Date.now()}`;
    return { ok: true, data: { requestId, offers: mockOffers(payload, requestId) } };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preparedPayload),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, message: text || "Could not create request." };
    }

    const json = (await res.json()) as BroadcastRequestResponse;
    return { ok: true, data: json };
  } catch (e) {
    console.log("[matchRequestService] create error", e);
    return { ok: false, message: "Network error while creating request." };
  }
}

export async function fetchRequestOffers(
  requestId: string
): Promise<Result<MatchOffer[]>> {
  if (!requestId) {
    return { ok: false, message: "Missing request id." };
  }

  if (!API_BASE_URL) {
    return { ok: true, data: mockOffers({
      sport: "cs2",
      timePreference: "",
      partyType: "solo",
      preferredAreas: [],
      preferredZones: [],
      notes: "",
    }, requestId) };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/requests/${requestId}/offers`, {
      method: "GET",
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, message: text || "Could not fetch offers." };
    }

    const json = (await res.json()) as { offers: MatchOffer[] };
    return { ok: true, data: json.offers };
  } catch (e) {
    console.log("[matchRequestService] fetch offers error", e);
    return { ok: false, message: "Network error while fetching offers." };
  }
}

export async function acceptOffer(
  requestId: string,
  offerId: string
): Promise<Result<MatchOffer>> {
  if (!requestId || !offerId) {
    return { ok: false, message: "Missing request or offer id." };
  }

  if (!API_BASE_URL) {
    const offers = mockOffers(
      {
        sport: "cs2",
        timePreference: "",
        partyType: "solo",
        preferredAreas: [],
        preferredZones: [],
        notes: "",
      },
      requestId
    );
    const selected =
      offers.find((offer) => offer.id === offerId) || offers[0] || undefined;
    if (!selected) {
      return { ok: false, message: "Offer not found." };
    }
    return { ok: true, data: { ...selected, status: "accepted" } };
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/requests/${requestId}/offers/${offerId}/accept`,
      { method: "POST" }
    );

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, message: text || "Could not accept offer." };
    }

    const json = (await res.json()) as { offer: MatchOffer };
    return { ok: true, data: json.offer };
  } catch (e) {
    console.log("[matchRequestService] accept error", e);
    return { ok: false, message: "Network error while accepting offer." };
  }
}

export function buildPayloadFromForm(
  form: BroadcastRequestForm,
  user?: { uid?: string | null; displayName?: string | null; email?: string | null }
): BroadcastRequestPayload {
  return {
    sport: form.sport,
    timePreference: form.timePreference.trim(),
    partyType: form.partyType,
    preferredAreas: normalizeList(form.preferredAreas),
    preferredZones: normalizeList(form.preferredZones),
    notes: form.notes.trim(),
    userId: user?.uid || undefined,
    userName: user?.displayName || undefined,
    email: user?.email || undefined,
  };
}
