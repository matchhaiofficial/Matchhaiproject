// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authClient, AuthUser, AuthSession } from "../lib/auth-client";
import { convex } from "../lib/convex";
import { api } from "../../convex/_generated/api";
import { Id, Doc } from "../../convex/_generated/dataModel";

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
  refreshUser: async () => {},
  refreshSession: async () => false,
});

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: any }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userId, setUserId] = useState<Id<"users"> | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from Convex
  const fetchUserProfile = useCallback(async (authId: string) => {
    try {
      const profile = await convex.query(api.users.getByAuthId, { authId });
      if (profile) {
        setUser(profile);
        setUserId(profile._id);
      } else {
        setUser(null);
        setUserId(null);
      }
    } catch (error) {
      console.error("[AuthContext] Failed to fetch user profile:", error);
      setUser(null);
      setUserId(null);
    }
  }, []);

  // Refresh user profile
  const refreshUser = useCallback(async () => {
    if (authUser?.id) {
      await fetchUserProfile(authUser.id);
    }
  }, [authUser?.id, fetchUserProfile]);

  // Refresh session - call this after login/signup to ensure auth state is updated
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const { data } = await authClient.getSession();
      if (data?.user) {
        setAuthUser(data.user as AuthUser);
        setSession(data as AuthSession);
        await fetchUserProfile(data.user.id);
        return true;
      }
      return false;
    } catch (error) {
      console.error("[AuthContext] refreshSession failed:", error);
      return false;
    }
  }, [fetchUserProfile]);

  useEffect(() => {
    // Get initial session
    authClient.getSession().then(({ data }) => {
      if (data?.user) {
        setAuthUser(data.user as AuthUser);
        setSession(data as AuthSession);
        fetchUserProfile(data.user.id).finally(() => setLoading(false));
      } else {
        setAuthUser(null);
        setSession(null);
        setUser(null);
        setUserId(null);
        setLoading(false);
      }
    });

    // Subscribe to session changes
    // Note: The $store API may vary by Better Auth version, using type assertion for compatibility
    const store = authClient.$store as any;
    let unsubscribe: (() => void) | undefined;

    if (store?.listen) {
      unsubscribe = store.listen("session", (newSession: any) => {
        if (newSession?.user) {
          setAuthUser(newSession.user as AuthUser);
          setSession(newSession as AuthSession);
          fetchUserProfile(newSession.user.id);
        } else {
          setAuthUser(null);
          setSession(null);
          setUser(null);
          setUserId(null);
        }
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchUserProfile]);

  return (
    <AuthContext.Provider value={{ authUser, user, userId, loading, session, refreshUser, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}
