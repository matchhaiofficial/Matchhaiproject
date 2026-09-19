import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function expectExports(relativePath: string, names: string[]) {
  const source = read(relativePath);
  for (const name of names) {
    expect(source).toMatch(new RegExp(`export const ${name}\\s*=`));
  }
}

function expectClientCalls(relativePath: string, calls: string[]) {
  const source = read(relativePath);
  for (const call of calls) {
    expect(source).toContain(`api.${call}`);
  }
}

describe("critical user journey wiring contracts", () => {
  // These are modular wiring checks, not end-to-end tests. They run without a
  // Convex deployment and make a missing server entry point fail in CI before
  // a screen/service can silently call a nonexistent function.
  it("covers the matchroom create → join → result → settlement journey", () => {
    expectExports("convex/matchrooms.ts", [
      "create",
      "join",
      "requestToJoinMatchroom",
      "respondToMatchroomJoinRequest",
      "submitCaptainReport",
      "submitParticipantVote",
      "getPendingResultForUser",
      "reconcileFinalizedRatings",
      "settleVenuePayoutAfterResult",
    ]);

    const source = read("convex/matchrooms.ts");
    expect(source).toContain("assertUserCanJoinRoom");
    expect(source).toContain("assertRosterHasNoBlockedPair");
    expect(source).toContain("deductWalletFunds");
    expect(source).toContain("resultVerification");
    expect(source).toContain("venuePayoutEligibleAt");
    expectClientCalls("src/services/convex/matchService.ts", [
      "matchrooms.create",
      "matchrooms.join",
      "matchrooms.submitCaptainReport",
      "matchrooms.submitParticipantVote",
    ]);
  });

  it("covers the team challenge create → pay → accept → venue → matchroom journey", () => {
    expectExports("convex/teamChallenges.ts", [
      "createFull",
      "payTeamChallengeSideFromWallet",
      "respond",
      "proposeVenue",
      "suggestAlternativeVenue",
      "confirmVenue",
      "processScheduledExpiry",
    ]);
    expectExports("convex/matchrooms.ts", ["createTeamChallengeMatchroom"]);

    const source = read("convex/teamChallenges.ts");
    expect(source).toContain("assertChallengeVenueAvailable");
    expect(source).toContain("holdChallengeSide");
    expect(source).toContain("releaseChallengeHolds");
    expect(source).toContain("matchroomId");
    expectClientCalls("src/services/convex/teamMatchService.ts", [
      "teamChallenges.createFull",
      "teamChallenges.respond",
      "teamChallenges.proposeVenue",
      "teamChallenges.suggestAlternativeVenue",
      "teamChallenges.payTeamChallengeSideFromWallet",
    ]);
  });

  it("keeps matchroom, team-challenge, and direct chat flows authorized", () => {
    expectExports("convex/chat.ts", ["getOrCreateForMatchroom", "sendMessageToMatchroom", "listMessagesForMatchroom"]);
    expectExports("convex/teamChallengeChat.ts", ["getAccess", "sendMessage", "listMessages"]);
    expectExports("convex/friendChat.ts", ["getOrCreateDM", "sendMessage", "listMessages"]);

    const matchChat = read("convex/chat.ts");
    const challengeChat = read("convex/teamChallengeChat.ts");
    const friendChat = read("convex/friendChat.ts");
    expect(matchChat).toContain("requireAuthorizedMatchroomParticipant");
    expect(matchChat).toContain("requireAuthorizedChatroomParticipant");
    expect(challengeChat).toContain("requireChatParticipant");
    expect(friendChat).toContain("getStrictAuthenticatedUserId");
    expect(friendChat).toContain("ensureFriendship");
    for (const source of [matchChat, challengeChat, friendChat]) {
      expect(source).toContain("clientMessageId");
      expect(source).toContain("ctx.scheduler.runAfter");
    }
    expectClientCalls("app/matchrooms/chat/[id].tsx", [
      "chat.getOrCreateForMatchroom",
      "chat.sendMessageToMatchroom",
    ]);
    expectClientCalls("app/teams/challenge-chat.tsx", [
      "teamChallengeChat.sendMessage",
      "teamChallengeChat.listMessages",
    ]);
    expectClientCalls("app/(player)/friend-chat/[friendId].tsx", [
      "friendChat.getOrCreateDM",
      "friendChat.sendMessage",
    ]);
  });

  it("connects report and block actions to shared abuse controls", () => {
    expectExports("convex/reports.ts", [
      "createMatchroomComplaint",
      "createUserReport",
      "createZoneComplaint",
      "createFriendChatMessageReport",
      "createMatchroomChatMessageReport",
      "createTeamChallengeChatMessageReport",
      "updateStatus",
    ]);
    expectExports("convex/social.ts", ["blockUser", "unblockUser", "isEitherBlocked"]);

    const reports = read("convex/reports.ts");
    const social = read("convex/social.ts");
    expect(reports).toContain("ensureUserBlock");
    expect(reports).toContain("requireCurrentUser");
    expect(social).toContain("requireSelf");
    expectClientCalls("src/services/convex/reportService.ts", [
      "reports.createMatchroomComplaint",
      "reports.createUserReport",
      "reports.createZoneComplaint",
    ]);
    expectClientCalls("src/services/convex/socialService.ts", [
      "social.blockUser",
      "social.unblockUser",
    ]);
  });

  it("covers player signup identity → phone OTP → KYC gates", () => {
    expectExports("convex/users.ts", ["getCurrentRegistrationState", "validateRegistrationIdentity", "create", "completeOnboarding"]);
    expectExports("convex/phoneOtp.ts", ["sendPhoneOtp", "verifyPhoneOtp"]);
    expectExports("convex/kyc.ts", ["getCurrentUserKyc", "createDiditKycStartIntent"]);

    const users = read("convex/users.ts");
    const otp = read("convex/phoneOtp.ts");
    const kyc = read("convex/kyc.ts");
    expect(users).toContain("phoneOtp.getRecentVerified");
    expect(users).toContain("phoneOtpVerified");
    expect(otp).toContain("markVerified");
    expect(kyc).toContain("getAuthIdFromContextOrSessionToken");
    expectClientCalls("src/services/convex/phoneOtpService.ts", [
      "phoneOtp.sendPhoneOtp",
      "phoneOtp.verifyPhoneOtp",
    ]);
    expectClientCalls("src/services/convex/authService.ts", ["users.create"]);
    expectClientCalls("src/hooks/useDiditKyc.ts", ["kyc.createDiditKycStartIntent"]);
  });

  it("covers zone-admin hours → resources → booking → counter-offer actions", () => {
    expectExports("convex/zoneAdminBooking.ts", [
      "listBookingQueuePageForZone",
      "acceptBookingRequest",
      "rejectBookingRequest",
      "sendCounterOffer",
      "respondToCounterOffer",
      "createWalkInMatchroom",
    ]);
    expectExports("convex/zoneAdminResources.ts", [
      "listResourcesByZoneAndBranch",
      "updateResourceLifecycleStatus",
      "syncBranchResourcesFromPricing",
      "allocateResourcesToRequest",
    ]);

    const booking = read("convex/zoneAdminBooking.ts");
    const resources = read("convex/zoneAdminResources.ts");
    const hours = read("convex/branchOperatingHours.ts");
    expect(booking).toContain("assertRequestBelongsToZone");
    expect(booking).toContain("assertBranchOperatingHoursAvailable");
    expect(booking).toContain("scheduleMatchroomLifecycle");
    expect(resources).toContain("requireOwnedZone");
    expect(resources).toContain("refreshBranchResourceCapacitySnapshot");
    expect(hours).toContain("getBranchOperatingHoursAvailability");
    expectClientCalls("src/services/convex/zoneAdminBookingService.ts", [
      "zoneAdminBooking.acceptBookingRequest",
      "zoneAdminBooking.rejectBookingRequest",
      "zoneAdminBooking.sendCounterOffer",
      "zoneAdminBooking.respondToCounterOffer",
    ]);
    expectClientCalls("src/services/convex/zoneAdminResourceService.ts", [
      "zoneAdminResources.updateResourceLifecycleStatus",
      "zoneAdminResources.allocateResourcesToRequest",
    ]);
  });

  it("covers super-admin auth, audit, moderation, and operational actions", () => {
    expectExports("convex/admin.ts", [
      "getDashboardSummary",
      "recordSuperAdminAudit",
      "listUsersPage",
      "listReportsPage",
      "setReportStatus",
      "setZoneStatus",
      "grantSuperAdmin",
      "revokeSuperAdmin",
    ]);

    const admin = read("convex/admin.ts");
    const authz = read("convex/authz.ts");
    expect(admin).toContain("async function getAuthenticatedAdmin");
    expect(admin).toContain("isAuthorizedSuperAdmin(profile, email)");
    expect(admin).toContain("recordSuperAdminAudit");
    expect(admin).toContain("assertCanActOnSuperAdminTarget");
    expect(authz).toContain("export async function requireSuperAdmin");
    expectClientCalls("src/services/convex/superAdminService.ts", [
      "admin.getDashboardSummary",
      "admin.listUsers",
      "admin.listReports",
      "admin.setReportStatus",
      "admin.setZoneStatus",
      "admin.grantSuperAdmin",
      "admin.revokeSuperAdmin",
    ]);
  });
});
