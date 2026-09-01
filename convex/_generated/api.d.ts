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
import type * as authz from "../authz.js";
import type * as bookingConflicts from "../bookingConflicts.js";
import type * as bookings from "../bookings.js";
import type * as chat from "../chat.js";
import type * as chatAuth from "../chatAuth.js";
import type * as chatIdentity from "../chatIdentity.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as demoSeed from "../demoSeed.js";
import type * as devCleanup from "../devCleanup.js";
import type * as devReset from "../devReset.js";
import type * as devTeamSeed from "../devTeamSeed.js";
import type * as discover from "../discover.js";
import type * as easypaisa from "../easypaisa.js";
import type * as easypaisaNode from "../easypaisaNode.js";
import type * as easypaisaRest from "../easypaisaRest.js";
import type * as externalApis from "../externalApis.js";
import type * as friendChat from "../friendChat.js";
import type * as http from "../http.js";
import type * as kyc from "../kyc.js";
import type * as kycGate from "../kycGate.js";
import type * as kycNotifications from "../kycNotifications.js";
import type * as maintenanceDue from "../maintenanceDue.js";
import type * as matchroomBroadcast from "../matchroomBroadcast.js";
import type * as matchroomLifecycle from "../matchroomLifecycle.js";
import type * as matchroomPricing from "../matchroomPricing.js";
import type * as matchrooms from "../matchrooms.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as phoneOtp from "../phoneOtp.js";
import type * as presence from "../presence.js";
import type * as psnTokenCache from "../psnTokenCache.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as pushNotificationsActions from "../pushNotificationsActions.js";
import type * as ratingEngine from "../ratingEngine.js";
import type * as reports from "../reports.js";
import type * as runtimeEnv from "../runtimeEnv.js";
import type * as social from "../social.js";
import type * as storage from "../storage.js";
import type * as superAdminAccess from "../superAdminAccess.js";
import type * as support from "../support.js";
import type * as supportEmail from "../supportEmail.js";
import type * as supportKnowledge from "../supportKnowledge.js";
import type * as teamChallengeChat from "../teamChallengeChat.js";
import type * as teamChallenges from "../teamChallenges.js";
import type * as teamChat from "../teamChat.js";
import type * as teams from "../teams.js";
import type * as timing from "../timing.js";
import type * as userVisibility from "../userVisibility.js";
import type * as users from "../users.js";
import type * as wallet from "../wallet.js";
import type * as withdrawalNotifications from "../withdrawalNotifications.js";
import type * as zoneAdminBooking from "../zoneAdminBooking.js";
import type * as zoneAdminResources from "../zoneAdminResources.js";
import type * as zoneAudit from "../zoneAudit.js";
import type * as zoneBranchMigration from "../zoneBranchMigration.js";
import type * as zonePilot from "../zonePilot.js";
import type * as zoneWallet from "../zoneWallet.js";
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
  authz: typeof authz;
  bookingConflicts: typeof bookingConflicts;
  bookings: typeof bookings;
  chat: typeof chat;
  chatAuth: typeof chatAuth;
  chatIdentity: typeof chatIdentity;
  crons: typeof crons;
  dashboard: typeof dashboard;
  demoSeed: typeof demoSeed;
  devCleanup: typeof devCleanup;
  devReset: typeof devReset;
  devTeamSeed: typeof devTeamSeed;
  discover: typeof discover;
  easypaisa: typeof easypaisa;
  easypaisaNode: typeof easypaisaNode;
  easypaisaRest: typeof easypaisaRest;
  externalApis: typeof externalApis;
  friendChat: typeof friendChat;
  http: typeof http;
  kyc: typeof kyc;
  kycGate: typeof kycGate;
  kycNotifications: typeof kycNotifications;
  maintenanceDue: typeof maintenanceDue;
  matchroomBroadcast: typeof matchroomBroadcast;
  matchroomLifecycle: typeof matchroomLifecycle;
  matchroomPricing: typeof matchroomPricing;
  matchrooms: typeof matchrooms;
  migrations: typeof migrations;
  notifications: typeof notifications;
  phoneOtp: typeof phoneOtp;
  presence: typeof presence;
  psnTokenCache: typeof psnTokenCache;
  pushNotifications: typeof pushNotifications;
  pushNotificationsActions: typeof pushNotificationsActions;
  ratingEngine: typeof ratingEngine;
  reports: typeof reports;
  runtimeEnv: typeof runtimeEnv;
  social: typeof social;
  storage: typeof storage;
  superAdminAccess: typeof superAdminAccess;
  support: typeof support;
  supportEmail: typeof supportEmail;
  supportKnowledge: typeof supportKnowledge;
  teamChallengeChat: typeof teamChallengeChat;
  teamChallenges: typeof teamChallenges;
  teamChat: typeof teamChat;
  teams: typeof teams;
  timing: typeof timing;
  userVisibility: typeof userVisibility;
  users: typeof users;
  wallet: typeof wallet;
  withdrawalNotifications: typeof withdrawalNotifications;
  zoneAdminBooking: typeof zoneAdminBooking;
  zoneAdminResources: typeof zoneAdminResources;
  zoneAudit: typeof zoneAudit;
  zoneBranchMigration: typeof zoneBranchMigration;
  zonePilot: typeof zonePilot;
  zoneWallet: typeof zoneWallet;
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
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};
