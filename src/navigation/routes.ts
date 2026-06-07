export const APP_ROUTES = {
  authLogin: "/auth/login",
  playerHome: "/(player)/(tabs)",
  playerDiscover: "/(player)/(tabs)/discover",
  playerInbox: "/(player)/inbox",
  playerWallet: "/(player)/wallet",
  playerSupport: "/(player)/support",
  playerReports: "/(player)/reports",
  playerKyc: "/auth/verification-required",
  zoneHome: "/zone",
  zoneNotifications: "/zone/modules/notifications",
  zoneBookings: "/zone/modules/bookings",
  zoneWallet: "/zone/wallet",
  zoneProfile: "/zone/(tabs)/profile",
  zoneSupport: "/zone/modules/support",
  superAdminHome: "/super-admin",
  superAdminReports: "/super-admin/reports",
  superAdminSupportTickets: "/super-admin/support-tickets",
  superAdminWithdrawals: "/super-admin/withdrawals",
  superAdminIdentityVerifications: "/super-admin/identity-verifications",
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

type NotificationRouteRole = "player" | "zone_admin" | "super_admin" | string;

type NotificationRouteInput = {
  type?: string | null;
  route?: string | null;
  href?: string | null;
  recipientRole?: NotificationRouteRole | null;
  matchroomId?: unknown;
  teamId?: unknown;
  data?: Record<string, any> | null;
};

function asRouteString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function withQuery(pathname: string, params: Record<string, unknown>) {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return query ? `${pathname}?${query}` : pathname;
}

export function buildMatchroomHref(matchroomId: unknown) {
  const id = asRouteString(matchroomId);
  return id ? `/matchrooms/${encodeURIComponent(id)}` : APP_ROUTES.playerInbox;
}

export function buildMatchroomPaymentHref(intentId: unknown, matchroomId?: unknown) {
  const id = asRouteString(intentId);
  return id ? `/matchrooms/book/pay/${encodeURIComponent(id)}` : buildMatchroomHref(matchroomId);
}

export function buildTeamHref(teamId: unknown) {
  const id = asRouteString(teamId);
  return id ? `/teams/${encodeURIComponent(id)}` : "/teams";
}

export function buildTeamChallengeHref(challengeId: unknown) {
  const id = asRouteString(challengeId);
  return id ? withQuery("/teams/challenge", { id }) : "/teams/challenges";
}

export function buildZoneBookingRequestHref(requestId?: unknown) {
  return withQuery(APP_ROUTES.zoneBookings, {
    segment: "requests",
    requestId,
    expandedRequestId: requestId,
    focusRequestId: requestId,
  });
}

export function buildZoneBookingMatchroomHref(matchroomId?: unknown) {
  return withQuery(APP_ROUTES.zoneBookings, {
    segment: "matchrooms",
    matchroomId,
  });
}

export function buildSuperAdminReportHref(reportId?: unknown) {
  const id = asRouteString(reportId);
  return id ? `/super-admin/report/${encodeURIComponent(id)}` : APP_ROUTES.superAdminReports;
}

export function buildPlayerReportHref(reportId?: unknown) {
  const id = asRouteString(reportId);
  return id ? `/(player)/report/${encodeURIComponent(id)}` : APP_ROUTES.playerReports;
}

export function buildSuperAdminSupportTicketHref(ticketId?: unknown) {
  const id = asRouteString(ticketId);
  return id ? `/super-admin/support-ticket/${encodeURIComponent(id)}` : APP_ROUTES.superAdminSupportTickets;
}

function normalizeExplicitNotificationRoute(route?: string | null) {
  const text = asRouteString(route);
  if (!text) return undefined;
  if (text === "/zone/profile") return APP_ROUTES.zoneProfile;
  if (text === "/super-admin/reports") return APP_ROUTES.superAdminReports;
  return text;
}

export function buildNotificationRoute(input: NotificationRouteInput) {
  const data = input.data || {};
  const type = String(input.type || data.canonicalType || "").trim().toLowerCase();
  const role = String(input.recipientRole || data.recipientRole || "").trim().toLowerCase();
  const explicitRoute = normalizeExplicitNotificationRoute(input.route || input.href || data.route || data.href);
  const matchroomId = input.matchroomId || data.matchroomId;
  const teamId = input.teamId || data.teamId;
  const requestId = data.requestId || data.requestRef;
  const intentId = data.intentId;
  const offerId = data.offerId;
  const challengeId = data.challengeId;
  const reportId = data.reportId;
  const ticketId = data.ticketId || data.supportTicketId;

  if (type === "booking.request_submitted") {
    return role === "zone_admin" ? buildZoneBookingRequestHref(requestId) : buildMatchroomHref(matchroomId);
  }
  if (type === "booking.counter_offer_result") return buildZoneBookingRequestHref(requestId);
  if (type === "booking.counter_offer") return APP_ROUTES.playerInbox;
  if (type === "booking.request_accepted" || type === "booking.request_rejected" || type === "booking.request_closed_elsewhere") {
    return buildMatchroomHref(matchroomId);
  }

  if (type === "match.payment_required") return buildMatchroomPaymentHref(intentId, matchroomId);
  if (type === "match.join_request" || type === "match.join_request_result" || type.startsWith("match.")) {
    return buildMatchroomHref(matchroomId);
  }
  if (type === "zone.matchroom_full") return buildZoneBookingMatchroomHref(matchroomId);

  if (
    type === "team.challenge_received" ||
    type === "team.challenge_payment_required" ||
    type === "team.challenge_updated"
  ) {
    return buildTeamChallengeHref(challengeId);
  }
  if (type.startsWith("team.")) return buildTeamHref(teamId);

  if (type.startsWith("withdrawal.")) {
    if (role === "super_admin" || role === "super-admin") return APP_ROUTES.superAdminWithdrawals;
    return APP_ROUTES.zoneWallet;
  }

  if (type === "kyc.review_needed") return APP_ROUTES.superAdminIdentityVerifications;
  if (type === "kyc.status_updated") return role === "zone_admin" ? APP_ROUTES.zoneProfile : APP_ROUTES.playerKyc;

  if (type.startsWith("support.")) {
    if (role === "super_admin") return buildSuperAdminSupportTicketHref(ticketId);
    if (role === "zone_admin") return APP_ROUTES.zoneSupport;
    return APP_ROUTES.playerSupport;
  }
  if (type.startsWith("moderation.") || type.includes("report")) {
    if (role === "super_admin") return buildSuperAdminReportHref(reportId);
    if (role === "zone_admin") return reportId ? `/zone/report/${encodeURIComponent(String(reportId))}` : APP_ROUTES.zoneSupport;
    return buildPlayerReportHref(reportId);
  }

  if (challengeId) return buildTeamChallengeHref(challengeId);
  if (offerId && role === "zone_admin") return buildZoneBookingRequestHref(requestId);
  if (requestId && role === "zone_admin") return buildZoneBookingRequestHref(requestId);
  if (matchroomId) return buildMatchroomHref(matchroomId);
  if (teamId) return buildTeamHref(teamId);
  if (explicitRoute) return explicitRoute;
  if (role === "zone_admin") return APP_ROUTES.zoneNotifications;
  if (role === "super_admin" || role === "super-admin") return APP_ROUTES.superAdminHome;
  return APP_ROUTES.playerInbox;
}
