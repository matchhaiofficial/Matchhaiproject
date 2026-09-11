import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("urgent server-authority regressions", () => {
  // Regression: ISSUE-001 — zone owners could act on another zone's request.
  // Found by /qa on 2026-09-05.
  it("binds every zone booking decision to the request's persisted zone", () => {
    const source = read("convex/zoneAdminBooking.ts");
    const calls = source.match(/assertRequestBelongsToZone\(/g) || [];

    expect(calls.length).toBeGreaterThanOrEqual(4); // helper + accept/reject/counter-offer
    expect(source).toContain("This booking request does not belong to your zone.");
    expect(source).not.toContain("allocatedByUid: args.adminUid");
    expect(source).not.toContain("zoneOwnerUid: args.zoneOwnerUid");
  });

  // Regression: ISSUE-002 — alternate times could validate different epochs
  // from those persisted by the counter-offer.
  // Found by /qa on 2026-09-05.
  it("derives every persisted counter-offer time in Asia/Karachi", () => {
    const source = read("convex/zoneAdminBooking.ts");
    const dateTime = read("convex/karachiDateTime.ts");

    expect(source).toContain('from "./karachiDateTime"');
    expect(dateTime).toContain('new Date(`${date}T${time}:00${KARACHI_UTC_OFFSET}`)');
    expect(source).toContain("const startAt = parseKarachiDateTimeMillis(date, time)");
    expect(source).toContain("Math.abs(startAt - originalStartMs!)");
    expect(source).toContain("Client-supplied epoch fields are");
  });

  // Regression: ISSUE-003 — either captain could patch privileged challenge state.
  // Found by /qa on 2026-09-05.
  it("rejects generic lifecycle writes and validates venue records", () => {
    const source = read("convex/teamChallenges.ts");

    expect(source).toContain("Use the dedicated challenge action for lifecycle, venue, and matchroom changes");
    expect(source).toContain('if (!zone || zone.status !== "active")');
    expect(source).toContain("Only the challenged captain can suggest an alternative venue");
    expect(source).toContain("isAccountSuspensionActive(user)");
  });

  // Regression: ISSUE-004 — email failure made a committed withdrawal look failed.
  // Found by /qa on 2026-09-05.
  it("makes withdrawals idempotent and email delivery non-authoritative", () => {
    const action = read("convex/zoneWithdrawals.ts");
    const wallet = read("convex/wallet.ts");

    expect(action).toContain("assertKycFullyVerified");
    expect(action).toContain("Withdrawal saved but email delivery failed");
    expect(wallet).toContain("requestKey: v.optional(v.string())");
    expect(wallet).toContain('withIndex("by_reference"');
    expect(wallet).toContain("already used with different details");
    expect(wallet).toContain('suppliedRequestKey = String(args.requestKey || "").trim()');
    expect(wallet).toContain('transaction.status === "pending"');
    expect(wallet).toContain('Math.floor(now / (10 * 60 * 1000))');
  });

  // Regression: ISSUE-005 — a same-type checkout could be reused for another entity.
  // Found by /qa on 2026-09-05.
  it("compares exact checkout context identity before reuse", () => {
    const source = read("convex/easypaisa.ts");

    expect(source).toContain("getCheckoutContextIdentity(checkoutContext)");
    expect(source).toContain('return `team:${String(context.teamChallengeHold.challengeId || "")}:${String(context.teamChallengeHold.side || "")}`');
    expect(source).toContain("stableCheckoutContextValue(context.matchroomCreateArgs)");
  });

  // Regression: ISSUE-006 — approval calculated a due time but did not enqueue it.
  // Found by /qa on 2026-09-05.
  it("schedules matchroom lifecycle immediately after zone acceptance", () => {
    const source = read("convex/zoneAdminBooking.ts");
    const migrations = read("convex/migrations.ts");
    const pilot = read("convex/zonePilot.ts");
    const admin = read("convex/admin.ts");
    const deletion = read("convex/accountDeletion.ts");
    const matchrooms = read("convex/matchrooms.ts");

    expect(source).toContain("async function scheduleMatchroomLifecycle");
    expect(source).toContain("internal.matchrooms.processScheduledLifecycle");
    expect(source).toContain("await scheduleMatchroomLifecycle(ctx, matchroomId)");
    expect(source).toContain("syncMatchroomMembers(ctx, matchroomId");
    expect(source).toContain("assertNewGameEntityCreationAllowed(args.gameKey)");
    expect(migrations).toContain("scheduleExistingMatchroomLifecycles");
    expect(migrations).toContain("scheduleExistingTeamChallengeLifecycles");
    expect(migrations).toContain("reschedulePendingTeamChallengeAcceptDeadlines");
    expect(migrations).toContain("scheduleExistingZoneOfferExpiries");
    expect(pilot).toContain("processScheduledPilotExpiry");
    expect(pilot).toContain("scheduleActivePilotExpiries");
    expect(pilot).toContain("page.continueCursor");
    expect(admin).toContain("internal.zonePilot.processScheduledPilotExpiry");
    expect(admin).toContain("const shouldStartPilot = !zone.pilotStartedAt");
    expect(deletion).toContain('.withIndex("by_hostUid"');
    expect(matchrooms).toContain("internal.matchrooms.backfillMatchroomMembers");
    expect(matchrooms).toContain("requireRequestedMatchroomIdentity(ctx, args.uid)");
    expect(matchrooms).toContain("requireRequestedMatchroomIdentity(ctx, args.playerUid)");
    expect(matchrooms).toContain("projectMatchroomListForViewer(ctx, filtered)");
    expect(matchrooms).not.toContain("applyRatingsForFinalizedMatch failed");
    expect(matchrooms).toContain("releaseAllocatedResourcesForMatchroom");
    expect(matchrooms).toContain("reconcileResourceLegacyAssignment");
    const users = read("convex/users.ts");
    expect(users).toContain("export const applyMatchSkillUpdates = mutation");
    expect(users).toContain("internal.matchrooms.reconcileFinalizedRatings");
    expect(users).not.toContain("[update.game]: update.skillScore");
  });

  it("binds profile creation and legacy auth linking to the authenticated identity", () => {
    const users = read("convex/users.ts");
    const auth = read("convex/auth.ts");

    expect(users).toContain("await authComponent.getAuthUser(ctx)");
    expect(users).toContain("Authenticated account does not match profile creation request.");
    expect(users).toContain("phoneOtp.getRecentVerified");
    expect(users).toContain("phoneOtpVerified: Boolean(verifiedPhone)");
    expect(auth).toContain("Authenticated account does not match profile link request.");
    expect(auth).toContain("candidateAuthIds.includes(String(args.authId");
  });

  it("uses event-refreshed resource capacity and reconciles legacy allocation pointers", () => {
    const zones = read("convex/zones.ts");
    const capacity = read("convex/resourceCapacity.ts");
    const conflicts = read("convex/bookingConflicts.ts");
    const resources = read("convex/zoneAdminResources.ts");
    const broadcast = read("convex/matchroomBroadcast.ts");
    const migration = read("convex/scheduleIndexMigration.ts");
    const admin = read("convex/admin.ts");

    expect(zones).toContain('.query("zoneResourceCapacitySnapshots")');
    expect(capacity).toContain("refreshBranchResourceCapacitySnapshot");
    expect(conflicts).toContain("findActiveResourceAssignment");
    expect(conflicts).toContain("reconcileResourceLegacyAssignment");
    expect(resources).toContain("request.allocatedResourceIds || []");
    expect(resources).not.toContain('.withIndex("by_bookingRequestId", (q) => q.eq("bookingRequestId", args.requestId))');
    expect(resources).toContain("This resource status cannot be changed while it has an active booking or venue offer.");
    expect(resources).toContain("Branch inventory cannot be reduced while it has active bookings, walk-ins, or venue offers.");
    expect(broadcast).toContain("reconcileResourceLegacyAssignment(ctx");
    expect(conflicts).toContain("findActiveBranchAssignment");
    expect((conflicts.match(/requestHasTerminalOrMissingLinkedRoom\(ctx, request\)/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(zones).toContain("await findActiveBranchAssignment(ctx");
    expect(zones).toContain("This resource cannot be deleted while it has an active booking or venue offer.");
    expect(zones).toContain("This resource status cannot be changed while it has an active booking or venue offer.");
    expect(zones).toContain("refreshBranchResourceCapacitySnapshot(ctx");
    expect(migration).toContain("paginate({ cursor: args.cursor || null, numItems: PAGE_SIZE })");
    expect(migration).toContain("page.continueCursor");
    expect(zones).toContain("scheduleIndexMigration.prepareZoneScheduleIndex");
    expect((admin.match(/scheduleIndexMigration\.prepareZoneScheduleIndex/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  // Regression: account deletion inspected only the first 100 room memberships
  // and ignored provider payments and unlinked team challenges.
  it("blocks deletion for every active financial and match lifecycle", () => {
    const admin = read("convex/admin.ts");
    const deletion = read("convex/accountDeletion.ts");
    const authz = read("convex/authz.ts");
    const schema = read("convex/schema.ts");

    expect(deletion).toContain('.query("paymentTransactions")');
    expect(deletion).toContain("active booking requests and venue offers are resolved");
    expect(deletion).toContain('q.eq("userId", userId).eq("status", status)');
    expect(deletion).toContain('q.eq("userId", userId).eq("status", "accepted")');
    expect(deletion).toContain('q.eq("requestId", request._id).eq("status", "pending")');
    expect(deletion).toContain('["completed", "expired", "cancelled"]');
    expect(deletion).toContain('.withIndex("by_uid"');
    expect(deletion).not.toContain(".collect()");
    expect(deletion).toContain('.withIndex("by_captainAUid_and_status"');
    expect(deletion).toContain('.withIndex("by_captainBUid_and_status"');
    expect(deletion).toContain('.withIndex("by_userId", (q: any) => q.eq("odxerId", userId))');
    expect(deletion).toContain('.withIndex("by_captainUid", (q: any) => q.eq("captainUid", userId))');
    expect(deletion).toContain('.withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", userId))');
    expect(deletion).toContain('await ctx.db.patch(row._id, { username: "Deleted User" })');
    expect(deletion).toContain('captainAName: "Deleted User"');
    expect(deletion).toContain('captainBName: "Deleted User"');
    expect(deletion).toContain("anonymizedReplyTo");
    expect(deletion).toContain("redactDisplayNames(row.body, displayNames)");
    expect(admin).toContain("assertCanActOnSuperAdminTarget(admin, user)");
    expect(admin).toContain("enqueueAccountDeletion");
    expect(admin).toContain("processAccountDeletionJob");
    expect(deletion).toContain('deleteAuthBatch(ctx, job, "account"');
    expect(deletion).toContain('deleteAuthBatch(ctx, job, "verification"');
    expect(deletion).toContain('{ field: "value", operator: "eq", value: job.authId }');
    expect(deletion).toContain("paginationOpts: { cursor: null, numItems: AUTH_PAGE_SIZE }");
    expect(deletion).toContain("Account deletion made no progress");
    expect(deletion).toContain("paginate({ cursor, numItems: PAGE_SIZE })");
    expect(admin).toContain("isAccountSuspensionActive(profile)");
    expect(deletion).toContain("suspendedUntil: null");
    expect(deletion).toContain("await ctx.storage.delete(user.profileImageStorageId)");
    expect(deletion).toContain("phoneNumberHash: undefined");
    expect(deletion).toContain('.query("phoneVerifications")');
    expect(deletion).toContain('.query("pushDevices")');
    expect(deletion).toContain('.query("pushTickets")');
    expect(deletion).toContain('.query("userBlocks")');
    expect(deletion).toContain('.query("chatTypingStatus")');
    expect(deletion).toContain('.query("chatMessages")');
    expect(deletion).toContain('createdByUsername: "Deleted User"');
    expect(deletion).toContain('userName: "Deleted User"');
    expect(deletion).toContain("eaId: undefined");
    expect(authz).toContain("isAccountSuspensionActive(actor.user)");
    expect(schema).toContain("accountDeletionJobs: defineTable");
    expect(schema).toContain("ticketIds: v.optional(v.array(v.id(\"supportTickets\")))");
    expect(admin).toContain("mergeTicketIds");
    expect(deletion).toContain("for (const ticketId of ticketIds)");
    expect(schema).toContain('.index("by_captainAUid_and_status", ["captainAUid", "status"])');
    expect(schema).toContain('.index("by_captainBUid_and_status", ["captainBUid", "status"])');
    expect(schema).toContain('.index("by_userId_and_status", ["userId", "status"])');
    expect(admin).toContain('stage: "preflight_basics"');
    expect(admin).not.toContain('String(latestStopped.stage || "").startsWith("preflight_")');
    const broadcast = read("convex/matchroomBroadcast.ts");
    expect(broadcast).toContain("a broadcast cancellation refund arrived");
    expect(broadcast).toContain("interruptAccountDeletionForIncomingFunds");
  });

  it("keeps demo creation internal while reusing matchroom validation", () => {
    const seed = read("convex/demoSeed.ts");
    const matchrooms = read("convex/matchrooms.ts");
    const teamSeed = seed.slice(
      seed.indexOf("export const seedDemoTeamByIndex"),
      seed.indexOf("export const seedDemoMatchroomByIndex"),
    );

    expect(teamSeed).not.toContain("ctx.runMutation(api.teams.create");
    expect(teamSeed).not.toContain("ctx.runMutation(api.teams.addMember");
    expect(seed).toContain("(internal as any).matchrooms.createSeededDemo");
    expect(seed).not.toContain('await import("./_generated/api")).internal as any;\n    const matchroomId');
    expect(matchrooms).toContain("export const createSeededDemo = internalMutation");
    expect(matchrooms).toContain('args.bookingSource !== "seed" || args.paymentStatus !== "unpaid"');
    expect(matchrooms).toContain("createMatchroomFromValidatedArgs(ctx, args");
    expect(seed).toContain("capacity: buildZoneCapacity(branches)");
    expect(seed).toContain("seat <= Math.max(0, t.count)");
  });

  it("uses persisted booking times and unique resources for allocation checks", () => {
    const source = read("convex/zoneAdminBooking.ts");
    const accept = source.slice(
      source.indexOf("export const acceptBookingRequest"),
      source.indexOf("export const rejectBookingRequest"),
    );

    expect(accept).toContain("new Set(args.resourceIds.map(String)).size !== args.resourceIds.length");
    expect(accept).toContain("let allocationStartAt = getBookingRequestStartAtForConflict(bookingRequest)");
    expect(accept).toContain("allocationStartAt = getLinkedRoomStartMillis(linkedRoomForSlot) || allocationStartAt");
    expect(accept).toContain("durationMinutes: allocationDurationMinutes");
    expect(accept).not.toContain("args.matchroomData.scheduledStartAt");
  });

  it("keeps team venue negotiation in an accepted, server-priced state", () => {
    const backend = read("convex/teamChallenges.ts");
    const screen = read("app/teams/challenge.tsx");
    const createFull = backend.slice(
      backend.indexOf("export const createFull"),
      backend.indexOf("export const update"),
    );

    expect(backend).toContain('if (!["accepted", "venue_proposed"].includes(challenge.status) && !recoveringUnavailableVenue)');
    expect(backend).toContain('status: "venue_proposed"');
    expect(backend).toContain("captainVenueChoices: buildCaptainChoices(challenge");
    expect(createFull).not.toContain("args.alternativeVenueByCaptainB");
    expect(createFull).not.toContain("args.adminReviewStatus");
    expect(createFull).toContain("[String(args.captainAUid)]: canonicalCaptainAVenue");
    expect(screen).toContain("const canAcceptNow = !!(isPending && !isAdminPending && isCaptainB)");
    expect(backend).toContain('challenge.status !== "venue_confirmed"');
    expect(backend).toContain("captainAChoice.zoneId !== captainBChoice?.zoneId");
    expect(backend).toContain('if (!zone || zone.status !== "active") {');
    expect(backend).toContain('updateKind: "venue_unavailable"');
    expect(backend).toContain('captainVenueChoices: {}');
    expect(screen).toContain('challenge?.confirmedVenueIsActive === false');
    expect(backend).toContain("recoveringUnavailableVenue");
    expect(screen).toContain('challenge?.confirmedVenueIsActive === false');
    expect(backend).toContain("confirmedVenue: undefined");
    expect(backend).toContain("This challenge is already linked to a booking and cannot be cancelled here.");
    expect(backend).not.toContain("await ctx.db.delete(args.challengeId)");
  });

  it("reports provider-paid team holds that fall back to wallet credit", () => {
    const backend = read("convex/easypaisa.ts");
    const screen = read("app/teams/challenge.tsx");
    const outcomeCopy = backend.slice(
      backend.indexOf("function getPlayerPaymentOutcomeCopy"),
      backend.indexOf("function getPlayerPaymentRoute"),
    );

    expect(backend).toContain('teamChallengeHoldStatus = "wallet_credit_only"');
    expect(backend).toContain('status: "wallet_credit_only"');
    expect(backend).toContain("teamChallengeHoldStatus: latest.providerPayload?.teamChallengeHold?.status || null");
    expect(outcomeCopy.indexOf('if (decision === "wallet_credit_only")')).toBeLessThan(
      outcomeCopy.indexOf('if (kind === "wallet_topup")'),
    );
    expect(backend).toContain("teamChallengeHoldStatus = providerUpdate.teamChallengeHoldStatus");
    expect(backend).toContain('team_hold_fell_back_to_wallet');
    expect(backend).toContain("checkoutContext.zoneWalkInCreateArgs");
    expect(backend).toContain("holdResult?.reason");
    expect(screen).toContain('statusLike?.teamChallengeHoldStatus === "held"');
    expect(screen).toContain("The funds remain available in your MatchHai wallet.");
  });

  it("keeps verification bypasses development-only and redacts payout details", () => {
    const gate = read("convex/kycGate.ts");
    const users = read("convex/users.ts");
    const wallet = read("convex/wallet.ts");
    const withdrawals = read("convex/zoneWithdrawals.ts");

    expect(gate).toContain('process.env.MATCHHAI_ENV || ""');
    expect(gate).toContain("isExplicitDevelopment &&");
    expect(users).toContain("isPhoneOtpBypassEnabled()");
    expect(wallet).toContain("delete metadata.accountNumberFull");
    expect(wallet).toContain(".take(200)");
    expect(withdrawals).toContain("process.env.WITHDRAWAL_REQUEST_EMAIL");
    expect(withdrawals).not.toContain('const WITHDRAWAL_REQUEST_EMAIL = "admin@matchhai.com"');
  });

  it("schedules direct counter-offer expiry and rejects duplicate holds", () => {
    const source = read("convex/zoneAdminBooking.ts");
    const legacy = read("convex/bookings.ts");

    expect(source).toContain("export const expireDirectCounterOffer = internalMutation");
    expect(source).toContain("internal.zoneAdminBooking.expireDirectCounterOffer");
    expect(source).toContain('lifecycleStatus: "counter_offer_expired"');
    expect(source).toContain("new Set(resourceIds.map(String)).size !== resourceIds.length");
    expect(source).toContain("This booking request already has a pending counter-offer.");
    expect(source).toContain("extendBroadcastDeadlineThroughOffer");
    const broadcast = read("convex/matchroomBroadcast.ts");
    expect(broadcast).toContain('reason: "live_offer_extended_deadline"');
    expect(source).toContain("Resolve the pending venue offer before updating this booking request.");
    expect(source).toContain('if (offer.status !== "pending")');
    expect(source).toContain('request.lifecycleStatus === "counter_offer_pending_captains"');
    expect(source).toContain("acceptedOptionIndexes.size > 1");
    expect(legacy).toContain("This booking uses the current venue workflow and must be updated there.");
    expect(legacy).toContain("isStandaloneLegacyBookingRequest(request)");
    expect(legacy).toContain("isLegacyZoneOffer(offer)");
    expect(legacy).toContain('workflowVersion: createAsLegacy ? "legacy_v1" : "canonical_v2"');
    expect(legacy).toContain('paymentStatus: createAsLegacy ? "unpaid" : args.paymentStatus');
    const service = read("src/services/convex/bookingRequestService.ts");
    expect(service).toContain('workflowVersion: "canonical_v2"');
    expect(legacy).toContain("Only the requester can accept an offer for an active legacy request.");
    expect(legacy).toContain("Closed legacy offers cannot be changed or reopened.");
    expect(legacy).toContain("Accept a legacy venue offer before accepting the request.");
    expect(legacy).not.toContain("Legacy booking status updates are disabled");
    expect(legacy).not.toContain("Legacy zone offers are disabled");
    expect(legacy).toContain("Only an active venue owner can view open booking requests.");
    expect(legacy).toContain('.filter((request) => request.status === "open")');
  });

  it("preserves the legacy free-challenge link contract without exposing paid state", () => {
    const source = read("convex/teamChallenges.ts");
    const update = source.slice(
      source.indexOf("export const update = mutation"),
      source.indexOf("export const listForCaptain"),
    );

    expect(update).toContain("isLegacyFreeMatchroomLink");
    expect(source).toContain("assertNewGameEntityCreationAllowed(challenger.game)");
    expect(update).toContain('room.bookingSource !== "challenge"');
    expect(update).toContain('room.teamMode !== "team"');
    expect(update).toContain("Paid challenges are linked only by the canonical booking workflow.");
    expect(update).toContain("matchroomId: updates.matchroomId");
    expect(update).not.toContain("ctx.db.patch(args.challengeId, updates)");
  });

  it("routes legacy challenge completion through result consensus", () => {
    const source = read("convex/teamChallenges.ts");
    const complete = source.slice(
      source.indexOf("export const complete = mutation"),
      source.indexOf("export const cancel = mutation"),
    );

    expect(complete).toContain("api.matchrooms.submitCaptainReport");
    expect(complete).toContain("Winner must be one of the challenged teams.");
    expect(complete).not.toContain('status: "completed"');
    expect(complete).not.toContain("ctx.db.patch");
  });

  it("routes legacy chat deletion through the authenticated per-user helper", () => {
    const source = read("convex/chat.ts");
    const legacyDelete = source.slice(source.indexOf("export const deleteMessage"));

    expect(source).toContain("async function deleteMessageForCurrentParticipant");
    expect(source).toContain("requireAuthorizedChatroomParticipant(ctx, message.chatroomId)");
    expect(legacyDelete).toContain("deleteMessageForCurrentParticipant(ctx, args.messageId)");
    expect(legacyDelete).not.toContain("ctx.db.delete");
    expect(source).not.toContain("Full message deletion is disabled.");
  });

  it("keeps a broadcast room alive while another venue path remains open", () => {
    const source = read("convex/zoneAdminBooking.ts");
    const response = source.slice(
      source.indexOf("export const respondToCounterOffer"),
      source.indexOf("export const getOwnedZone"),
    );

    expect(response).toContain('finalizeBroadcastFailure(\n          ctx,\n          request.matchroomId,\n          "counter_offer_rejected"');
    expect(response).toContain("if (broadcastFailure.changed)");
    expect(response).toContain("cancelMatchroomAndReturnPayments");
  });

  it("keeps challenge scheduling feedback aligned with the backend minimum", () => {
    const screen = read("app/teams/challenge-create.tsx");
    const backend = read("convex/teamChallenges.ts");

    expect(screen).toContain("48 * 60 * 60 * 1000");
    expect(screen).toContain("Challenge match must be at least 2 days from now.");
    expect(backend).toContain("const TEAM_CHALLENGE_MIN_SCHEDULE_DAYS = 2");
  });
});
