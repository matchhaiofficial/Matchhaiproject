// jest.config.js
// Testing foundation for the MatchHai Expo / React Native app.
// Uses the jest-expo preset (Expo SDK 54) so Expo + React Native modules
// transform correctly. See TESTING.md for usage.
module.exports = {
  preset: "jest-expo",

  // Global setup: reusable mocks for Expo modules, router, Convex, storage, etc.
  setupFiles: ["<rootDir>/jest/setupBeforeEnv.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest/setup.ts"],

  // Only run our own test trees. Never pick up tests inside node_modules.
  roots: ["<rootDir>/__tests__", "<rootDir>/src", "<rootDir>/convex"],
  testMatch: [
    "**/__tests__/**/*.test.(ts|tsx|js|jsx)",
    "**/*.test.(ts|tsx|js|jsx)",
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/.expo/",
    "<rootDir>/__tests__/fixtures/",
    "<rootDir>/__tests__/helpers/",
  ],

  // Transform ESM-shipped RN/Expo/Convex packages that Jest can't parse raw.
  // NOTE: no trailing slash inside the lookahead so prefix packages such as
  // `expo-modules-core` (required by the jest-expo preset) are also transformed.
  transformIgnorePatterns: [
    "node_modules/(?!(?:.pnpm/)?(" +
      "(jest-)?react-native|@react-native(-community)?|" +
      "expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|" +
      "react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|" +
      "sentry-expo|native-base|react-native-svg|" +
      "nativewind|react-native-css-interop|" +
      "convex|@convex-dev/.*|better-auth|@better-auth/.*|" +
      "lucide-react-native|react-native-qrcode-svg|" +
      "react-native-reanimated|react-native-worklets|" +
      "react-native-gesture-handler|react-native-toast-message|" +
      "zustand|rn-emoji-keyboard|date-fns))",
  ],

  moduleNameMapper: {
    // Static assets -> lightweight stub.
    "\\.(png|jpg|jpeg|gif|webp|svg|ttf|otf|woff|woff2|mp3|wav|m4a)$":
      "<rootDir>/jest/mocks/fileMock.js",
  },

  clearMocks: true,
  collectCoverageFrom: [
    "src/utils/**/*.{ts,tsx}",
    "src/services/**/*.{ts,tsx}",
    "constants/**/*.{ts,tsx}",
    "!**/*.d.ts",
  ],
  coverageDirectory: "<rootDir>/coverage",
  // Keep CI output readable; bump locally with --verbose if needed.
  verbose: false,
};
