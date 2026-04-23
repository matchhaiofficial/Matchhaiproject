import * as SecureStore from "expo-secure-store";

import type { AuthSession } from "./auth-client";

const AUTH_SESSION_CACHE_KEY = "matchhai.auth.session.cache";

type SerializedAuthSession = {
  user: AuthSession["user"];
  session: Omit<AuthSession["session"], "expiresAt" | "createdAt" | "updatedAt"> & {
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
  };
};

function serializeSession(session: AuthSession): SerializedAuthSession {
  return {
    user: session.user,
    session: {
      ...session.session,
      expiresAt: session.session.expiresAt instanceof Date
        ? session.session.expiresAt.toISOString()
        : new Date(session.session.expiresAt).toISOString(),
      createdAt: session.session.createdAt instanceof Date
        ? session.session.createdAt.toISOString()
        : new Date(session.session.createdAt).toISOString(),
      updatedAt: session.session.updatedAt instanceof Date
        ? session.session.updatedAt.toISOString()
        : new Date(session.session.updatedAt).toISOString(),
    },
  };
}

function deserializeSession(raw: SerializedAuthSession): AuthSession {
  return {
    user: raw.user,
    session: {
      ...raw.session,
      expiresAt: new Date(raw.session.expiresAt),
      createdAt: new Date(raw.session.createdAt),
      updatedAt: new Date(raw.session.updatedAt),
    },
  };
}

export async function saveCachedAuthSession(session: AuthSession | null): Promise<void> {
  if (!session?.session?.id) {
    await SecureStore.deleteItemAsync(AUTH_SESSION_CACHE_KEY);
    return;
  }

  await SecureStore.setItemAsync(
    AUTH_SESSION_CACHE_KEY,
    JSON.stringify(serializeSession(session)),
  );
}

export async function loadCachedAuthSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(AUTH_SESSION_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SerializedAuthSession;
    const session = deserializeSession(parsed);

    if (
      !session?.session?.id ||
      !session?.user?.id ||
      Number.isNaN(session.session.expiresAt.getTime())
    ) {
      await clearCachedAuthSession();
      return null;
    }

    return session;
  } catch {
    await clearCachedAuthSession();
    return null;
  }
}

export async function clearCachedAuthSession(): Promise<void> {
  await SecureStore.deleteItemAsync(AUTH_SESSION_CACHE_KEY);
}

