import { createFirebaseApiClient } from "../repositories/firebase/apiClient";

export type BackendProvider = "firebase" | "convex";
export type ApiClient = ReturnType<typeof createFirebaseApiClient>;

let cachedClient: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (cachedClient) return cachedClient;

  const provider = (process.env.EXPO_PUBLIC_BACKEND_PROVIDER || "firebase") as BackendProvider;

  if (provider === "firebase") {
    cachedClient = createFirebaseApiClient();
    return cachedClient;
  }

  throw new Error("Convex provider not implemented yet");
}
