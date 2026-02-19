import React, { createContext, useContext, useEffect, useMemo, useRef } from "react";
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

  const displayName =
    user.displayName ||
    user.fullName ||
    user.username ||
    user.name ||
    user.email ||
    "Player";

  return {
    ...user,
    uid: user.uid || (user._id as unknown as string),
    displayName,
    photoURL: user.image || undefined,
  };
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const currentUser = useQuery(api.users.getCurrentUser);
  const upsertCurrentUser = useMutation(api.users.upsertCurrentUser);
  const bootstrapAttempted = useRef(false);

  const loading = isLoading || (isAuthenticated && currentUser == null);
  const user = useMemo(() => normalizeUser(currentUser ?? null), [currentUser]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (currentUser !== null) return;
    if (bootstrapAttempted.current) return;

    bootstrapAttempted.current = true;
    void upsertCurrentUser({}).catch(() => {
      // If this fails, the UI will keep showing the loading state.
      // Log in the screen if needed.
    });
  }, [isAuthenticated, currentUser, upsertCurrentUser]);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}
