// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { AppState } from "react-native";
import { authClient, AuthUser, AuthSession } from "../lib/auth-client";
import { clearCachedAuthSession, loadCachedAuthSession, saveCachedAuthSession } from "../lib/authSessionCache";
import { convex } from "../lib/convex";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";

const PROFILE_FETCH_RETRY_DELAYS_MS = [0, 350, 900] as const;

async function queryUserProfileWithRetry(authId: string) {
  let lastError: unknown = null;

  for (const delayMs of PROFILE_FETCH_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    try {
      return await convex.query(api.users.getByAuthId, { authId });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

// User profile type from Convex
export type UserProfile = Doc<"users">;

type AuthContextType = {
  // Better Auth user (from auth session)
  authUser: AuthUser | null;
  // Convex user profile
  user: UserProfile | null;
  userId: Id<"users"> | null;
  // Loading state
  loading: boolean;
  // Session
  session: AuthSession | null;
  // Refresh user profile
  refreshUser: () => Promise<void>;
  // Refresh session (call after login/signup)
  refreshSession: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType>({
  authUser: null,
  user: null,
  userId: null,
  loading: true,
  session: null,
  refreshUser: async () => { },
  refreshSession: async () => false,
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: any }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const profileRequestIdRef = useRef(0);

  const applySessionState = useCallback(async (nextSession: AuthSession, persist = true) => {
    setAuthUser(nextSession.user);
    setSession(nextSession);
    if (persist) {
      await saveCachedAuthSession(nextSession);
    }
  }, []);

  const clearAuthState = useCallback((clearCache = true) => {
    profileRequestIdRef.current += 1;
    setAuthUser(null);
    setSession(null);
    setUser(null);
    setUserId(null);
    if (clearCache) {
      void clearCachedAuthSession();
    }
  }, []);

  // Fetch user profile from Convex
  const fetchUserProfile = useCallback(async (authId: string) => {
    const requestId = ++profileRequestIdRef.current;
    try {
      const profile = await queryUserProfileWithRetry(authId);
      if (requestId !== profileRequestIdRef.current) return;
      if (profile) {
        // Account was deleted by admin — sign out immediately so the user is
        // not left on the dashboard with an anonymized "Deleted User" profile.
        if (profile.suspensionReason === "account_deletion_processed") {
          try { await authClient.signOut(); } catch {}
          clearAuthState(true);
          return;
        }
        setUser(profile);
        setUserId(profile._id);
      } else {
        setUser(null);
        setUserId(null);
      }
    } catch (error) {
      // Keep the last valid profile during temporary release-network failures.
      // Clearing it while authenticated leaves mounted dashboards without their
      // required user and can turn a recoverable refresh into a root render crash.
      console.warn("[AuthContext] Failed to fetch user profile after retries:", error);
    }
  }, [clearAuthState]);

  const recheckBeforeClearing = useCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const { data } = await authClient.getSession();
    const liveSession = (data as AuthSession | null) ?? null;
    if (liveSession?.user) {
      await applySessionState(liveSession);
      await fetchUserProfile(liveSession.user.id);
      return;
    }

    const cachedSession = await loadCachedAuthSession();
    if (cachedSession?.user) {
      await applySessionState(cachedSession, false);
      void fetchUserProfile(cachedSession.user.id);
      return;
    }

    clearAuthState(false);
  }, [applySessionState, clearAuthState, fetchUserProfile]);

  // Refresh user profile
  const refreshUser = useCallback(async () => {
    if (authUser?.id) {
      await fetchUserProfile(authUser.id);
    }
  }, [authUser?.id, fetchUserProfile]);

  // Refresh session - call this after login/signup to ensure auth state is updated
  const refreshSession = useCallback(async (): Promise<boolean> => {
    const existingSession = session;

    const getLiveSession = async () => {
      const { data } = await authClient.getSession();
      return (data as AuthSession | null) ?? null;
    };

    const retryableFetch = async () => {
      const first = await getLiveSession();
      if (first?.user) return first;

      if (!existingSession?.user) {
        return first;
      }

      for (let attempt = 0; attempt < 2; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        const retry = await getLiveSession();
        if (retry?.user) {
          return retry;
        }
      }

      return first;
    };

    try {
      const liveSession = await retryableFetch();
      if (liveSession?.user) {
        await applySessionState(liveSession);
        await fetchUserProfile(liveSession.user.id);
        return true;
      }

      // Don't clear if we already have a session -- network may just be slow
      if (existingSession?.user) {
        return true;
      }

      // Only clear if we're certain there's no session at all
      clearAuthState();
      return false;
    } catch (error) {
      console.warn("[AuthContext] refreshSession failed:", error);
      // Never clear on error -- a network hiccup should never log the user out
      return existingSession?.user ? true : false;
    }
  }, [applySessionState, clearAuthState, fetchUserProfile, session]);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const cachedSession = await loadCachedAuthSession();
        if (cachedSession?.user && isMounted) {
          await applySessionState(cachedSession, false);
          void fetchUserProfile(cachedSession.user.id);
        }

        const { data } = await authClient.getSession();
        if (!isMounted) return;

        if (data?.user) {
          await applySessionState(data as AuthSession);
          await fetchUserProfile(data.user.id);
        } else if (!cachedSession?.user) {
          clearAuthState();
        }
      } catch {
        if (isMounted) {
          const cachedSession = await loadCachedAuthSession();
          if (!cachedSession?.user) {
            clearAuthState(false);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void bootstrap();

    // Subscribe to session changes
    const store = authClient.$store as any;
    let unsubscribe: (() => void) | undefined;

    if (store?.listen) {
      unsubscribe = store.listen("session", (newSession: any) => {
        if (newSession?.user) {
          void applySessionState(newSession as AuthSession);
          void fetchUserProfile(newSession.user.id);
          return;
        }

        void recheckBeforeClearing();
      });
    }

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [applySessionState, clearAuthState, fetchUserProfile, recheckBeforeClearing]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;

      // Silently try to refresh -- never clear session on failure
      authClient.getSession()
        .then(({ data }) => {
          if (data?.user) {
            void applySessionState(data as AuthSession);
            void fetchUserProfile(data.user.id);
            return;
          }
        })
        .catch(() => {
          // Network error? Do nothing -- keep existing state
        });
    });
    return () => subscription.remove();
  }, [applySessionState, fetchUserProfile]);

  return (
    <AuthContext.Provider value={{ authUser, user, userId, loading, session, refreshUser, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}
