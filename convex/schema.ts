import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Skill score validator (reusable)
const skillScoreValidator = v.object({
  rating: v.number(),
  tier: v.string(),
  matchesPlayed: v.number(),
  wins: v.number(),
  losses: v.number(),
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
    accountType: v.union(v.literal("player"), v.literal("zone")),

    // Profile
    photoURL: v.optional(v.string()),
    bio: v.optional(v.string()),

    // Status
    isOnline: v.boolean(),
    isVerified: v.optional(v.boolean()),

    // Location preferences (Step 2)
    areasPreferred: v.optional(v.array(v.string())),
    city: v.optional(v.string()),
    ageRange: v.optional(v.string()),

    // Game preferences (Step 2)
    playsCs2: v.optional(v.boolean()),
    cs2Role: v.optional(v.string()),
    playsFc: v.optional(v.boolean()),
    fcTeam: v.optional(v.string()),
    fcFormation: v.optional(v.string()),
    playsTekken: v.optional(v.boolean()),
    tekkenFavorites: v.optional(v.array(v.string())),

    // Sports preferences (Step 2)
    playsFutsal: v.optional(v.boolean()),
    playsIndoorCricket: v.optional(v.boolean()),
    playsPadel: v.optional(v.boolean()),
    playsPickleball: v.optional(v.boolean()),
    futsalPosition: v.optional(v.string()),
    futsalPositions: v.optional(v.array(v.string())),
    indoorCricketRole: v.optional(v.string()),
    indoorCricketBowlingStyle: v.optional(v.string()),
    indoorCricketBattingStyle: v.optional(v.string()),
    padelRole: v.optional(v.string()),
    pickleballRole: v.optional(v.string()),

    // Platform URLs (Step 3)
    steamProfileUrl: v.optional(v.string()),
    faceitProfileUrl: v.optional(v.string()),
    eaProfileUrl: v.optional(v.string()),
    xboxGamertag: v.optional(v.string()),

    // External IDs
    steamId: v.optional(v.string()),
    steamPersonaName: v.optional(v.string()),
    steamCs2Hours: v.optional(v.number()),
    eaId: v.optional(v.string()),
    faceitId: v.optional(v.string()),
    faceitNickname: v.optional(v.string()),
    faceitGame: v.optional(v.string()),
    faceitElo: v.optional(v.number()),
    faceitSkillLevel: v.optional(v.number()),
    psnAccountId: v.optional(v.string()),
    psnOnlineId: v.optional(v.string()),

    // External stats (full objects)
    steamStats: v.optional(v.any()),
    faceitStats: v.optional(v.any()),
    psnStats: v.optional(v.any()),

    // Skill scores (embedded)
    skillScores: v.optional(
      v.object({
        cs2: v.optional(skillScoreValidator),
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
    .index("by_authId", ["authId"]),

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
      v.literal("refund")
    ),
    amount: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
    reference: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_status", ["userId", "status"]),

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
    zoneId: v.optional(v.string()),
    zoneOwnerUid: v.optional(v.string()),

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
    .index("by_createdAt", ["createdAt"]),

  // ============================================
  // BOOKING INTENTS
  // ============================================
  bookingIntents: defineTable({
    matchroomId: v.id("matchrooms"),
    createdByUid: v.id("users"),
    side: v.union(v.literal("A"), v.literal("B")),
    selectedSlots: v.array(v.number()),
    status: v.union(
      v.literal("pending_approvals"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("expired")
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

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_matchroomId", ["matchroomId"])
    .index("by_createdByUid", ["createdByUid"])
    .index("by_status", ["status"]),

  // ============================================
  // BOOKING REQUESTS
  // ============================================
  bookingRequests: defineTable({
    userId: v.id("users"),
    gameKey: v.string(),
    zoneId: v.optional(v.id("zones")),
    status: v.union(
      v.literal("open"),
      v.literal("pending_payment"),
      v.literal("accepted"),
      v.literal("expired"),
      v.literal("cancelled")
    ),

    preferredDate: v.optional(v.number()),
    preferredTime: v.optional(v.string()),
    playerCount: v.number(),
    notes: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_zoneId", ["zoneId"])
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

    proposedPrice: v.number(),
    proposedDate: v.optional(v.number()),
    proposedTime: v.optional(v.string()),
    message: v.optional(v.string()),

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
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("venue_proposed"),
      v.literal("confirmed"),
      v.literal("completed"),
      v.literal("rejected"),
      v.literal("expired")
    ),

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
    senderUid: v.string(),
    senderName: v.string(),
    text: v.string(),
    createdAt: v.number(),
  })
    .index("by_chatId", ["chatId"])
    .index("by_chatId_and_createdAt", ["chatId", "createdAt"]),

  // ============================================
  // TEAM CHALLENGE CHATS (metadata)
  // ============================================
  teamChallengeChats: defineTable({
    chatId: v.string(), // External chat ID
    lastMessage: v.optional(v.object({
      text: v.string(),
      senderUid: v.string(),
    })),
    lastReadBy: v.optional(v.any()),
    updatedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_chatId", ["chatId"]),

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
        supportsFc25: v.optional(v.boolean()),
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

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerUid", ["ownerUid"])
    .index("by_status", ["status"]),

  // ============================================
  // ZONE PRICING RULES
  // ============================================
  pricingRules: defineTable({
    zoneId: v.id("zones"),
    branchId: v.optional(v.string()),
    assetType: v.string(),
    isEnabled: v.boolean(),
    priority: v.number(),

    // Time-based rules
    timeStart: v.optional(v.string()),
    timeEnd: v.optional(v.string()),
    daysOfWeek: v.optional(v.array(v.number())),

    // Price modifications
    priceMultiplier: v.optional(v.number()),
    flatRate: v.optional(v.number()),

    name: v.optional(v.string()),
    description: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_zoneId", ["zoneId"])
    .index("by_zoneId_and_assetType", ["zoneId", "assetType"]),

  // ============================================
  // ZONE RESOURCES
  // ============================================
  zoneResources: defineTable({
    zoneId: v.id("zones"),
    branchId: v.string(),
    kind: v.string(),
    name: v.string(),
    assetType: v.string(),
    lifecycleStatus: v.union(
      v.literal("available"),
      v.literal("held"),
      v.literal("booked"),
      v.literal("maintenance")
    ),

    // Capacity
    capacity: v.optional(v.number()),

    // Pricing override
    hourlyRate: v.optional(v.number()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_zoneId", ["zoneId"])
    .index("by_zoneId_and_branchId", ["zoneId", "branchId"])
    .index("by_lifecycleStatus", ["lifecycleStatus"]),

  // ============================================
  // NOTIFICATIONS
  // ============================================
  notifications: defineTable({
    toUid: v.id("users"),
    fromUid: v.optional(v.id("users")),
    fromUsername: v.optional(v.string()),

    type: v.union(
      v.literal("friend_request"),
      v.literal("team_invite"),
      v.literal("team_join_request"),
      v.literal("team_join_decision"),
      v.literal("matchroom_invite"),
      v.literal("match_join_request"),
      v.literal("match_cancelled_admin"),
      v.literal("admin_matchroom_created"),
      v.literal("booking_update"),
      v.literal("challenge_received"),
      v.literal("challenge_accepted"),
      v.literal("challenge_rejected"),
      v.literal("match_booking_captain_approval"),
      v.literal("match_seat_invitation"),
      v.literal("team_match_challenge"),
      v.literal("team_match_challenge_update"),
      v.literal("booking_request_accepted"),
      v.literal("booking_request_rejected"),
      v.literal("booking_counter_offer"),
      v.literal("general")
    ),

    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("declined"),
      v.literal("read"),
      v.literal("expired")
    ),

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
    .index("by_fromUid", ["fromUid"])
    .index("by_matchroomId", ["matchroomId"])
    .index("by_entityKey", ["entityKey"]),

  // ============================================
  // CHATROOMS (for matchrooms)
  // ============================================
  chatrooms: defineTable({
    matchroomId: v.id("matchrooms"),
    participantUids: v.array(v.string()),
    lastMessage: v.optional(v.object({
      text: v.string(),
      senderUid: v.string(),
      senderName: v.string(),
      createdAt: v.number(),
    })),
    lastReadBy: v.optional(v.any()), // Record<userId, timestamp>
    zoneId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  }).index("by_matchroomId", ["matchroomId"]),

  // ============================================
  // CHAT MESSAGES
  // ============================================
  chatMessages: defineTable({
    chatroomId: v.id("chatrooms"),
    senderUid: v.id("users"),
    senderUsername: v.string(),
    content: v.string(),
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

    // Details
    game: v.optional(v.string()),
    reason: v.string(),
    description: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_reporterUid", ["reporterUid"])
    .index("by_status", ["status"])
    .index("by_type", ["type"]),

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
