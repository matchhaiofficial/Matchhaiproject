import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthActions } from "@convex-dev/auth/react";

const CONVEX_AUTH_KEY_PREFIX = "__convexAuth";

export async function clearConvexAuthStorage(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter((key) =>
      key.startsWith(CONVEX_AUTH_KEY_PREFIX),
    );
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch {
    // Ignore storage cleanup errors; sign-out should still proceed.
  }
}

export function useConvexSignOut() {
  const { signOut } = useAuthActions();
  return async () => {
    await signOut();
    await clearConvexAuthStorage();
  };
}
