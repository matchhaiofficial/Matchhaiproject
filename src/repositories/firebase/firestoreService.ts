import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy as fsOrderBy,
  query as fsQuery,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter as fsStartAfter,
  updateDoc,
  where as fsWhere,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

export type WhereFilter = {
  field: string;
  op:
    | "<"
    | "<="
    | "=="
    | ">"
    | ">="
    | "!="
    | "in"
    | "not-in"
    | "array-contains"
    | "array-contains-any";
  value: any;
};

export type OrderByFilter = {
  field: string;
  direction?: "asc" | "desc";
};

export type QueryOptions = {
  collectionPath: string[];
  where?: WhereFilter[];
  orderBy?: OrderByFilter[];
  limit?: number;
  startAfter?: any;
};

export type DocSnapshot<T = any> = {
  id: string;
  data: T;
};

const buildQuery = (options: QueryOptions) => {
  const { collectionPath, where, orderBy, limit, startAfter } = options;
  let base = collection(db, ...collectionPath);
  const constraints: any[] = [];

  if (where?.length) {
    where.forEach((clause) => {
      const field = clause.field === "__name__" ? documentId() : clause.field;
      constraints.push(fsWhere(field as any, clause.op, clause.value));
    });
  }

  if (orderBy?.length) {
    orderBy.forEach((clause) => {
      constraints.push(fsOrderBy(clause.field as any, clause.direction));
    });
  }

  if (typeof limit === "number") {
    constraints.push(fsLimit(limit));
  }

  if (startAfter !== undefined) {
    constraints.push(fsStartAfter(startAfter));
  }

  return constraints.length ? fsQuery(base, ...constraints) : base;
};

export async function fetchDocs<T = any>(options: QueryOptions): Promise<DocSnapshot<T>[]> {
  const q = buildQuery(options);
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() as T }));
}

export function subscribeDocs<T = any>(
  options: QueryOptions,
  onNext: (docs: DocSnapshot<T>[]) => void,
  onError?: (error: any) => void,
) {
  const q = buildQuery(options);
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() as T }));
      onNext(docs);
    },
    onError,
  );
}

export async function fetchDoc<T = any>(pathSegments: string[]): Promise<{ exists: boolean; id?: string; data?: T }> {
  const ref = doc(db, ...pathSegments);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { exists: false };
  return { exists: true, id: snap.id, data: snap.data() as T };
}

export async function addDocToCollection(collectionPath: string[], data: Record<string, any>) {
  const ref = collection(db, ...collectionPath);
  const docRef = await addDoc(ref, data);
  return docRef.id;
}

export function subscribeDoc<T = any>(
  pathSegments: string[],
  onNext: (doc: { exists: boolean; id?: string; data?: T }) => void,
  onError?: (error: any) => void,
) {
  const ref = doc(db, ...pathSegments);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onNext({ exists: false });
        return;
      }
      onNext({ exists: true, id: snap.id, data: snap.data() as T });
    },
    onError,
  );
}

export async function setDocByPath(
  pathSegments: string[],
  data: Record<string, any>,
  options?: { merge?: boolean },
) {
  const ref = doc(db, ...pathSegments);
  await setDoc(ref, data, options);
}

export async function updateDocByPath(pathSegments: string[], data: Record<string, any>) {
  const ref = doc(db, ...pathSegments);
  await updateDoc(ref, data);
}

export async function deleteDocByPath(pathSegments: string[]) {
  const ref = doc(db, ...pathSegments);
  await deleteDoc(ref);
}

export type BatchOperation =
  | { type: "set"; path: string[]; data: Record<string, any>; options?: { merge?: boolean } }
  | { type: "update"; path: string[]; data: Record<string, any> }
  | { type: "delete"; path: string[] };

export async function runBatch(ops: BatchOperation[]) {
  const batch = writeBatch(db);
  ops.forEach((op) => {
    const ref = doc(db, ...op.path);
    if (op.type === "set") {
      batch.set(ref, op.data, op.options);
    } else if (op.type === "update") {
      batch.update(ref, op.data);
    } else if (op.type === "delete") {
      batch.delete(ref);
    }
  });
  await batch.commit();
}

export async function runTransactionOnDb<T>(handler: (transaction: any) => Promise<T>) {
  return runTransaction(db, handler as any);
}

export function serverTimestampValue() {
  return serverTimestamp();
}

export function arrayUnionValue(...values: any[]) {
  return arrayUnion(...values);
}

export function arrayRemoveValue(...values: any[]) {
  return arrayRemove(...values);
}
