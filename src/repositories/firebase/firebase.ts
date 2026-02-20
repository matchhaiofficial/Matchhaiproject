import {
  getFirebaseApp,
  getFirebaseAuth,
  getFirestoreDb,
  getFirebaseStorage,
} from "./sdk";

export const app = getFirebaseApp();
export const auth = getFirebaseAuth();
export const db = getFirestoreDb();
export const storage = getFirebaseStorage();
