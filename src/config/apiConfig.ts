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
const DEV_HOST = host || "10.0.2.2";
const DEV_PORT = 4000;

// NGROK URL - Update this when you restart ngrok
const NGROK_URL = "https://d526a7506a6b.ngrok-free.app";

// Toggle this to switch between local and ngrok
const USE_NGROK = false;

// In production you'll later swap this to your deployed backend URL
const PROD_BASE_URL = "https://YOUR-PRODUCTION-BACKEND-URL";

export const API_BASE_URL = __DEV__
  ? (USE_NGROK ? NGROK_URL : `http://${DEV_HOST}:${DEV_PORT}`)
  : PROD_BASE_URL;
