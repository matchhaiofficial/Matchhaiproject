// jest/setupBeforeEnv.ts
// Runs BEFORE the test framework is installed. Use for env vars / global
// polyfills that modules read at import time.

// Provide a safe staging-like Convex URL so src/lib/convex.ts (which throws on
// missing / placeholder URLs) can be imported in tests without a real backend.
// This is a dummy value; no network calls are made because convex/react is mocked.
process.env.EXPO_PUBLIC_CONVEX_URL =
  process.env.EXPO_PUBLIC_CONVEX_URL || "https://test-deployment.convex.cloud";
process.env.EXPO_PUBLIC_CONVEX_SITE_URL =
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL || "https://test-deployment.convex.site";
process.env.EXPO_PUBLIC_APP_SCHEME = process.env.EXPO_PUBLIC_APP_SCHEME || "matchhai";
process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL =
  process.env.EXPO_PUBLIC_SUPER_ADMIN_EMAIL || "superadmin@matchhai.com";
process.env.EXPO_PUBLIC_TOUCH_DEBUG = "0";
// Mark the test environment so monitoring / logging helpers can no-op.
process.env.EXPO_PUBLIC_ENV = process.env.EXPO_PUBLIC_ENV || "test";

// Silence noisy native warnings that are irrelevant in unit tests.
process.env.EXPO_OS = process.env.EXPO_OS || "ios";
