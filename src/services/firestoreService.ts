import { getApiClient } from "../api/client";
export type {
  BatchOperation,
  DocSnapshot,
  OrderByFilter,
  QueryOptions,
  WhereFilter,
} from "../repositories/firebase/firestoreService";

export const arrayRemoveValue: typeof import("../repositories/firebase/firestoreService").arrayRemoveValue = (...args) =>
  getApiClient().firestore.arrayRemoveValue(...args);
export const arrayUnionValue: typeof import("../repositories/firebase/firestoreService").arrayUnionValue = (...args) =>
  getApiClient().firestore.arrayUnionValue(...args);
export const addDocToCollection: typeof import("../repositories/firebase/firestoreService").addDocToCollection = (...args) =>
  getApiClient().firestore.addDocToCollection(...args);
export const deleteDocByPath: typeof import("../repositories/firebase/firestoreService").deleteDocByPath = (...args) =>
  getApiClient().firestore.deleteDocByPath(...args);
export const fetchDoc: typeof import("../repositories/firebase/firestoreService").fetchDoc = (...args) =>
  getApiClient().firestore.fetchDoc(...args);
export const fetchDocs: typeof import("../repositories/firebase/firestoreService").fetchDocs = (...args) =>
  getApiClient().firestore.fetchDocs(...args);
export const runBatch: typeof import("../repositories/firebase/firestoreService").runBatch = (...args) =>
  getApiClient().firestore.runBatch(...args);
export const runTransactionOnDb: typeof import("../repositories/firebase/firestoreService").runTransactionOnDb = (...args) =>
  getApiClient().firestore.runTransactionOnDb(...args);
export const serverTimestampValue: typeof import("../repositories/firebase/firestoreService").serverTimestampValue = (...args) =>
  getApiClient().firestore.serverTimestampValue(...args);
export const setDocByPath: typeof import("../repositories/firebase/firestoreService").setDocByPath = (...args) =>
  getApiClient().firestore.setDocByPath(...args);
export const subscribeDoc: typeof import("../repositories/firebase/firestoreService").subscribeDoc = (...args) =>
  getApiClient().firestore.subscribeDoc(...args);
export const subscribeDocs: typeof import("../repositories/firebase/firestoreService").subscribeDocs = (...args) =>
  getApiClient().firestore.subscribeDocs(...args);
export const updateDocByPath: typeof import("../repositories/firebase/firestoreService").updateDocByPath = (...args) =>
  getApiClient().firestore.updateDocByPath(...args);
