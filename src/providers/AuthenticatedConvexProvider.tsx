import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { ConvexProviderWithAuth } from "convex/react";

import { authClient } from "../lib/auth-client";
import { loadCachedAuthSession, saveCachedAuthSession } from "../lib/authSessionCache";
import { createConvexClient, setActiveConvexClient } from "../lib/convex";
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
  const lastGoodTokenRef = useRef<string | null>(null);
  const lastGoodTokenSessionIdRef = useRef<string | null>(null);
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
          void (async () => {
            await new Promise((resolve) => setTimeout(resolve, 500));
            const cachedSession = await loadCachedAuthSession();
            setSessionSnapshot(cachedSession);
          })();
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
      if (!effectiveSessionId) {
        lastGoodTokenRef.current = null;
        lastGoodTokenSessionIdRef.current = null;
        return null;
      }

      const result = await (authClient as any).convex?.token({
        fetchOptions: { throw: false },
      });
      const token = result?.data?.token ?? null;

      if (token) {
        lastGoodTokenRef.current = token;
        lastGoodTokenSessionIdRef.current = effectiveSessionId;
      } else if (lastGoodTokenSessionIdRef.current === effectiveSessionId && lastGoodTokenRef.current) {
        // Avoid auth thrash on transient token fetch failures (offline, cold start race).
        // Returning a cached token keeps Convex from briefly de-authing and resetting state.
        return lastGoodTokenRef.current;
      }

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
      if (effectiveSessionId && lastGoodTokenSessionIdRef.current === effectiveSessionId && lastGoodTokenRef.current) {
        return lastGoodTokenRef.current;
      }
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
  const { data: session } = authClient.useSession();
  const sessionKey = session?.session?.id || "anonymous";
  const convex = useMemo(() => createConvexClient(), [sessionKey]);

  // Register the per-session, auth-bridged client as the active client so that
  // direct service calls made outside the React tree (e.g. zone admin booking
  // actions) share the same authenticated session as React hooks. Without this,
  // those calls would use the unauthenticated default client and fail with
  // "Unauthenticated" once a Convex function requires an identity.
  useEffect(() => {
    setActiveConvexClient(convex);
  }, [convex]);

  return (
    <ConvexProviderWithAuth key={sessionKey} client={convex} useAuth={useBetterAuthConvexAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}
