import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Skill score validator (reusable)
const skillScoreValidator = v.object({
  rating: v.number(),
  tier: v.string(),
  matchesPlayed: v.number(),
  wins: v.number(),
  losses: v.number(),
  initialSource: v.optional(v.string()),
  initialRating: v.optional(v.number()),
  lastMatchDate: v.optional(v.union(v.number(), v.null())),
  lastUpdated: v.number(),
});

// PSN game stats validator
const psnGameStatsValidator = v.object({
  present: v.boolean(),
  progress: v.union(v.number(), v.null()),
  earnedTrophies: v.union(
    v.object({
      bronze: v.number(),
      silver: v.number(),
      gold: v.number(),
      platinum: v.number(),
    }),
    v.null()
  ),
  lastPlayedDateTime: v.union(v.string(), v.null()),
  playDuration: v.optional(v.union(v.string(), v.null())),
  formatPlayDuration: v.optional(v.union(v.string(), v.null())),
});

// PSN stats validator
const psnStatsValidator = v.object({
  psnOnlineId: v.string(),
  psnAccountId: v.string(),
  avatarUrl: v.optional(v.string()),
  profileUrl: v.optional(v.string()),
  trophyLevel: v.optional(v.string()),
  trophyTier: v.optional(v.string()),
  totalTrophies: v.optional(
    v.object({
      bronze: v.number(),
      silver: v.number(),
      gold: v.number(),
      platinum: v.number(),
    })
  ),
  tekken8: psnGameStatsValidator,
  fc: psnGameStatsValidator,
  psnLastSyncedAt: v.optional(v.string()),
});

// Steam stats validator
const steamStatsValidator = v.object({
  steamId: v.string(),
  personaName: v.string(),
  avatarUrl: v.optional(v.string()),
  countryCode: v.optional(v.union(v.string(), v.null())),
  cs2Hours: v.optional(v.union(v.number(), v.null())),
  stats: v.optional(
    v.object({
      totalKills: v.optional(v.number()),
      totalDeaths: v.optional(v.number()),
      totalWins: v.optional(v.number()),
      totalDamage: v.optional(v.number()),
      kdRatio: v.optional(v.union(v.number(), v.string())),
    })
  ),
});

// FACEIT stats validator
const faceitStatsValidator = v.object({
  faceitId: v.string(),
  nickname: v.string(),
  game: v.optional(v.string()),
  elo: v.optional(v.union(v.number(), v.null())),
  skillLevel: v.optional(v.union(v.number(), v.null())),
  country: v.optional(v.union(v.string(), v.null())),
  avatarUrl: v.optional(v.union(v.string(), v.null())),
});

// Slot validator for matchrooms (Firebase-compatible)
const slotValidator = v.object({
  slotId: v.string(),
  uid: v.optional(v.string()),
  user: v.optional(v.object({
    uid: v.string(),
    username: v.string(),
    photoURL: v.optional(v.string()),
    skillTier: v.optional(v.string()),
  })),
  status: v.union(v.literal("open"), v.literal("reserved"), v.literal("confirmed")),
  reservedFor: v.optional(v.object({
    uid: v.string(),
    username: v.string(),
    photoURL: v.optional(v.string()),
  })),
  reservedForUid: v.optional(v.string()),
  role: v.optional(v.string()),
});

// Player in matchroom
const playerValidator = v.object({
  uid: v.string(),
  username: v.string(),
  joinedAt: v.number(),
  role: v.optional(v.string()),
  skillTier: v.optional(v.string()),
  character: v.optional(v.string()),
  favouriteClub: v.optional(v.string()),
  formation: v.optional(v.string()),
});

// Chat message attachment (image or file)
const chatAttachmentValidator = v.object({
  storageId: v.id("_storage"),
  fileName: v.optional(v.string()),
  mimeType: v.optional(v.string()),
  sizeBytes: v.optional(v.number()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
});

// Chat message reaction entry
const chatReactionValidator = v.object({
  emoji: v.string(),
  userId: v.id("users"),
  createdAt: v.number(),
});

// Extended chat message type union (text/voice/image/file)
const chatMessageTypeValidator = v.union(
  v.literal("text"),
  v.literal("voice"),
  v.literal("image"),
  v.literal("file")
);

export default defineSchema({
  // ============================================
  // USERS TABLE
  // ============================================
  users: defineTable({
    // Auth linking
    authId: v.optional(v.string()), // Links to auth system

    // Core fields
    email: v.string(),
    fullName: v.string(),
    username: v.string(),
    usernameLower: v.string(),
    phone: v.optional(v.string()),
    phoneValidated: v.optional(v.boolean()),
    phoneValidationProvider: v.optional(v.string()),
    phoneValidationCheckedAt: v.optional(v.number()),
    phoneOtpVerified: v.optional(v.boolean()),
    phoneOtpVerifiedAt: v.optional(v.number()),
    phoneNumberMasked: v.optional(v.string()),
    phoneNumberHash: v.optional(v.string()),
    pendingEmail: v.optional(v.union(v.string(), v.null())),
    pendingPhone: v.optional(v.union(v.string(), v.null())),
    accountType: v.union(v.literal("player"), v.literal("zone")),

    // Profile
    photoURL: v.optional(v.string()),
    profileImageStorageId: v.optional(v.id("_storage")),
    profileImageUpdatedAt: v.optional(v.number()),
    bio: v.optional(v.string()),

    // Status
    isOnline: v.boolean(),
    isVerified: v.optional(v.boolean()),
    accountStatus: v.optional(v.union(
      v.literal("active"),
      v.literal("suspended")
    )),
    suspendedAt: v.optional(v.number()),
    suspendedUntil: v.optional(v.union(v.number(), v.null())),
    suspensionReason: v.optional(v.union(v.string(), v.null())),
    suspendedByAdminUserId: v.optional(v.id("users")),
    kycVerificationStatus: v.optional(v.union(
      v.literal("not_started"),
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("in_review"),
      v.literal("verified"),
      v.literal("rejected"),
      v.literal("expired")
    )),
    kycVerifiedAt: v.optional(v.number()),
    kycProvider: v.optional(v.literal("didit")),
    identityVerificationId: v.optional(v.string()),
    emailVerificationStatus: v.optional(v.string()),
    emailVerifiedAt: v.optional(v.number()),
    cnicMasked: v.optional(v.string()),

    // Location preferences (Step 2)
    areasPreferred: v.optional(v.array(v.string())),
    city: v.optional(v.string()),
    ageRange: v.optional(v.string()),

    // Game preferences (Step 2)
    playsCs2: v.optional(v.boolean()),
    cs2Role: v.optional(v.union(v.string(), v.null())),
    playsCs16: v.optional(v.boolean()),
    cs16Role: v.optional(v.union(v.string(), v.null())),
    playsValorant: v.optional(v.boolean()),
    valorantRole: v.optional(v.union(v.string(), v.null())),
    playsFc: v.optional(v.boolean()),
    fcTeam: v.optional(v.union(v.string(), v.null())),
    fcFormation: v.optional(v.union(v.string(), v.null())),
    selectedFcLeagueId: v.optional(v.union(v.string(), v.null())),
    playsTekken: v.optional(v.boolean()),
    tekkenFavorites: v.optional(v.array(v.string())),

    // Sports preferences (Step 2)
    playsFutsal: v.optional(v.boolean()),
    playsIndoorCricket: v.optional(v.boolean()),
    playsPadel: v.optional(v.boolean()),
    playsPickleball: v.optional(v.boolean()),
    futsalPosition: v.optional(v.union(v.string(), v.null())),
    futsalPositions: v.optional(v.array(v.string())),
    indoorCricketRole: v.optional(v.union(v.string(), v.null())),
    indoorCricketBowlingStyle: v.optional(v.union(v.string(), v.null())),
    indoorCricketBattingStyle: v.optional(v.union(v.string(), v.null())),
    padelRole: v.optional(v.union(v.string(), v.null())),
    pickleballRole: v.optional(v.union(v.string(), v.null())),

    // Platform URLs (Step 3)
    steamProfileUrl: v.optional(v.union(v.string(), v.null())),
    faceitProfileUrl: v.optional(v.union(v.string(),v.null())),
    eaProfileUrl: v.optional(v.string()),
    xboxGamertag: v.optional(v.string()),

    // External IDs
    steamId: v.optional(v.union(v.string(), v.null())),
    steamPersonaName: v.optional(v.union(v.string(), v.null())),
    steamCs2Hours: v.optional(v.union(v.number(), v.null())),
    eaId: v.optional(v.string()),
    faceitElo: v.optional(v.union(v.number(), v.null())),
    faceitSkillLevel: v.optional(v.union(v.number(), v.null())),
    faceitId: v.optional(v.union(v.string(), v.null())),
    faceitNickname: v.optional(v.union(v.string(), v.null())),
    faceitGame: v.optional(v.union(v.string(), v.null())),
    psnAccountId: v.optional(v.union(v.string(), v.null())),
    psnOnlineId: v.optional(v.union(v.string(), v.null())),

    // External stats (full objects)
    steamStats: v.optional(v.union(v.any(),v.null())),
    steamFc26Hours :v.optional(v.union(v.any(),v.null())),
    steamTekken8Hours :v.optional(v.union(v.any(),v.null())),
    faceitStats: v.optional(v.any()),
    psnStats: v.optional(v.any()),
    lastExternalSyncAt: v.optional(v.number()),
    steamLastSyncedAt: v.optional(v.number()),
    faceitLastSyncedAt: v.optional(v.number()),
    psnLastSyncedAt: v.optional(v.number()),

    // Skill scores (embedded)
    skillScores: v.optional(
      v.object({
        cs2: v.optional(skillScoreValidator),
        cs16: v.optional(skillScoreValidator),
        valorant: v.optional(skillScoreValidator),
        tekken: v.optional(skillScoreValidator),
        tekken8: v.optional(skillScoreValidator),
        futsal: v.optional(skillScoreValidator),
        cricket: v.optional(skillScoreValidator),
        indoor_cricket: v.optional(skillScoreValidator),
        fc25: v.optional(skillScoreValidator),
        fc26: v.optional(skillScoreValidator),
        padel: v.optional(skillScoreValidator),
        pickleball: v.optional(skillScoreValidator),
      })
    ),

    // Onboarding
    onboardingStep: v.optional(v.number()),
    onboardingCompleted: v.optional(v.boolean()),

    // Trust score
    trustScore: v.optional(v.number()),

    // Role for super admin
    role: v.optional(v.string()),

    // Team references
    teamsByGame: v.optional(v.any()),

    // Privacy settings
    hideAreasPublicly: v.optional(v.boolean()),
    hidePlatformsPublicly: v.optional(v.boolean()),
    restrictInvitesToFriends: v.optional(v.boolean()),

    // Wallet
    walletBalance: v.optional(v.number()),
    walletHeldBalance: v.optional(v.number()),

    // Chat presence & preferences
    lastActiveAt: v.optional(v.number()),
    chatMuted: v.optional(v.array(v.string())),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_usernameLower", ["usernameLower"])
    .index("by_phone", ["phone"])
    .index("by_steamId", ["steamId"])
    .index("by_faceitId", ["faceitId"])
    .index("by_psnAccountId", ["psnAccountId"])
    .index("by_eaId", ["eaId"])
    .index("by_xboxGamertag", ["xboxGamertag"])
    .index("by_accountType", ["accountType"])
    .index("by_authId", ["authId"])
    .index("by_role", ["role"])
    .index("by_updatedAt", ["updatedAt"])
    .index("by_accountStatus_updatedAt", ["accountStatus", "updatedAt"])
    .index("by_accountType_updatedAt", ["accountType", "updatedAt"]),

  // ============================================
  // IDENTITY VERIFICATIONS
  // ============================================
  identityVerifications: defineTable({
    userId: v.id("users"),
    type: v.literal("kyc"),
    role: v.union(
      v.literal("player"),
      v.literal("zone_owner"),
      v.literal("venue_admin"),
      v.literal("high_risk_dispute"),
      v.literal("tournament_organizer")
    ),
    provider: v.literal("didit"),
    providerSessionId: v.optional(v.string()),
    providerReference: v.optional(v.string()),
    vendorData: v.string(),
    workflowId: v.string(),
    startTokenHash: v.optional(v.string()),
    startTokenExpiresAt: v.optional(v.number()),
    status: v.union(
      v.literal("not_started"),
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("in_review"),
      v.literal("verified"),
      v.literal("rejected"),
      v.literal("expired")
    ),
    decision: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    emailVerificationStatus: v.optional(v.string()),
    idVerificationStatus: v.optional(v.string()),
    livenessStatus: v.optional(v.string()),
    faceMatchStatus: v.optional(v.string()),
    amlStatus: v.optional(v.string()),
    ipAnalysisStatus: v.optional(v.string()),
    cnicMasked: v.optional(v.string()),
    cnicHash: v.optional(v.string()),
    submittedAt: v.number(),
    verifiedAt: v.optional(v.number()),
    rejectedAt: v.optional(v.number()),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_providerSessionId", ["providerSessionId"])
    .index("by_vendorData", ["vendorData"])
    .index("by_status_and_submittedAt", ["status", "submittedAt"])
    .index("by_role_and_status", ["role", "status"])
    .index("by_type_and_role_and_status", ["type", "role", "status"]),

  // ============================================
  // FRIENDSHIPS
  // ============================================
  friendships: defineTable({
    userId: v.id("users"),
    friendId: v.id("users"),
    friendUsername: v.string(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_friendId", ["friendId"])
    .index("by_userId_and_friendId", ["userId", "friendId"]),

  // ============================================
  // USER BLOCKS
  // ============================================
  userBlocks: defineTable({
    userId: v.id("users"),
    blockedUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_blockedUserId", ["userId", "blockedUserId"]),

  // ============================================
  // WALLET TRANSACTIONS
  // ============================================
  walletTransactions: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("deposit"),
      v.literal("withdrawal"),
      v.literal("booking_payment"),
      v.literal("refund"),
      v.literal("hold"),
      v.literal("hold_release"),
      v.literal("hold_capture")
    ),
    amount: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
    reference: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_type", ["type"])
    .index("by_reference", ["reference"]),

  phoneVerifications: defineTable({
    userId: v.optional(v.id("users")),
    phoneHash: v.string(),
    phoneMasked: v.string(),
    otpHash: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("verified"),
      v.literal("expired"),
      v.literal("failed")
    ),
    attempts: v.number(),
    resendCount: v.number(),
    provider: v.literal("veevotech"),
    providerMessageId: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_phoneHash_and_createdAt", ["phoneHash", "createdAt"])
    .index("by_phoneHash_and_status_and_updatedAt", ["phoneHash", "status", "updatedAt"]),

  paymentTransactions: defineTable({
    provider: v.union(v.literal("easypaisa")),
    kind: v.union(v.literal("booking_intent"), v.literal("wallet_topup")),
    status: v.union(
      v.literal("created"),
      v.literal("redirected"),
      v.literal("token_received"),
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("expired"),
      v.literal("cancelled")
    ),
    userId: v.id("users"),
    bookingIntentId: v.optional(v.id("bookingIntents")),
    amount: v.number(),
    currency: v.string(),
    orderRefNum: v.string(),
    checkoutToken: v.string(),
    checkoutUrl: v.optional(v.string()),
    appReturnUrl: v.string(),
    providerStatus: v.optional(v.string()),
    providerDescription: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    authToken: v.optional(v.string()),
    providerReference: v.optional(v.string()),
    providerPayload: v.optional(v.any()),
    callbackCount: v.optional(v.number()),
    lastCallbackAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    processedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_orderRefNum", ["orderRefNum"])
    .index("by_checkoutToken", ["checkoutToken"])
    .index("by_bookingIntentId", ["bookingIntentId"])
    .index("by_status", ["status"]),

  // ============================================
  // MATCHROOMS
  // ============================================
  matchrooms: defineTable({
    // Core
    hostUid: v.string(), // Can be string or ID - Firebase uses string UID
    hostName: v.string(),
    game: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("in-progress"),
      v.literal("completed"),
      v.literal("locked"),
      v.literal("expired"),
      v.literal("cancelled")
    ),

    // Players
    maxPlayers: v.number(),
    currentPlayers: v.number(),
    players: v.array(playerValidator),
    playerUids: v.array(v.string()),

    // Location
    location: v.optional(v.string()),
    coordinates: v.optional(v.object({
      latitude: v.number(),
      longitude: v.number(),
    })),
    locationMode: v.optional(v.union(v.literal("zone"), v.literal("broadcast"))),
    broadcastAreas: v.optional(v.array(v.string())),
    broadcastRequestStatus: v.optional(
      v.union(
        v.literal("idle"),
        v.literal("waiting_for_fill"),
        v.literal("waiting_for_zones"),
        v.literal("zone_confirmed"),
        v.literal("expired"),
        v.literal("cancelled")
      )
    ),
    broadcastRequestStartedAt: v.optional(v.number()),
    broadcastRequestExpiresAt: v.optional(v.number()),
    confirmedZoneId: v.optional(v.string()),
    confirmedBranchId: v.optional(v.string()),
    venueConfirmedAt: v.optional(v.number()),
    refundStatus: v.optional(
      v.union(v.literal("none"), v.literal("pending"), v.literal("completed"))
    ),
    refundCompletedAt: v.optional(v.number()),
    zoneId: v.optional(v.string()),
    zoneOwnerUid: v.optional(v.string()),
    branchId: v.optional(v.string()),
    resourceIds: v.optional(v.array(v.id("zoneResources"))),

    // Timing & Pricing
    startTime: v.optional(v.number()),
    scheduledDate: v.optional(v.string()),
    scheduledTime: v.optional(v.string()),
    scheduledStartAt: v.optional(v.number()),
    lockAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    durationMinutes: v.optional(v.number()),
    pricing: v.object({
      perPlayer: v.number(),
      currency: v.string(),
    }),
    requestedResourceAssetType: v.optional(v.string()),
    requestedResourceSurface: v.optional(v.string()),
    requestedResourceTier: v.optional(v.string()),
    selectedZoneRateKey: v.optional(v.string()),
    matchCode: v.optional(v.string()),
    flexibility: v.optional(v.string()),
    bookingSource: v.optional(v.string()),
    skipBookingRequest: v.optional(v.boolean()),

    // Game-Specific Fields
    format: v.optional(v.string()),
    seriesType: v.optional(v.string()),
    durationHours: v.optional(v.number()),
    selectedMaps: v.optional(v.array(v.string())),
    skillLevel: v.optional(v.string()),
    hostSkillScore: v.optional(v.number()),
    hostSkillTier: v.optional(v.string()),
    hostRole: v.optional(v.string()),
    hostSkillContext: v.optional(v.any()),

    // Live Fairness Stats
    avgSkillScoreLive: v.optional(v.number()),
    totalSkillSum: v.optional(v.number()),
    ratedPlayerCount: v.optional(v.number()),

    // Game-specific options
    playstyle: v.optional(v.string()),
    rankRequirement: v.optional(v.string()),
    overs: v.optional(v.number()),
    sidePreference: v.optional(v.string()),
    composition: v.optional(v.string()),
    battingOrder: v.optional(v.string()),
    battingStyle: v.optional(v.string()),
    bowlingStyle: v.optional(v.string()),
    bowlingOrder: v.optional(v.string()),
    ruleset: v.optional(v.any()),

    // Slot-based System
    slotsA: v.array(slotValidator),
    slotsB: v.array(slotValidator),
    captainUidA: v.optional(v.string()),
    captainUidB: v.optional(v.string()),

    // Team fields
    teamMode: v.optional(v.union(v.literal("team"), v.literal("solo"))),
    teamId: v.optional(v.string()),
    teamName: v.optional(v.string()),
    reservedSlots: v.optional(v.number()),
    teamPaymentMode: v.optional(v.union(v.literal("captain_pays_all"), v.literal("captain_pays_self"))),
    assignedTeamMembers: v.optional(v.array(v.object({
      uid: v.string(),
      username: v.string(),
      role: v.string(),
    }))),

    // Lock/Privacy
    isPrivate: v.optional(v.boolean()),
    isLocked: v.optional(v.boolean()),
    lockedAt: v.optional(v.number()),
    zoneAdminApproved: v.optional(v.boolean()),

    // Payment
    paymentStatus: v.optional(v.union(v.literal("paid"), v.literal("unpaid"))),
    paymentAmount: v.optional(v.number()),
    paymentReservedSlots: v.optional(v.number()),
    paymentCurrency: v.optional(v.string()),
    merchantSettlementStatus: v.optional(v.union(v.literal("pending"), v.literal("captured"))),
    merchantSettlementAt: v.optional(v.number()),
    merchantSettlementAmount: v.optional(v.number()),
    merchantSettlementReference: v.optional(v.string()),
    venuePayoutStatus: v.optional(v.union(v.literal("pending"), v.literal("paid"))),
    venuePayoutAt: v.optional(v.number()),
    venuePayoutAmount: v.optional(v.number()),
    venuePayoutReference: v.optional(v.string()),

    // Result verification
    resultVerification: v.optional(v.object({
      status: v.union(
        v.literal("pending"),
        v.literal("participant_vote"),
        v.literal("admin_review"),
        v.literal("resolved")
      ),
      team1Captain: v.optional(v.string()),
      team2Captain: v.optional(v.string()),
      captainReports: v.optional(v.object({
        team1Captain: v.optional(v.object({
          result: v.union(v.literal("team1"), v.literal("team2")),
          timestamp: v.optional(v.number()),
        })),
        team2Captain: v.optional(v.object({
          result: v.union(v.literal("team1"), v.literal("team2")),
          timestamp: v.optional(v.number()),
        })),
      })),
      participantVotes: v.optional(v.any()),
      deadline: v.optional(v.number()),
      votes: v.optional(v.any()),
      finalWinner: v.optional(v.union(v.literal("team1"), v.literal("team2"))),
      resolvedAt: v.optional(v.number()),
      resolutionSource: v.optional(v.string()),
    })),

    // Cancellation
    cancelledBy: v.optional(v.string()),
    cancelledAt: v.optional(v.number()),
    cancelReason: v.optional(v.string()),
    cancelNote: v.optional(v.string()),

    // Walk-in data
    walkIn: v.optional(v.any()),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_hostUid", ["hostUid"])
    .index("by_status", ["status"])
    .index("by_game", ["game"])
    .index("by_status_and_game", ["status", "game"])
    .index("by_zoneId", ["zoneId"])
    .index("by_matchCode", ["matchCode"])
    .index("by_createdAt", ["createdAt"]),

  // ============================================
  // BOOKING INTENTS
  // ============================================
  bookingIntents: defineTable({
    matchroomId: v.id("matchrooms"),
    createdByUid: v.id("users"),
    createdByUsername: v.optional(v.string()),
    side: v.union(v.literal("A"), v.literal("B")),
    selectedSlots: v.array(v.number()),
    selectedSlotIds: v.optional(v.array(v.string())),
    role: v.optional(v.string()),
    source: v.optional(
      v.union(
        v.literal("direct_join"),
        v.literal("captain_approved_join"),
        v.literal("captain_invite")
      )
    ),
    sourceNotificationId: v.optional(v.id("notifications")),
    status: v.union(
      v.literal("pending_approvals"),
      v.literal("approved"),
      v.literal("approved_pending_payment"),
      v.literal("confirmed"),
      v.literal("rejected"),
      v.literal("expired"),
      v.literal("cancelled")
    ),

    // Approvals
    captainApproval: v.optional(
      v.object({
        approved: v.boolean(),
        approvedAt: v.optional(v.number()),
      })
    ),
    zoneApproval: v.optional(
      v.object({
        approved: v.boolean(),
        approvedAt: v.optional(v.number()),
      })
    ),

    // Pricing
    pricing: v.optional(
      v.object({
        totalCost: v.number(),
        perPlayerCost: v.number(),
        currency: v.optional(v.string()),
      })
    ),

    // Game reference
    game: v.optional(v.string()),

    // Payment
    paymentStatus: v.union(v.literal("unpaid"), v.literal("paid")),
    heldStatus: v.optional(
      v.union(
        v.literal("none"),
        v.literal("held"),
        v.literal("captured"),
        v.literal("released"),
        v.literal("refunded")
      )
    ),
    heldReference: v.optional(v.string()),
    heldAmount: v.optional(v.number()),
    heldCreatedAt: v.optional(v.number()),
    heldCapturedAt: v.optional(v.number()),
    heldReleasedAt: v.optional(v.number()),
    captureScheduledAt: v.optional(v.number()),
    captureScheduledFnId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_matchroomId", ["matchroomId"])
    .index("by_createdByUid", ["createdByUid"])
    .index("by_createdByUid_matchroomId", ["createdByUid", "matchroomId"])
    .index("by_status", ["status"])
    .index("by_sourceNotificationId", ["sourceNotificationId"]),

  // ============================================
  // BOOKING REQUESTS
  // ============================================
  bookingRequests: defineTable({
    userId: v.id("users"),
    gameKey: v.string(),
    zoneId: v.optional(v.id("zones")),
    userName: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    maxPlayers: v.optional(v.number()),
    format: v.optional(v.string()),
    seriesType: v.optional(v.string()),
    durationHours: v.optional(v.number()),
    selectedMaps: v.optional(v.array(v.string())),
    skillLevel: v.optional(v.string()),
    hostSkillScore: v.optional(v.number()),
    hostSkillTier: v.optional(v.string()),
    hostSkillContext: v.optional(v.any()),
    overs: v.optional(v.string()),
    teamMode: v.optional(v.union(v.literal("solo"), v.literal("team"))),
    teamId: v.optional(v.string()),
    reservedSlots: v.optional(v.number()),
    requestKind: v.optional(
      v.union(v.literal("direct_zone"), v.literal("broadcast_fanout"))
    ),
    fanoutGroupKey: v.optional(v.string()),
    responseExpiresAt: v.optional(v.number()),
    targetAreaLabel: v.optional(v.string()),
    closedReason: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("pending_payment"),
      v.literal("accepted"),
      v.literal("expired"),
      v.literal("cancelled")
    ),

    preferredDate: v.optional(v.number()),
    preferredTime: v.optional(v.string()),
    flexibilityWindow: v.optional(v.string()),
    locationMode: v.optional(v.union(v.literal("zone"), v.literal("broadcast"))),
    preferredAreas: v.optional(v.array(v.string())),
    budgetPerPlayer: v.optional(v.number()),
    currency: v.optional(v.string()),
    playerCount: v.number(),
    paymentStatus: v.optional(v.union(v.literal("paid"), v.literal("unpaid"))),
    paymentAmount: v.optional(v.number()),
    paymentReservedSlots: v.optional(v.number()),
    requestedResourceAssetType: v.optional(v.string()),
    requestedResourceSurface: v.optional(v.string()),
    requestedResourceTier: v.optional(v.string()),
    selectedZoneRateKey: v.optional(v.string()),
    matchroomId: v.optional(v.id("matchrooms")),
    allocatedBranchId: v.optional(v.string()),
    allocatedResourceIds: v.optional(v.array(v.id("zoneResources"))),
    allocatedAt: v.optional(v.number()),
    allocatedByUid: v.optional(v.string()),
    lifecycleStatus: v.optional(v.string()),
    notes: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_zoneId", ["zoneId"])
    .index("by_matchroomId", ["matchroomId"])
    .index("by_status", ["status"])
    .index("by_gameKey", ["gameKey"]),

  // ============================================
  // ZONE OFFERS
  // ============================================
  zoneOffers: defineTable({
    requestId: v.id("bookingRequests"),
    zoneId: v.id("zones"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired")
    ),
    requestKind: v.optional(
      v.union(v.literal("direct_zone"), v.literal("broadcast_fanout"))
    ),

    proposedPrice: v.number(),
    proposedDate: v.optional(v.number()),
    proposedTime: v.optional(v.string()),
    scheduleOptions: v.optional(v.array(v.object({
      date: v.string(),
      time: v.string(),
      endTime: v.optional(v.string()),
    }))),
    recipientUids: v.optional(v.array(v.string())),
    responses: v.optional(v.array(v.object({
      uid: v.string(),
      decision: v.union(v.literal("accepted"), v.literal("rejected")),
      respondedAt: v.number(),
      selectedOptionIndex: v.optional(v.number()),
    }))),
    selectedOptionIndex: v.optional(v.number()),
    resolvedMatchroomId: v.optional(v.id("matchrooms")),
    expiresAt: v.optional(v.number()),
    zoneName: v.optional(v.string()),
    zoneOwnerUid: v.optional(v.string()),
    branchId: v.optional(v.string()),
    branchName: v.optional(v.string()),
    requestOwnerUid: v.optional(v.string()),
    message: v.optional(v.string()),
    responseExpiresAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_requestId", ["requestId"])
    .index("by_zoneId", ["zoneId"])
    .index("by_status", ["status"]),

  // ============================================
  // TEAMS
  // ============================================
  teams: defineTable({
    name: v.string(),
    nameLower: v.string(),
    tag: v.optional(v.string()),
    game: v.string(),
    captainUid: v.id("users"),
    captainUsername: v.optional(v.string()),

    // Members
    memberUids: v.array(v.string()),
    memberCount: v.number(),
    maxMembers: v.number(),
    mainRosterSize: v.optional(v.number()),
    maxSubstitutes: v.optional(v.number()),

    // Logo/branding
    logoStorageId: v.optional(v.id("_storage")),
    logoUrl: v.optional(v.string()),

    // Stats
    stats: v.optional(
      v.object({
        wins: v.number(),
        losses: v.number(),
        matchesPlayed: v.number(),
      })
    ),

    // Description
    description: v.optional(v.string()),

    status: v.optional(v.union(v.literal("active"), v.literal("deleted"))),
    deletedAt: v.optional(v.number()),
    deletedByUid: v.optional(v.id("users")),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_captainUid", ["captainUid"])
    .index("by_game", ["game"])
    .index("by_nameLower", ["nameLower"]),

  // ============================================
  // TEAM MEMBERS
  // ============================================
  teamMembers: defineTable({
    teamId: v.id("teams"),
    odxerId: v.id("users"),
    username: v.string(),
    role: v.union(v.literal("captain"), v.literal("member")),
    rosterRole: v.optional(v.union(v.literal("main"), v.literal("substitute"))),
    rosterOrder: v.optional(v.number()),
    joinedAt: v.number(),
  })
    .index("by_teamId", ["teamId"])
    .index("by_userId", ["odxerId"])
    .index("by_teamId_and_userId", ["teamId", "odxerId"]),

  // ============================================
  // TEAM CHALLENGES
  // ============================================
  teamChallenges: defineTable({
    challengerTeamId: v.id("teams"),
    challengerTeamName: v.optional(v.string()),
    opponentTeamId: v.id("teams"),
    opponentTeamName: v.optional(v.string()),
    game: v.string(),
    gameKey: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("venue_proposed"),
      v.literal("venue_confirmed"),
      v.literal("admin_pending"),
      v.literal("completed"),
      v.literal("rejected"),
      v.literal("expired")
    ),
    captainAUid: v.optional(v.id("users")),
    captainAName: v.optional(v.string()),
    captainBUid: v.optional(v.id("users")),
    captainBName: v.optional(v.string()),
    format: v.optional(v.string()),
    seriesType: v.optional(v.string()),
    maxPlayers: v.optional(v.number()),
    scheduledDate: v.optional(v.string()),
    scheduledTime: v.optional(v.string()),
    pricePerPlayer: v.optional(v.number()),
    zoneRateKey: v.optional(v.string()),
    zoneRateLabel: v.optional(v.string()),
    zoneRatePrice: v.optional(v.number()),
    teamAPaymentStatus: v.optional(v.union(v.literal("unpaid"), v.literal("pending"), v.literal("paid"))),
    teamBPaymentStatus: v.optional(v.union(v.literal("unpaid"), v.literal("pending"), v.literal("paid"))),
    teamAPaymentAmount: v.optional(v.number()),
    teamBPaymentAmount: v.optional(v.number()),
    commonAreas: v.optional(v.array(v.string())),
    proposedVenueByCaptainA: v.optional(
      v.object({
        zoneId: v.string(),
        venueName: v.string(),
        areaLabel: v.optional(v.union(v.string(), v.null())),
      })
    ),
    alternativeVenueByCaptainB: v.optional(
      v.object({
        zoneId: v.string(),
        venueName: v.string(),
        areaLabel: v.optional(v.union(v.string(), v.null())),
      })
    ),
    captainVenueChoices: v.optional(v.any()),
    confirmedVenue: v.optional(
      v.object({
        zoneId: v.string(),
        venueName: v.string(),
        areaLabel: v.optional(v.union(v.string(), v.null())),
      })
    ),
    chatId: v.optional(v.string()),
    matchroomId: v.optional(v.id("matchrooms")),
    bookingRequestId: v.optional(v.string()),
    adminReviewStatus: v.optional(
      v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"), v.null())
    ),
    lineupA: v.optional(v.array(v.string())),
    lineupB: v.optional(v.array(v.string())),

    // Venue
    zoneId: v.optional(v.id("zones")),
    zoneName: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),

    // Result
    result: v.optional(
      v.object({
        winnerId: v.id("teams"),
        score: v.optional(v.string()),
      })
    ),

    message: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_challengerTeamId", ["challengerTeamId"])
    .index("by_opponentTeamId", ["opponentTeamId"])
    .index("by_status", ["status"]),

  // ============================================
  // TEAM CHALLENGE CHAT MESSAGES
  // ============================================
  teamChallengeChatMessages: defineTable({
    chatId: v.string(), // The challenge chat ID (matches teamChallenge ID or custom chat ID)
    // Kept as string for backwards compatibility with existing challenge chat messages.
    // Target shape: v.id("users") after a dedicated migration.
    senderUid: v.string(),
    senderName: v.string(),
    text: v.string(),
    type: v.optional(chatMessageTypeValidator),
    audioStorageId: v.optional(v.id("_storage")),
    audioDurationMs: v.optional(v.number()),
    attachment: v.optional(chatAttachmentValidator),
    reactions: v.optional(v.array(chatReactionValidator)),
    editedAt: v.optional(v.number()),
    clientMessageId: v.optional(v.string()),
    replyTo: v.optional(v.object({
      messageId: v.string(),
      senderName: v.string(),
      text: v.string(),
    })),
    deletedFor: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_chatId", ["chatId"])
    .index("by_chatId_and_createdAt", ["chatId", "createdAt"]),

  // ============================================
  // TEAM CHALLENGE CHATS (metadata)
  // ============================================
  teamChallengeChats: defineTable({
    chatId: v.string(), // External chat ID
    challengeId: v.optional(v.id("teamChallenges")),
    participantUids: v.optional(v.array(v.id("users"))),
    lastMessage: v.optional(v.object({
      text: v.string(),
      senderUid: v.id("users"),
      senderName: v.optional(v.string()),
      type: v.optional(chatMessageTypeValidator),
      audioDurationMs: v.optional(v.number()),
      createdAt: v.optional(v.number()),
    })),
    lastReadBy: v.optional(v.any()),
    pinnedMessageIds: v.optional(v.array(v.string())),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_chatId", ["chatId"]),

  teamChallengeChatMembers: defineTable({
    chatId: v.string(),
    userId: v.id("users"),
    joinedAt: v.number(),
    lastReadAt: v.optional(v.number()),
    unreadCount: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_chatId", ["chatId"])
    .index("by_userId", ["userId"])
    .index("by_chatId_and_userId", ["chatId", "userId"]),

  // ============================================
  // ZONES
  // ============================================
  zones: defineTable({
    ownerUid: v.id("users"),
    ownerUsername: v.optional(v.string()),
    ownerFullName: v.optional(v.string()),

    // Core fields (Firebase compatible)
    name: v.string(), // Legacy - use venueBrandName
    venueBrandName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),

    // Business type
    type: v.optional(v.union(
      v.literal("gaming"),
      v.literal("sports"),
      v.literal("hybrid")
    )),

    status: v.union(
      v.literal("pending-review"),
      v.literal("approved_pending_migration"),
      v.literal("active"),
      v.literal("rejected"),
      v.literal("suspended")
    ),
    onboardingStep: v.optional(v.number()),

    // Details
    description: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),

    // Primary Branch (for display)
    primaryBranch: v.optional(v.object({
      branchDisplayName: v.optional(v.string()),
      city: v.optional(v.string()),
      areaLabel: v.optional(v.string()),
      addressLine1: v.optional(v.string()),
      googleMapsUrl: v.optional(v.string()),
    })),

    // Games supported (object format for Firebase compat)
    games: v.union(
      v.array(v.string()),
      v.object({
        supportsCs2: v.optional(v.boolean()),
        supportsCs16: v.optional(v.boolean()),
        supportsValorant: v.optional(v.boolean()),
        supportsFc25: v.optional(v.boolean()),
        supportsFc26: v.optional(v.boolean()),
        supportsTekken8: v.optional(v.boolean()),
        supportsFutsal: v.optional(v.boolean()),
        supportsIndoorCricket: v.optional(v.boolean()),
        supportsPadel: v.optional(v.boolean()),
        supportsPickleball: v.optional(v.boolean()),
      })
    ),

    // Branches (detailed)
    branches: v.array(v.any()),

    // Capacity (aggregated)
    capacity: v.optional(v.object({
      pcSeats: v.optional(v.number()),
      consoleSeats: v.optional(v.number()),
      consolePlatform: v.optional(v.string()),
      futsalCourts: v.optional(v.number()),
      indoorCricketNets: v.optional(v.number()),
      padelCourts: v.optional(v.number()),
      pickleballCourts: v.optional(v.number()),
    })),

    // Pricing (complex nested - use v.any() for flexibility)
    pricing: v.optional(v.any()),

    // Pricing defaults (legacy)
    defaultPricing: v.optional(
      v.object({
        hourlyRate: v.number(),
        currency: v.string(),
      })
    ),

    // Legacy fields
    hourlyRate: v.optional(v.number()),
    ps5HourlyRate: v.optional(v.number()),

    // Approval tracking
    approvedAt: v.optional(v.number()),
    rejectedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    migration: v.optional(v.object({
      perBranchSeatModel: v.optional(v.boolean()),
      status: v.optional(v.union(
        v.literal("not_started"),
        v.literal("pending"),
        v.literal("succeeded"),
        v.literal("failed")
      )),
      resourceModelVersion: v.optional(v.number()),
      migratedAt: v.optional(v.number()),
      lastAttemptAt: v.optional(v.number()),
      lastError: v.optional(v.string()),
      retryCount: v.optional(v.number()),
      branchCount: v.optional(v.number()),
      resourceCount: v.optional(v.number()),
    })),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerUid", ["ownerUid"])
    .index("by_status", ["status"])
    .index("by_updatedAt", ["updatedAt"])
    .index("by_status_updatedAt", ["status", "updatedAt"]),

  // ============================================
  // ZONE PRICING RULES
  // ============================================
  pricingRules: defineTable({
    zoneId: v.id("zones"),
    branchId: v.optional(v.string()),
    assetType: v.string(),
    isEnabled: v.boolean(),
    priority: v.number(),
    tier: v.optional(v.string()),
    surface: v.optional(v.string()),
    ruleType: v.optional(v.union(v.literal("percentage_discount"), v.literal("fixed_override"))),
    value: v.optional(v.number()),

    // Time-based rules
    timeStart: v.optional(v.string()),
    timeEnd: v.optional(v.string()),
    daysOfWeek: v.optional(v.array(v.number())),
    validFrom: v.optional(v.string()),
    validTo: v.optional(v.string()),

    // Price modifications
    priceMultiplier: v.optional(v.number()),
    flatRate: v.optional(v.number()),

    name: v.optional(v.string()),
    description: v.optional(v.string()),
    createdByUid: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_zoneId", ["zoneId"])
    .index("by_zoneId_and_assetType", ["zoneId", "assetType"]),

  // ============================================
  // ZONE AUDIT EVENTS
  // ============================================
  zoneAuditEvents: defineTable({
    zoneId: v.string(),
    module: v.string(),
    action: v.string(),
    actorUid: v.optional(v.string()),
    actorLabel: v.optional(v.string()),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    summary: v.string(),
    details: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_zoneId_createdAt", ["zoneId", "createdAt"])
    .index("by_zoneId_module_createdAt", ["zoneId", "module", "createdAt"])
    .index("by_zoneId_action_createdAt", ["zoneId", "action", "createdAt"]),

  // ============================================
  // ZONE RESOURCES
  // ============================================
  zoneResources: defineTable({
    zoneId: v.id("zones"),
    branchId: v.string(),
    kind: v.string(),
    name: v.string(),
    assetType: v.string(),
    tier: v.optional(v.string()),
    surface: v.optional(v.string()),
    roomLabel: v.optional(v.string()),
    lifecycleStatus: v.union(
      v.literal("available"),
      v.literal("held"),
      v.literal("booked"),
      v.literal("maintenance")
    ),
    bookingRequestId: v.optional(v.id("bookingRequests")),
    matchroomId: v.optional(v.id("matchrooms")),
    bookedAt: v.optional(v.number()),
    bookedByUid: v.optional(v.string()),
    isActive: v.optional(v.boolean()),

    // Capacity
    capacity: v.optional(v.number()),

    // Pricing override
    hourlyRate: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_zoneId", ["zoneId"])
    .index("by_zoneId_and_branchId", ["zoneId", "branchId"])
    .index("by_lifecycleStatus", ["lifecycleStatus"])
    .index("by_bookingRequestId", ["bookingRequestId"]),

  // ============================================
  // NOTIFICATIONS
  // ============================================
  notifications: defineTable({
    toUid: v.id("users"),
    fromUid: v.optional(v.id("users")),
    fromUsername: v.optional(v.string()),

    type: v.string(),

    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("declined"),
      v.literal("read"),
      v.literal("expired")
    ),
    isRead: v.optional(v.boolean()),
    isArchived: v.optional(v.boolean()),
    archivedAt: v.optional(v.number()),
    readAt: v.optional(v.number()),
    recipientRole: v.optional(
      v.union(
        v.literal("player"),
        v.literal("zone_admin"),
        v.literal("super_admin")
      )
    ),
    route: v.optional(v.string()),
    dedupeKey: v.optional(v.string()),
    pushPolicy: v.optional(
      v.union(v.literal("none"), v.literal("eligible"), v.literal("force"))
    ),
    pushState: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("sent"),
        v.literal("failed"),
        v.literal("skipped")
      )
    ),
    pushAttemptedAt: v.optional(v.number()),
    pushDeliveredAt: v.optional(v.number()),
    pushError: v.optional(v.string()),

    // Entity references
    entityKey: v.optional(v.string()),
    entityId: v.optional(v.string()),

    // For team-related notifications
    teamId: v.optional(v.id("teams")),
    teamName: v.optional(v.string()),

    // For matchroom invites
    matchroomId: v.optional(v.id("matchrooms")),

    // Content
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    data: v.optional(v.any()),

    // Expiry
    expiresAt: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_toUid", ["toUid"])
    .index("by_toUid_and_status", ["toUid", "status"])
    .index("by_toUid_and_type", ["toUid", "type"])
    .index("by_toUid_isRead_createdAt", ["toUid", "isRead", "createdAt"])
    .index("by_toUid_status_createdAt", ["toUid", "status", "createdAt"])
    .index("by_fromUid", ["fromUid"])
    .index("by_fromUid_type_status", ["fromUid", "type", "status"])
    .index("by_matchroomId", ["matchroomId"])
    .index("by_matchroomId_type_status", ["matchroomId", "type", "status"])
    .index("by_entityKey", ["entityKey"])
    .index("by_dedupeKey", ["dedupeKey"]),

  pushDevices: defineTable({
    userId: v.id("users"),
    installationId: v.string(),
    provider: v.union(v.literal("expo")),
    platform: v.union(
      v.literal("ios"),
      v.literal("android"),
      v.literal("web"),
      v.literal("unknown")
    ),
    expoPushToken: v.optional(v.string()),
    projectId: v.optional(v.string()),
    deviceName: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    permissionStatus: v.union(
      v.literal("granted"),
      v.literal("denied"),
      v.literal("undetermined")
    ),
    isActive: v.boolean(),
    lastRegisteredAt: v.number(),
    lastDeliveredAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_installationId", ["installationId"])
    .index("by_expoPushToken", ["expoPushToken"]),

  // ============================================
  // CHATROOMS (for matchrooms + friend DMs)
  // ============================================
  chatrooms: defineTable({
    // "matchroom" (default/legacy) or "dm" for friend direct messages
    type: v.optional(v.union(v.literal("matchroom"), v.literal("dm"))),
    // Matchroom-specific (optional for DMs)
    matchroomId: v.optional(v.id("matchrooms")),
    // DM-specific: sorted pair of user IDs for dedup lookup (e.g. "id1_id2")
    dmPairKey: v.optional(v.string()),
    // Stored as strings for compatibility with existing matchroom/chatroom records.
    // Target shape: v.array(v.id("users")) after a dedicated migration.
    participantUids: v.array(v.string()),
    lastMessage: v.optional(v.object({
      text: v.string(),
      senderUid: v.string(),
      senderName: v.string(),
      type: v.optional(chatMessageTypeValidator),
      audioDurationMs: v.optional(v.number()),
      createdAt: v.number(),
    })),
    lastReadBy: v.optional(v.any()), // Record<userId, timestamp>
    pinnedMessageIds: v.optional(v.array(v.string())),
    zoneId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_matchroomId", ["matchroomId"])
    .index("by_dmPairKey", ["dmPairKey"]),

  chatroomMembers: defineTable({
    chatroomId: v.id("chatrooms"),
    // Stored as strings to stay aligned with chatrooms.participantUids until a full migration is planned.
    // Target shape: v.id("users") after chatrooms.participantUids migrates.
    userId: v.string(),
    joinedAt: v.number(),
    lastReadAt: v.optional(v.number()),
    unreadCount: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_chatroomId", ["chatroomId"])
    .index("by_userId", ["userId"])
    .index("by_chatroomId_and_userId", ["chatroomId", "userId"]),

  // ============================================
  // CHAT MESSAGES
  // ============================================
  chatMessages: defineTable({
    chatroomId: v.id("chatrooms"),
    senderUid: v.id("users"),
    senderUsername: v.string(),
    content: v.string(),
    type: v.optional(chatMessageTypeValidator),
    audioStorageId: v.optional(v.id("_storage")),
    audioDurationMs: v.optional(v.number()),
    attachment: v.optional(chatAttachmentValidator),
    reactions: v.optional(v.array(chatReactionValidator)),
    editedAt: v.optional(v.number()),
    clientMessageId: v.optional(v.string()),
    replyTo: v.optional(v.object({
      messageId: v.string(),
      senderName: v.string(),
      text: v.string(),
    })),
    deletedFor: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_chatroomId", ["chatroomId"])
    .index("by_chatroomId_and_createdAt", ["chatroomId", "createdAt"]),

  // ============================================
  // CHAT TYPING STATUS
  // ============================================
  chatTypingStatus: defineTable({
    chatKey: v.string(), // chatroomId (matchroom chat) or teamChallengeChat chatId
    userId: v.id("users"),
    userName: v.string(),
    updatedAt: v.number(),
  })
    .index("by_chatKey", ["chatKey"])
    .index("by_chatKey_and_userId", ["chatKey", "userId"]),

  // ============================================
  // REPORTS
  // ============================================
  reports: defineTable({
    reporterUid: v.id("users"),
    type: v.union(
      v.literal("matchroom_complaint"),
      v.literal("user_report"),
      v.literal("zone_complaint")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("reviewed"),
      v.literal("resolved")
    ),

    // References
    matchroomId: v.optional(v.id("matchrooms")),
    reportedUserId: v.optional(v.id("users")),
    zoneId: v.optional(v.id("zones")),
    branchId: v.optional(v.string()),
    branchLabel: v.optional(v.string()),

    // Details
    game: v.optional(v.string()),
    reason: v.string(),
    dedupeKey: v.optional(v.string()),
    description: v.optional(v.string()),
    reviewedByUid: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    reviewerNote: v.optional(v.string()),
    resolvedByUid: v.optional(v.id("users")),
    resolvedAt: v.optional(v.number()),
    resolutionSummary: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_reporterUid", ["reporterUid"])
    .index("by_status", ["status"])
    .index("by_type", ["type"])
    .index("by_dedupeKey", ["dedupeKey"])
    .index("by_matchroomId", ["matchroomId"])
    .index("by_zoneId", ["zoneId"])
    .index("by_zoneId_branchId", ["zoneId", "branchId"])
    .index("by_reportedUserId", ["reportedUserId"])
    .index("by_updatedAt", ["updatedAt"])
    .index("by_status_updatedAt", ["status", "updatedAt"]),

  // ============================================
  // SUPPORT TICKETS
  // ============================================
  supportTickets: defineTable({
    reference: v.string(),
    userId: v.id("users"),
    userRole: v.optional(v.string()),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    intent: v.optional(v.string()),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent")
      )
    ),
    issueSummary: v.string(),
    conversationExcerpt: v.array(
      v.object({
        role: v.union(v.literal("user"), v.literal("assistant")),
        text: v.string(),
      })
    ),
    suggestedAdminAction: v.optional(v.string()),
    relatedMatchroomId: v.optional(v.id("matchrooms")),
    relatedPaymentId: v.optional(v.id("paymentTransactions")),
    relatedBookingId: v.optional(v.id("bookingIntents")),
    relatedZoneId: v.optional(v.id("zones")),
    conversationId: v.optional(v.id("supportConversations")),
    metadata: v.optional(v.any()),
    status: v.union(
      v.literal("open"),
      v.literal("in_review"),
      v.literal("resolved"),
      v.literal("closed")
    ),
    source: v.union(v.literal("help_support_chat"), v.literal("help_support_ai_agent")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_reference", ["reference"])
    .index("by_userId", ["userId"])
    .index("by_conversationId", ["conversationId"])
    .index("by_conversationId_createdAt", ["conversationId", "createdAt"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  supportConversations: defineTable({
    userId: v.id("users"),
    module: v.union(
      v.literal("player"),
      v.literal("zone_admin"),
      v.literal("super_admin")
    ),
    status: v.union(v.literal("open"), v.literal("closed")),
    activeTicketId: v.optional(v.id("supportTickets")),
    summary: v.optional(v.string()),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent")
      )
    ),
    lastIntent: v.optional(v.string()),
    lastMessageAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId_updatedAt", ["userId", "updatedAt"])
    .index("by_userId_status_updatedAt", ["userId", "status", "updatedAt"])
    .index("by_status_updatedAt", ["status", "updatedAt"]),

  supportMessages: defineTable({
    conversationId: v.id("supportConversations"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    textRedacted: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_conversationId_createdAt", ["conversationId", "createdAt"]),

  supportTicketNotes: defineTable({
    ticketId: v.id("supportTickets"),
    author: v.union(v.literal("agent"), v.literal("admin"), v.literal("system")),
    textRedacted: v.string(),
    createdAt: v.number(),
  })
    .index("by_ticketId_createdAt", ["ticketId", "createdAt"]),

  supportAgentAuditLogs: defineTable({
    requestId: v.string(),
    userId: v.optional(v.id("users")),
    conversationId: v.optional(v.id("supportConversations")),
    actionType: v.string(),
    actionStatus: v.union(
      v.literal("executed"),
      v.literal("denied"),
      v.literal("failed"),
      v.literal("rate_limited")
    ),
    reasonCategory: v.optional(v.string()),
    ticketId: v.optional(v.id("supportTickets")),
    ticketReference: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_userId_timestamp", ["userId", "timestamp"])
    .index("by_conversationId_timestamp", ["conversationId", "timestamp"])
    .index("by_actionType_timestamp", ["actionType", "timestamp"]),

  supportAgentRateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"]),

  superAdminAuditLogs: defineTable({
    superAdminUserId: v.optional(v.id("users")),
    superAdminAuthId: v.optional(v.string()),
    superAdminName: v.string(),
    superAdminEmail: v.string(),
    action: v.string(),
    module: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    status: v.union(v.literal("success"), v.literal("failed"), v.literal("denied")),
    reason: v.optional(v.string()),
    metadataSafe: v.optional(v.any()),
    ipHash: v.optional(v.string()),
    userAgentSafe: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_superAdminUserId_createdAt", ["superAdminUserId", "createdAt"])
    .index("by_action_createdAt", ["action", "createdAt"])
    .index("by_module_createdAt", ["module", "createdAt"])
    .index("by_targetType_targetId", ["targetType", "targetId"]),

  // ============================================
  // PSN TOKEN CACHE (for PSN API authentication)
  // ============================================
  psnTokenCache: defineTable({
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    updatedAt: v.number(),
  }),
});
