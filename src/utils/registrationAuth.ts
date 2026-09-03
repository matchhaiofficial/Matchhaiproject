const DEFAULT_OPERATION_RETRY_DELAYS_MS = [0, 300, 700, 1200];
const DEFAULT_SESSION_PROBE_DELAYS_MS = [0, 250, 500, 900, 1400, 2200, 3000];

function sleep(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

function errorText(error: unknown) {
  if (error instanceof Error) return error.message.toLowerCase();
  return String(error || "").toLowerCase();
}

export function isRegistrationAuthSyncError(error: unknown) {
  const message = errorText(error);
  return (
    message.includes("unauthenticated") ||
    message.includes("user profile not found") ||
    message.includes("not authorized")
  );
}

export async function retryRegistrationAuthOperation<T>(
  operation: () => Promise<T>,
  retryDelaysMs = DEFAULT_OPERATION_RETRY_DELAYS_MS,
): Promise<T> {
  let lastError: unknown;

  for (const delayMs of retryDelaysMs) {
    if (delayMs > 0) await sleep(delayMs);

    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRegistrationAuthSyncError(error)) throw error;
    }
  }

  throw lastError;
}

export async function waitForExpectedRegistrationUser(
  expectedUserId: string,
  probeCurrentUserId: () => Promise<string | null>,
  retryDelaysMs = DEFAULT_SESSION_PROBE_DELAYS_MS,
) {
  for (const delayMs of retryDelaysMs) {
    if (delayMs > 0) await sleep(delayMs);

    try {
      const currentUserId = await probeCurrentUserId();
      if (currentUserId === expectedUserId) return true;
    } catch {
      // The auth bridge can briefly be anonymous while Better Auth propagates
      // the newly-created session to Convex. Keep probing within the bounded window.
    }
  }

  return false;
}
