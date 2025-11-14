// src/services/userService.ts
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';


function normalizePhone(raw: string) {
  // keep digits only (so +92, spaces, etc. are normalized)
  return raw.replace(/\D/g, '');
}

/**
 * Check if a username is free.
 * We store and compare a lowercase version so checks are case-insensitive.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const trimmed = username.trim().toLowerCase();
  if (!trimmed) return false;

  const q = query(
    collection(db, 'users'),
    where('usernameLower', '==', trimmed),
    limit(1)
  );

  const snap = await getDocs(q);
  return snap.empty;
}

/**
 * Check if a phone is free.
 * We store phone in normalized numeric form, like 03xxxxxxxxx / 923xxxxxxxxx.
 */
export async function isPhoneAvailable(phone: string): Promise<boolean> {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;

  const q = query(
    collection(db, 'users'),
    where('phone', '==', normalized),
    limit(1)
  );

  const snap = await getDocs(q);
  return snap.empty;
}

/** Helper you can reuse inside signUp to normalize phone before saving */
export function normalizePhoneForSave(phone: string) {
  return normalizePhone(phone);
}