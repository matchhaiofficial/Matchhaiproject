import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { ConvexProviderWithAuth } from "convex/react";

import { authClient } from "../lib/auth-client";
import { loadCachedAuthSession, saveCachedAuthSession } from "../lib/authSessionCache";
import { convex } from "../lib/convex";
import Logger from "../utils/logger";
import type { AuthSession } from "../lib/auth-client";

function useBetterAuthConvexAuth() {
  const { data: session, isPending } = authClient.useSession();
  const [sessionSnapshot, setSessionSnapshot] = useState<AuthSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const sessionId = session?.session?.id ?? null;
  const effectiveSession = session ?? sessionSnapshot;
  const effectiveSessionId = effectiveSession?.session?.id ?? null;
  const warnedTokenFailureForSessionRef = useRef<string | null>(null);
  const sessionSnapshotRef = useRef<AuthSession | null>(null);

  useEffect(() => {
    sessionSnapshotRef.current = sessionSnapshot;
  }, [sessionSnapshot]);

  const refreshSessionSnapshot = useCallback(async (reason: "mount" | "resume") => {
    try {
      const result = await authClient.getSession();
      const liveSession = (result.data as AuthSession | null) ?? null;

      if (liveSession?.session) {
        setSessionSnapshot(liveSession);
        await saveCachedAuthSession(liveSession);
      } else if (reason === "mount" && !session?.session) {
        const cachedSession = await loadCachedAuthSession();
        setSessionSnapshot(cachedSession);
      }

      Logger.info("ConvexAuthBridge", "Session snapshot refreshed", {
        reason,
        hasSession: Boolean(liveSession?.session || sessionSnapshotRef.current?.session),
        sessionId: liveSession?.session?.id ?? sessionSnapshotRef.current?.session?.id ?? null,
        authUserId: liveSession?.user?.id ?? sessionSnapshotRef.current?.user?.id ?? null,
      });
    } catch (error) {
      if (reason === "mount" && !session?.session && !sessionSnapshotRef.current?.session) {
        const cachedSession = await loadCachedAuthSession();
        setSessionSnapshot(cachedSession);
      }
      Logger.warn("ConvexAuthBridge", `Session refresh failed during ${reason}`, error);
    } finally {
      setSessionChecked(true);
    }
  }, [session?.session]);

  useEffect(() => {
    void refreshSessionSnapshot("mount");
  }, [refreshSessionSnapshot]);

  useEffect(() => {
    const store = authClient.$store as any;
    let unsubscribe: (() => void) | undefined;

    if (store?.listen) {
      unsubscribe = store.listen("session", (nextSession: any) => {
        if (nextSession?.session) {
          setSessionSnapshot(nextSession as AuthSession);
          void saveCachedAuthSession(nextSession as AuthSession);
        } else {
          setSessionSnapshot(null);
          void saveCachedAuthSession(null);
        }
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionChecked) return;
    Logger.info("ConvexAuthBridge", "Auth hook state updated", {
      hookHasSession: Boolean(session?.session),
      hookSessionId: session?.session?.id ?? null,
      snapshotHasSession: Boolean(sessionSnapshot?.session),
      snapshotSessionId: sessionSnapshot?.session?.id ?? null,
      effectiveSessionId,
      isPending,
    });
  }, [effectiveSessionId, isPending, session?.session, sessionChecked, sessionSnapshot?.session]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshSessionSnapshot("resume");
      }
    });

    return () => {
      subscription.remove();
    };
  }, [refreshSessionSnapshot]);

  const fetchAccessToken = useCallback(async () => {
    try {
      const result = await (authClient as any).convex?.token({
        fetchOptions: { throw: false },
      });
      const token = result?.data?.token ?? null;
      if (!token && effectiveSessionId && warnedTokenFailureForSessionRef.current !== effectiveSessionId) {
        warnedTokenFailureForSessionRef.current = effectiveSessionId;
        Logger.warn("ConvexAuthBridge", "Convex token fetch returned no token for active session", {
          sessionId: effectiveSessionId,
        });
      }
      if (token) {
        Logger.info("ConvexAuthBridge", "Convex token fetched", {
          sessionId: effectiveSessionId,
          tokenLength: token.length,
        });
      }
      if (token && warnedTokenFailureForSessionRef.current === effectiveSessionId) {
        warnedTokenFailureForSessionRef.current = null;
      }
      return token;
    } catch (error) {
      if (effectiveSessionId && warnedTokenFailureForSessionRef.current !== effectiveSessionId) {
        warnedTokenFailureForSessionRef.current = effectiveSessionId;
        Logger.warn("ConvexAuthBridge", "Convex token fetch failed for active session", {
          sessionId: effectiveSessionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return null;
    }
  }, [effectiveSessionId]);

  return useMemo(
    () => ({
      isLoading: !sessionChecked || (isPending && !effectiveSession?.session),
      isAuthenticated: Boolean(effectiveSession?.session),
      fetchAccessToken,
    }),
    [effectiveSession?.session, fetchAccessToken, isPending, sessionChecked]
  );
}

export default function AuthenticatedConvexProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useBetterAuthConvexAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
