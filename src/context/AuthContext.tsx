import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";

import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";

type AuthUser = Doc<"users"> & {
  photoURL?: string;
  displayName?: string;
  uid: string;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

function normalizeUser(user: Doc<"users"> | null): AuthUser | null {
  if (!user) return null;

  const email = user.email || "";
  const emailHandle = email.includes("@") ? email.split("@")[0] : email;
  const emailFallback =
    emailHandle
      ? emailHandle
          .replace(/[._-]+/g, " ")
          .split(" ")
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" ")
      : "";

  const displayName =
    user.displayName ||
    user.fullName ||
    user.username ||
    user.name ||
    emailFallback ||
    "Player";

  return {
    ...user,
    uid: user.uid || (user._id as unknown as string),
    displayName,
    photoURL: user.image || undefined,
  };
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated: authReady, isLoading } = useConvexAuth();
  const currentUser = useQuery(api.users.getCurrentUser);
  const upsertCurrentUser = useMutation(api.users.upsertCurrentUser);
  const bootstrapInFlight = useRef(false);
  const bootstrapRetryCount = useRef(0);
  const [bootstrapNonce, setBootstrapNonce] = useState(0);

  const loading = isLoading || (authReady && currentUser == null);
  const user = useMemo(() => normalizeUser(currentUser ?? null), [currentUser]);
  const isAuthenticated = authReady && currentUser != null;

  useEffect(() => {
    if (!authReady) {
      bootstrapRetryCount.current = 0;
      return;
    }
    if (currentUser !== null) {
      bootstrapRetryCount.current = 0;
      return;
    }
    if (bootstrapInFlight.current) return;

    bootstrapInFlight.current = true;
    void upsertCurrentUser({})
      .then(() => {
        bootstrapRetryCount.current = 0;
      })
      .catch((error) => {
        const message =
          typeof error?.message === "string" ? error.message : String(error ?? "");
        if (message.includes("Not authenticated") && bootstrapRetryCount.current < 3) {
          bootstrapRetryCount.current += 1;
          setTimeout(() => {
            bootstrapInFlight.current = false;
            setBootstrapNonce((value) => value + 1);
          }, 400);
          return;
        }
      })
      .finally(() => {
        if (!bootstrapInFlight.current) return;
        bootstrapInFlight.current = false;
      });
  }, [authReady, currentUser, upsertCurrentUser, bootstrapNonce]);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}
