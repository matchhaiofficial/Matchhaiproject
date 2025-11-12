// src/config/firebaseConfig.ts
import { Platform } from "react-native";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  Auth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyB57bgQdpSOk91_HjL-AJq94_n23OXvgnY",
  authDomain: "matchhai-official.firebaseapp.com",
  projectId: "matchhai-official",
  storageBucket: "matchhai-official.firebasestorage.app",
  messagingSenderId: "1015520088969",
  appId: "1:1015520088969:web:818fa68f4812ff54a60758",
};

// Initialize (avoid duplicates in Fast Refresh)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Use RN persistence on native; standard getAuth on web
let auth: Auth;
if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  // initializeAuth must be called only once per app on native
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // If it was already initialized (Fast Refresh), fall back to getAuth
    auth = getAuth(app);
  }
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);
