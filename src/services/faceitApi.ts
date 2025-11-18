// src/services/faceitApi.ts
import { API_BASE_URL } from "../config/apiConfig";

export interface FaceitProfileSummary {
  faceitId: string;
  nickname: string;
  game: string; // e.g. "cs2" / "csgo"
  elo?: number;
  skillLevel?: number;
  country?: string;
  avatarUrl?: string;
}

type FaceitApiResult =
  | { ok: true; data: FaceitProfileSummary }
  | { ok: false; message: string };

export async function fetchFaceitProfileFromUrl(
  profileUrlOrNick: string,
  game: string = "cs2"
): Promise<FaceitApiResult> {
  const value = profileUrlOrNick.trim();
  if (!value) {
    return { ok: false, message: "No FACEIT profile or nickname provided." };
  }

  if (!API_BASE_URL) {
    if (__DEV__) {
      console.warn(
        "[faceitApi] Missing API_BASE_URL. Returning mocked FaceitProfileSummary in DEV."
      );
      return {
        ok: true,
        data: {
          faceitId: "faceit-dev-id",
          nickname: "DevFaceitMock",
          game,
          elo: 2000,
          skillLevel: 10,
          country: "PK",
          avatarUrl: undefined,
        },
      };
    }
    return {
      ok: false,
      message:
        "FACEIT lookup is not configured yet. Please contact support.",
    };
  }

  try {
    const url = `${API_BASE_URL}/faceit/profile-from-value?value=${encodeURIComponent(
      value
    )}&game=${encodeURIComponent(game)}`;

    console.log("[faceitApi] calling backend:", url);

    const res = await fetch(url, {
      method: "GET",
    });

    if (!res.ok) {
      const text = await res.text();
      console.log("[faceitApi] backend HTTP error:", res.status, text);
      return {
        ok: false,
        message: text || "FACEIT lookup failed.",
      };
    }

    const json = (await res.json()) as FaceitProfileSummary;
    return { ok: true, data: json };
  } catch (e) {
    console.log("[faceitApi] error", e);
    return { ok: false, message: "Could not reach FACEIT service." };
  }
}
