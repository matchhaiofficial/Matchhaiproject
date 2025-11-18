// src/services/steamApi.ts
import { API_BASE_URL } from "../config/apiConfig";

export interface SteamProfileSummary {
  steamId: string;
  personaName: string;
  avatarUrl?: string;
  countryCode?: string;
  cs2Hours?: number;
}

type SteamApiResult =
  | { ok: true; data: SteamProfileSummary }
  | { ok: false; message: string };

export async function fetchSteamProfileFromUrl(
  value: string
): Promise<SteamApiResult> {
  const input = value.trim();
  if (!input) {
    return { ok: false, message: "No Steam profile link provided." };
  }

  // If backend base URL is missing, keep UX alive in DEV with a mock
  if (!API_BASE_URL) {
    if (__DEV__) {
      console.warn(
        "[steamApi] Missing API_BASE_URL. Returning mocked SteamProfileSummary in DEV."
      );
      return {
        ok: true,
        data: {
          steamId: "76561198000000000",
          personaName: "Dev Test (Mocked)",
          avatarUrl: undefined,
          countryCode: "PK",
          cs2Hours: 1234,
        },
      };
    }
    return {
      ok: false,
      message:
        "Steam lookup is not configured yet. Please contact support.",
    };
  }

  try {
    const url = `${API_BASE_URL}/steam/profile-from-url?url=${encodeURIComponent(
      input
    )}`;
    console.log("[steamApi] calling backend:", url);

    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      console.log("[steamApi] backend HTTP error:", res.status, text);
      return {
        ok: false,
        message: text || "Steam lookup failed. Please try again later.",
      };
    }

    const json = (await res.json()) as SteamProfileSummary;
    return { ok: true, data: json };
  } catch (e) {
    console.log("[steamApi] error", e);
    return {
      ok: false,
      message:
        "Could not reach Steam service. Please check your internet connection and try again.",
    };
  }
}
