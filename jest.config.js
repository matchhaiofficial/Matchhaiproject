// jest.config.js
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testMatch: ["**/__tests__/**/*.test.(ts|tsx|js)"],
  transformIgnorePatterns: [
    "node_modules/(?!(jest-)?react-native|@react-native|@react-native-community|expo(nent)?|expo-router|@expo|@unimodules|unimodules|sentry-expo|nativewind|react-native-svg|react-native-gesture-handler|react-native-reanimated|react-native-safe-area-context|@react-navigation)",
  ],
};
