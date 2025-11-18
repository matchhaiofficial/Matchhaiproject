// src/config/apiConfig.ts
import Constants from "expo-constants";

// Try to detect the host running Metro / Expo
// In dev, hostUri is usually like "192.168.0.5:8081"
const hostUri =
  // newer Expo
  (Constants as any)?.expoConfig?.hostUri ||
  // older SDKs
  (Constants as any)?.manifest?.debuggerHost ||
  "";

// Extract just the hostname (before the :)
const host = hostUri.split(":")[0];

// Fallbacks:
// - If we managed to detect a host, use that (works for real device & emulator).
// - Otherwise, default to 10.0.2.2 for Android emulator.
const DEV_HOST = host || "10.0.2.2";
const DEV_PORT = 4000;

// In production you’ll later swap this to your deployed backend URL
const PROD_BASE_URL = "https://YOUR-PRODUCTION-BACKEND-URL";

export const API_BASE_URL = __DEV__
  ? `http://${DEV_HOST}:${DEV_PORT}`
  : PROD_BASE_URL;
