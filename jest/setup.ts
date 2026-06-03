// jest/setup.ts
// Runs AFTER the test framework is installed (jest globals available).
// Reusable, defensive mocks for native/Expo/Convex modules so component and
// service tests run deterministically with no real network or native bridge.
//
// Philosophy: keep mocks minimal and override per-test where behaviour matters.
// Tests can do: `const { useQuery } = require("convex/react");
// (useQuery as jest.Mock).mockReturnValue(...)`.

import "@testing-library/react-native/extend-expect";

/* -------------------------------------------------------------------------- */
/* Storage                                                                    */
/* -------------------------------------------------------------------------- */
jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    getItemAsync: jest.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    isAvailableAsync: jest.fn(async () => true),
    WHEN_UNLOCKED: "whenUnlocked",
  };
});

/* -------------------------------------------------------------------------- */
/* Expo modules                                                               */
/* -------------------------------------------------------------------------- */
jest.mock("expo-haptics", () => ({
  __esModule: true,
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

jest.mock("expo-clipboard", () => ({
  __esModule: true,
  setStringAsync: jest.fn(async () => true),
  getStringAsync: jest.fn(async () => ""),
}));

jest.mock("expo-linking", () => ({
  __esModule: true,
  createURL: jest.fn((path: string) => `matchhai://${path}`),
  openURL: jest.fn(async () => {}),
  parse: jest.fn((url: string) => ({ path: url, queryParams: {} })),
  useURL: jest.fn(() => null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock("expo-notifications", () => ({
  __esModule: true,
  getPermissionsAsync: jest.fn(async () => ({ status: "granted", granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted", granted: true })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[test]" })),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(async () => "notif-id"),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  setNotificationChannelAsync: jest.fn(async () => {}),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
}));

jest.mock("expo-web-browser", () => ({
  __esModule: true,
  openBrowserAsync: jest.fn(async () => ({ type: "opened" })),
  openAuthSessionAsync: jest.fn(async () => ({ type: "success", url: "" })),
  maybeCompleteAuthSession: jest.fn(),
}));

/* -------------------------------------------------------------------------- */
/* expo-router                                                                */
/* -------------------------------------------------------------------------- */
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  dismiss: jest.fn(),
  dismissAll: jest.fn(),
  setParams: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock("expo-router", () => {
  const React = require("react");
  return {
    __esModule: true,
    router: mockRouter,
    useRouter: () => mockRouter,
    useLocalSearchParams: jest.fn(() => ({})),
    useGlobalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => []),
    usePathname: jest.fn(() => "/"),
    useFocusEffect: jest.fn(),
    useNavigation: jest.fn(() => ({ navigate: jest.fn(), goBack: jest.fn() })),
    Link: ({ children }: any) => React.createElement(React.Fragment, null, children),
    Redirect: () => null,
    Stack: Object.assign(({ children }: any) => children, { Screen: () => null }),
    Tabs: Object.assign(({ children }: any) => children, { Screen: () => null }),
    Slot: ({ children }: any) => children,
  };
});

/* -------------------------------------------------------------------------- */
/* Convex (React hooks + client)                                              */
/* -------------------------------------------------------------------------- */
jest.mock("convex/react", () => {
  const React = require("react");
  class FakeConvexReactClient {
    url: string;
    constructor(url: string) {
      this.url = url;
    }
    query = jest.fn();
    mutation = jest.fn();
    action = jest.fn();
    watchQuery = jest.fn();
    setAuth = jest.fn();
    clearAuth = jest.fn();
    close = jest.fn();
    connectionState = jest.fn(() => ({ isWebSocketConnected: true }));
  }
  return {
    __esModule: true,
    ConvexReactClient: FakeConvexReactClient,
    ConvexProvider: ({ children }: any) => children,
    ConvexProviderWithAuth: ({ children }: any) => children,
    // Default to "no data yet"; override per test.
    useQuery: jest.fn(() => undefined),
    useMutation: jest.fn(() => jest.fn(async () => undefined)),
    useAction: jest.fn(() => jest.fn(async () => undefined)),
    usePaginatedQuery: jest.fn(() => ({
      results: [],
      status: "Exhausted",
      isLoading: false,
      loadMore: jest.fn(),
    })),
    useConvexAuth: jest.fn(() => ({ isLoading: false, isAuthenticated: true })),
    useConvex: jest.fn(() => new FakeConvexReactClient("https://test.convex.cloud")),
    Authenticated: ({ children }: any) => children,
    Unauthenticated: () => null,
    AuthLoading: () => null,
  };
});

/* -------------------------------------------------------------------------- */
/* Gestures / animation                                                       */
/* -------------------------------------------------------------------------- */
try {
  require("react-native-gesture-handler/jestSetup");
} catch {
  // optional
}

jest.mock("react-native-reanimated", () => {
  try {
    const Reanimated = require("react-native-reanimated/mock");
    // The mock doesn't define `call`; provide a no-op.
    Reanimated.default.call = () => {};
    return Reanimated;
  } catch {
    return {};
  }
});

jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
  show: jest.fn(),
  hide: jest.fn(),
}));

/* -------------------------------------------------------------------------- */
/* Global noise reduction                                                     */
/* -------------------------------------------------------------------------- */
// Silence the known Animated/NativeAnimatedHelper warning some RN versions emit,
// while keeping all other warnings visible.
const originalWarn = global.console.warn.bind(global.console);
jest.spyOn(global.console, "warn").mockImplementation((...args: any[]) => {
  const msg = String(args[0] ?? "");
  if (msg.includes("NativeAnimatedHelper") || msg.includes("useNativeDriver")) return;
  originalWarn(...args);
});
