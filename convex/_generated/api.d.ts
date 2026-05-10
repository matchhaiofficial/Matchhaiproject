/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as auth from "../auth.js";
import type * as bookings from "../bookings.js";
import type * as chat from "../chat.js";
import type * as chatAuth from "../chatAuth.js";
import type * as chatIdentity from "../chatIdentity.js";
import type * as dashboard from "../dashboard.js";
import type * as demoSeed from "../demoSeed.js";
import type * as devReset from "../devReset.js";
import type * as devTeamSeed from "../devTeamSeed.js";
import type * as discover from "../discover.js";
import type * as easypaisa from "../easypaisa.js";
import type * as easypaisaNode from "../easypaisaNode.js";
import type * as easypaisaRest from "../easypaisaRest.js";
import type * as externalApis from "../externalApis.js";
import type * as friendChat from "../friendChat.js";
import type * as http from "../http.js";
import type * as matchroomBroadcast from "../matchroomBroadcast.js";
import type * as matchrooms from "../matchrooms.js";
import type * as notifications from "../notifications.js";
import type * as psnTokenCache from "../psnTokenCache.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as pushNotificationsActions from "../pushNotificationsActions.js";
import type * as reports from "../reports.js";
import type * as social from "../social.js";
import type * as storage from "../storage.js";
import type * as support from "../support.js";
import type * as teamChallengeChat from "../teamChallengeChat.js";
import type * as teamChallenges from "../teamChallenges.js";
import type * as teams from "../teams.js";
import type * as userVisibility from "../userVisibility.js";
import type * as users from "../users.js";
import type * as wallet from "../wallet.js";
import type * as zoneAdminBooking from "../zoneAdminBooking.js";
import type * as zoneAdminResources from "../zoneAdminResources.js";
import type * as zoneAudit from "../zoneAudit.js";
import type * as zoneBranchMigration from "../zoneBranchMigration.js";
import type * as zoneWithdrawals from "../zoneWithdrawals.js";
import type * as zones from "../zones.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  auth: typeof auth;
  bookings: typeof bookings;
  chat: typeof chat;
  chatAuth: typeof chatAuth;
  chatIdentity: typeof chatIdentity;
  dashboard: typeof dashboard;
  demoSeed: typeof demoSeed;
  devReset: typeof devReset;
  devTeamSeed: typeof devTeamSeed;
  discover: typeof discover;
  easypaisa: typeof easypaisa;
  easypaisaNode: typeof easypaisaNode;
  easypaisaRest: typeof easypaisaRest;
  externalApis: typeof externalApis;
  friendChat: typeof friendChat;
  http: typeof http;
  matchroomBroadcast: typeof matchroomBroadcast;
  matchrooms: typeof matchrooms;
  notifications: typeof notifications;
  psnTokenCache: typeof psnTokenCache;
  pushNotifications: typeof pushNotifications;
  pushNotificationsActions: typeof pushNotificationsActions;
  reports: typeof reports;
  social: typeof social;
  storage: typeof storage;
  support: typeof support;
  teamChallengeChat: typeof teamChallengeChat;
  teamChallenges: typeof teamChallenges;
  teams: typeof teams;
  userVisibility: typeof userVisibility;
  users: typeof users;
  wallet: typeof wallet;
  zoneAdminBooking: typeof zoneAdminBooking;
  zoneAdminResources: typeof zoneAdminResources;
  zoneAudit: typeof zoneAudit;
  zoneBranchMigration: typeof zoneBranchMigration;
  zoneWithdrawals: typeof zoneWithdrawals;
  zones: typeof zones;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
