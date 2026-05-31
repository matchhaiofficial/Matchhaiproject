export const APP_ROUTES = {
  authLogin: "/auth/login",
  playerHome: "/(player)/(tabs)",
  playerDiscover: "/(player)/(tabs)/discover",
  zoneHome: "/zone",
  superAdminHome: "/super-admin",
  authChangePassword: "/auth/change-password",
} as const;

export type DiscoverSegmentRoute =
  | "matchrooms"
  | "players"
  | "teams"
  | "zones";

type DiscoverParams = {
  mode?: string;
  t?: string;
};

export function buildDiscoverHref(
  segment: DiscoverSegmentRoute,
  params?: DiscoverParams,
) {
  return {
    pathname: APP_ROUTES.playerDiscover,
    params: {
      segment,
      ...params,
    },
  } as const;
}

export function buildLegacyMatchroomsHref() {
  return buildDiscoverHref("matchrooms");
}

export function buildLegacyTeamsHref(mode: "my" | "discover" = "my") {
  return buildDiscoverHref("teams", { mode });
}
