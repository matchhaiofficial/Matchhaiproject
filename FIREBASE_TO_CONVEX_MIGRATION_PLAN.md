# Firebase to Convex Migration Plan

## MatchHai - Sports Venue Booking Platform

**Document Version:** 1.0
**Date:** 2026-02-26
**Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Firebase Audit Summary](#2-firebase-audit-summary)
3. [Convex Architecture Overview](#3-convex-architecture-overview)
4. [Migration Architecture Design](#4-migration-architecture-design)
5. [Schema Design](#5-schema-design)
6. [Service Layer Architecture](#6-service-layer-architecture)
7. [Authentication Migration](#7-authentication-migration)
8. [Real-Time Subscriptions Migration](#8-real-time-subscriptions-migration)
9. [File Storage Migration](#9-file-storage-migration)
10. [Cloud Functions Migration](#10-cloud-functions-migration)
11. [Step-by-Step Migration Plan](#11-step-by-step-migration-plan)
12. [Risk Mitigation](#12-risk-mitigation)
13. [Testing Strategy](#13-testing-strategy)
14. [Clarifying Questions](#14-clarifying-questions)

---

## 1. Executive Summary

### Current State
MatchHai is a sports venue booking platform built with:
- **Frontend:** Expo 54, React Native 0.81, React 19, TypeScript
- **Backend:** Firebase (Auth, Firestore, Storage, Cloud Functions)
- **Express.js API Bridge:** For Steam/FACEIT/PSN integrations

### Goal
Complete migration from Firebase to Convex while:
- Preserving ALL existing functionality
- Maintaining identical UI/UX
- Implementing clean separation of concerns
- Ensuring service layer abstraction (no direct Convex calls from screens)

### Key Principles
1. **Zero UI Changes** - Only backend replacement
2. **Service Abstraction Layer** - Screens call services, services call Convex
3. **Feature Parity** - All Firebase functionality replicated in Convex
4. **Type Safety** - Full TypeScript throughout

---

## 2. Firebase Audit Summary

### 2.1 Files Using Firebase

| Category | Count | Description |
|----------|-------|-------------|
| Services | 16 | Business logic files |
| Screens | 21 | App screens with Firebase usage |
| Context/Hooks | 2 | AuthContext, useZoneData |
| Components | 2 | InAppNotificationBridge, etc. |
| Cloud Functions | 3 | Teams, Social functions |
| Configuration | 4 | firebaseConfig, rules, etc. |
| **Total** | **48** | Files requiring migration |

### 2.2 Firebase Services Used

| Service | Usage | Migration Target |
|---------|-------|------------------|
| Firebase Auth | Email/password, phone lookup | Convex Auth |
| Firestore | Document database | Convex Database |
| Firebase Storage | File uploads (team logos, etc.) | Convex File Storage |
| Cloud Functions | Server-side team/social ops | Convex Actions/Mutations |

### 2.3 Firestore Collections

```
├── users/{uid}
│   ├── wallet_transactions/{txId}
│   ├── friends/{friendUid}
│   └── blocks/{blockedUid}
├── matchrooms/{roomId}
├── booking_intents/{intentId}
├── booking_requests/{requestId}
├── zone_offers/{offerId}
├── teams/{teamId}
│   └── members/{uid}
├── team_challenges/{challengeId}
├── zones/{zoneId}
│   ├── pricing_rules/{ruleId}
│   └── resources/{resourceId}
├── notifications/{notificationId}
├── chatrooms/{chatId}
├── reports/{reportId}
└── pricing_rules/{ruleId}
```

### 2.4 Real-Time Listeners (8 Total)

| Location | Collection | Purpose |
|----------|------------|---------|
| AuthContext | Auth State | Global user state |
| useZoneData Hook | zones | Zone admin data |
| InAppNotificationBridge | notifications | Push notifications |
| Matchroom Detail | matchrooms | Live player updates |
| ZoneAdminBookingService | booking_requests | Booking queue |
| PricingRuleService | pricing_rules | Dynamic pricing |
| ZoneAdminResourceService | resources | Resource availability |
| TeamMatchService | team_challenges | Challenge updates |

### 2.5 Direct Firebase Usage in Screens (To Be Refactored)

| Screen | Firebase Operations | Refactoring Required |
|--------|---------------------|---------------------|
| `/app/matchrooms/[id].tsx` | collection, doc, getDoc, onSnapshot | Move to matchService |
| `/app/matchrooms/chat/[id].tsx` | addDoc, onSnapshot | Create chatService |
| `/app/(player)/(tabs)/index.tsx` | getDocs, onSnapshot | Move to dashboardService |
| `/app/zone/modules/bookings.tsx` | collection, setDoc, query | Move to zoneService |

---

## 3. Convex Architecture Overview

### 3.1 Core Concepts Mapping

| Firebase | Convex | Notes |
|----------|--------|-------|
| `collection()` | Table in schema | Defined in schema.ts |
| `doc()` | `ctx.db.get(id)` | Direct document access |
| `getDoc()` | `ctx.db.get(id)` | Single document fetch |
| `getDocs(query)` | `ctx.db.query().collect()` | Query with results |
| `addDoc()` | `ctx.db.insert()` | Insert new document |
| `setDoc()` | `ctx.db.insert()` / `ctx.db.replace()` | Create or overwrite |
| `updateDoc()` | `ctx.db.patch()` | Partial update |
| `deleteDoc()` | `ctx.db.delete()` | Delete document |
| `where()` | `.withIndex()` | Index-based filtering |
| `orderBy()` | `.order()` | Sorting |
| `limit()` | `.take()` | Limit results |
| `onSnapshot()` | `useQuery()` hook | Automatic real-time |
| `serverTimestamp()` | `Date.now()` or `_creationTime` | Timestamps |
| `arrayUnion()` | Array operations in mutation | Handled in code |
| `arrayRemove()` | Array operations in mutation | Handled in code |
| `writeBatch()` | Single mutation (transactional) | Auto-batched |
| `runTransaction()` | Mutation (automatic transaction) | Auto-transactional |

### 3.2 Convex Function Types

| Type | Purpose | Firebase Equivalent |
|------|---------|---------------------|
| `query` | Read-only, cached, reactive | Firestore queries |
| `mutation` | Read/write, transactional | Firestore writes |
| `action` | External APIs, side effects | Cloud Functions |
| `internalQuery` | Private queries | N/A |
| `internalMutation` | Private mutations | N/A |
| `internalAction` | Private actions | Cloud Functions |

### 3.3 Real-Time Architecture

**Firebase Approach:**
```typescript
// Manual subscription management
const unsubscribe = onSnapshot(query(collection(db, "matchrooms"), where(...)), (snapshot) => {
  // Update state
});
// Must cleanup on unmount
```

**Convex Approach:**
```typescript
// Automatic real-time
const matchrooms = useQuery(api.matchrooms.list, { status: "open" });
// Automatic cleanup, automatic re-subscription
```

---

## 4. Migration Architecture Design

### 4.1 Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI LAYER (SCREENS)                        │
│   /app/matchrooms/[id].tsx, /app/(player)/(tabs)/index.tsx      │
│   - NO direct Convex imports                                     │
│   - Only imports from /src/services/*                            │
│   - Receives data via hooks or callbacks                         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER (/src/services/)                │
│   matchService.ts, userService.ts, bookingService.ts, etc.      │
│   - Contains business logic                                      │
│   - Wraps Convex operations                                      │
│   - Provides clean TypeScript interfaces                         │
│   - Handles error transformation                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CONVEX LAYER (/convex/)                        │
│   queries, mutations, actions, schema                            │
│   - Pure Convex functions                                        │
│   - Type-safe with validators                                    │
│   - Internal functions for private operations                    │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Convex Directory Structure

```
/convex
├── _generated/           # Auto-generated (api, server, dataModel)
├── schema.ts             # Database schema with all tables
├── auth.ts               # Convex Auth configuration
├── http.ts               # HTTP endpoints (if needed)
├── users.ts              # User queries/mutations
├── matchrooms.ts         # Matchroom queries/mutations
├── bookings.ts           # Booking queries/mutations
├── teams.ts              # Team queries/mutations
├── zones.ts              # Zone queries/mutations
├── notifications.ts      # Notification queries/mutations
├── chat.ts               # Chat queries/mutations
├── reports.ts            # Report queries/mutations
├── storage.ts            # File storage operations
├── social.ts             # Friend/block operations
├── crons.ts              # Scheduled jobs
└── tsconfig.json         # TypeScript config
```

### 4.3 Service Layer Pattern

```typescript
// /src/services/matchService.ts

import { api } from '../convex/_generated/api';
import { ConvexClient } from './convexClient';
import type { Id } from '../convex/_generated/dataModel';

export interface Matchroom {
  _id: Id<"matchrooms">;
  hostUid: Id<"users">;
  game: string;
  status: "open" | "in-progress" | "completed" | "locked" | "expired";
  // ... other fields
}

export interface CreateMatchroomParams {
  game: string;
  mode: string;
  locationMode: "online" | "zone";
  // ... other params
}

class MatchService {
  // CREATE
  async createMatchroom(params: CreateMatchroomParams): Promise<{ ok: boolean; id?: string; message?: string }> {
    try {
      const id = await ConvexClient.mutation(api.matchrooms.create, params);
      return { ok: true, id };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }

  // READ
  async getMatchroom(id: string): Promise<Matchroom | null> {
    return await ConvexClient.query(api.matchrooms.get, { id });
  }

  // UPDATE
  async updateMatchroom(id: string, updates: Partial<Matchroom>): Promise<{ ok: boolean; message?: string }> {
    try {
      await ConvexClient.mutation(api.matchrooms.update, { id, ...updates });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }

  // DELETE
  async deleteMatchroom(id: string): Promise<{ ok: boolean; message?: string }> {
    try {
      await ConvexClient.mutation(api.matchrooms.remove, { id });
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  }

  // REAL-TIME HOOK WRAPPER
  useMatchroom(id: string) {
    // Returns hook for component use
    return useQuery(api.matchrooms.get, { id });
  }

  useOpenMatchrooms() {
    return useQuery(api.matchrooms.listOpen, {});
  }
}

export const matchService = new MatchService();
```

### 4.4 Convex Client Wrapper

```typescript
// /src/services/convexClient.ts

import { ConvexReactClient } from "convex/react";
import { FunctionReference, FunctionArgs, FunctionReturnType } from "convex/server";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL!;

// Singleton client for non-React contexts
class ConvexClientWrapper {
  private client: ConvexReactClient;

  constructor() {
    this.client = new ConvexReactClient(convexUrl, {
      unsavedChangesWarning: false,
    });
  }

  getClient() {
    return this.client;
  }

  async query<T extends FunctionReference<"query">>(
    fn: T,
    args: FunctionArgs<T>
  ): Promise<FunctionReturnType<T>> {
    return await this.client.query(fn, args);
  }

  async mutation<T extends FunctionReference<"mutation">>(
    fn: T,
    args: FunctionArgs<T>
  ): Promise<FunctionReturnType<T>> {
    return await this.client.mutation(fn, args);
  }

  async action<T extends FunctionReference<"action">>(
    fn: T,
    args: FunctionArgs<T>
  ): Promise<FunctionReturnType<T>> {
    return await this.client.action(fn, args);
  }
}

export const ConvexClient = new ConvexClientWrapper();
```

---

## 5. Schema Design

### 5.1 Convex Schema (`/convex/schema.ts`)

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Auth tables (from Convex Auth)
  ...authTables,

  // ============================================
  // USERS TABLE
  // ============================================
  users: defineTable({
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

    // External IDs
    steamId: v.optional(v.string()),
    faceitId: v.optional(v.string()),
    psnId: v.optional(v.string()),

    // Skill scores (embedded)
    skillScores: v.optional(v.object({
      cs2: v.optional(v.object({
        rating: v.number(),
        tier: v.string(),
        matchesPlayed: v.number(),
        wins: v.number(),
        losses: v.number(),
        lastUpdated: v.number(),
      })),
      tekken: v.optional(v.object({
        rating: v.number(),
        tier: v.string(),
        matchesPlayed: v.number(),
        wins: v.number(),
        losses: v.number(),
        lastUpdated: v.number(),
      })),
      futsal: v.optional(v.object({
        rating: v.number(),
        tier: v.string(),
        matchesPlayed: v.number(),
        wins: v.number(),
        losses: v.number(),
        lastUpdated: v.number(),
      })),
      cricket: v.optional(v.object({
        rating: v.number(),
        tier: v.string(),
        matchesPlayed: v.number(),
        wins: v.number(),
        losses: v.number(),
        lastUpdated: v.number(),
      })),
    })),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_usernameLower", ["usernameLower"])
    .index("by_phone", ["phone"])
    .index("by_steamId", ["steamId"])
    .index("by_accountType", ["accountType"]),

  // ============================================
  // USER FRIENDSHIPS (subcollection replacement)
  // ============================================
  friendships: defineTable({
    userId: v.id("users"),
    friendId: v.id("users"),
    username: v.string(),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_friendId", ["friendId"])
    .index("by_userId_and_friendId", ["userId", "friendId"]),

  // ============================================
  // USER BLOCKS (subcollection replacement)
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
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    reference: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_status", ["userId", "status"]),

  // ============================================
  // MATCHROOMS
  // ============================================
  matchrooms: defineTable({
    hostUid: v.id("users"),
    game: v.string(),
    mode: v.string(),
    status: v.union(
      v.literal("open"),
      v.literal("in-progress"),
      v.literal("completed"),
      v.literal("locked"),
      v.literal("expired")
    ),

    // Location
    locationMode: v.union(v.literal("online"), v.literal("zone")),
    zoneId: v.optional(v.id("zones")),
    coordinates: v.optional(v.object({
      latitude: v.number(),
      longitude: v.number(),
    })),

    // Players
    playerUids: v.array(v.id("users")),
    sideASlots: v.array(v.object({
      uid: v.optional(v.id("users")),
      username: v.optional(v.string()),
      isFilled: v.boolean(),
    })),
    sideBSlots: v.array(v.object({
      uid: v.optional(v.id("users")),
      username: v.optional(v.string()),
      isFilled: v.boolean(),
    })),

    // Pricing
    pricing: v.optional(v.object({
      totalCost: v.number(),
      perPlayerCost: v.number(),
      currency: v.string(),
    })),

    // Schedule
    scheduledAt: v.optional(v.number()),

    // Result verification
    resultVerification: v.optional(v.object({
      winningSide: v.optional(v.union(v.literal("A"), v.literal("B"))),
      verifiedByHost: v.boolean(),
      verifiedAt: v.optional(v.number()),
    })),

    createdAt: v.number(),
    updatedAt: v.number(),
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
    captainApproval: v.optional(v.object({
      approved: v.boolean(),
      approvedAt: v.optional(v.number()),
    })),
    zoneApproval: v.optional(v.object({
      approved: v.boolean(),
      approvedAt: v.optional(v.number()),
    })),

    // Pricing
    pricing: v.optional(v.object({
      totalCost: v.number(),
      perPlayerCost: v.number(),
    })),

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
    game: v.string(),
    captainUid: v.id("users"),

    // Members
    memberUids: v.array(v.id("users")),
    memberCount: v.number(),
    maxMembers: v.number(),

    // Logo/branding
    logoStorageId: v.optional(v.id("_storage")),
    logoUrl: v.optional(v.string()),

    // Stats
    stats: v.optional(v.object({
      wins: v.number(),
      losses: v.number(),
      matchesPlayed: v.number(),
    })),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_captainUid", ["captainUid"])
    .index("by_game", ["game"])
    .index("by_nameLower", ["nameLower"]),

  // ============================================
  // TEAM MEMBERS (subcollection replacement)
  // ============================================
  teamMembers: defineTable({
    teamId: v.id("teams"),
    userId: v.id("users"),
    username: v.string(),
    role: v.union(v.literal("captain"), v.literal("member")),
    joinedAt: v.number(),
  })
    .index("by_teamId", ["teamId"])
    .index("by_userId", ["userId"])
    .index("by_teamId_and_userId", ["teamId", "userId"]),

  // ============================================
  // TEAM CHALLENGES
  // ============================================
  teamChallenges: defineTable({
    challengerTeamId: v.id("teams"),
    opponentTeamId: v.id("teams"),
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
    scheduledAt: v.optional(v.number()),

    // Result
    result: v.optional(v.object({
      winnerId: v.id("teams"),
      score: v.optional(v.string()),
    })),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_challengerTeamId", ["challengerTeamId"])
    .index("by_opponentTeamId", ["opponentTeamId"])
    .index("by_status", ["status"]),

  // ============================================
  // ZONES
  // ============================================
  zones: defineTable({
    ownerUid: v.id("users"),
    name: v.string(),
    status: v.union(
      v.literal("pending-review"),
      v.literal("active"),
      v.literal("rejected"),
      v.literal("suspended")
    ),

    // Details
    description: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),

    // Games supported
    games: v.array(v.string()),

    // Branches
    branches: v.array(v.object({
      id: v.string(),
      name: v.string(),
      address: v.optional(v.string()),
      capacity: v.optional(v.number()),
    })),

    // Pricing defaults
    defaultPricing: v.optional(v.object({
      hourlyRate: v.number(),
      currency: v.string(),
    })),

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
      v.literal("matchroom_invite"),
      v.literal("booking_update"),
      v.literal("challenge_received"),
      v.literal("general")
    ),

    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("read"),
      v.literal("expired")
    ),

    // Entity references
    entityKey: v.optional(v.string()),
    entityId: v.optional(v.string()),

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
    .index("by_entityKey", ["entityKey"]),

  // ============================================
  // CHATROOMS (for matchrooms)
  // ============================================
  chatrooms: defineTable({
    matchroomId: v.id("matchrooms"),
    participantUids: v.array(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_matchroomId", ["matchroomId"]),

  // ============================================
  // CHAT MESSAGES
  // ============================================
  chatMessages: defineTable({
    chatroomId: v.id("chatrooms"),
    senderUid: v.id("users"),
    senderUsername: v.string(),
    content: v.string(),
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
    status: v.union(v.literal("pending"), v.literal("reviewed"), v.literal("resolved")),

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
});
```

---

## 6. Service Layer Architecture

### 6.1 Service Files to Create/Modify

| Current Firebase Service | Convex Service | Changes Required |
|--------------------------|----------------|------------------|
| `authService.ts` | `authService.ts` (refactored) | Replace Firebase Auth with Convex Auth |
| `userService.ts` | `userService.ts` (refactored) | Replace Firestore with Convex queries/mutations |
| `matchService.ts` | `matchService.ts` (refactored) | Replace Firestore + add useQuery hooks |
| `bookingService.ts` | `bookingService.ts` (refactored) | Replace Firestore |
| `bookingRequestService.ts` | `bookingRequestService.ts` (refactored) | Replace Firestore |
| `teamService.ts` | `teamService.ts` (refactored) | Replace Firestore + Storage |
| `teamMatchService.ts` | `teamMatchService.ts` (refactored) | Replace Firestore |
| `zoneService.ts` | `zoneService.ts` (refactored) | Replace Firestore |
| `zoneAdminBookingService.ts` | `zoneAdminBookingService.ts` (refactored) | Replace listeners |
| `zoneAdminResourceService.ts` | `zoneAdminResourceService.ts` (refactored) | Replace listeners |
| `skillRatingService.ts` | `skillRatingService.ts` (refactored) | Replace Firestore |
| `pricingRuleService.ts` | `pricingRuleService.ts` (refactored) | Replace Firestore |
| `reportService.ts` | `reportService.ts` (refactored) | Replace Firestore |
| `superAdminService.ts` | `superAdminService.ts` (refactored) | Replace Firestore |
| `functions.ts` (social) | `socialService.ts` (new) | Extract from Cloud Functions |
| N/A | `chatService.ts` (new) | Consolidate chat operations |
| N/A | `notificationService.ts` (new) | Consolidate notification operations |
| N/A | `storageService.ts` (new) | Convex file storage wrapper |

### 6.2 Service Interface Example

```typescript
// /src/services/types.ts

export interface ServiceResult<T = void> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Usage in services:
async function createUser(): Promise<ServiceResult<{ id: string }>> {
  return { ok: true, data: { id: "123" } };
}
```

### 6.3 Convex Hooks Wrapper

```typescript
// /src/hooks/useConvexQuery.ts

import { useQuery as useConvexQuery, useMutation as useConvexMutation } from "convex/react";
import { FunctionReference, FunctionArgs } from "convex/server";

// Type-safe wrapper for useQuery
export function useQuery<T extends FunctionReference<"query">>(
  fn: T,
  args: FunctionArgs<T> | "skip"
) {
  return useConvexQuery(fn, args === "skip" ? "skip" : args);
}

// Type-safe wrapper for useMutation
export function useMutation<T extends FunctionReference<"mutation">>(fn: T) {
  return useConvexMutation(fn);
}
```

---

## 7. Authentication Migration

### 7.1 Current Firebase Auth Flow

```
1. User enters email/password or phone
2. authService.signUpWithEmailAsync() or signInWithEmail()
3. Firebase Auth creates user / validates credentials
4. Creates Firestore user document
5. onAuthStateChanged updates AuthContext
6. App renders based on user state
```

### 7.2 New Convex Auth Flow

```
1. User enters email/password
2. authService.signUp() / signIn()
3. Convex Auth handles credentials
4. Convex mutation creates user document
5. ConvexAuthProvider updates auth state
6. App renders based on user state
```

### 7.3 Convex Auth Setup

```typescript
// /convex/auth.ts

import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
});
```

```typescript
// /convex/auth.config.ts

export default {
  providers: [
    {
      domain: process.env.AUTH_DOMAIN,
      applicationID: "convex",
    },
  ],
};
```

### 7.4 Updated AuthContext

```typescript
// /src/context/AuthContext.tsx

import { ConvexAuthState, useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

interface User {
  _id: Id<"users">;
  email: string;
  fullName: string;
  username: string;
  accountType: "player" | "zone";
  // ... other fields
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  // Get full user profile when authenticated
  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  return (
    <AuthContext.Provider value={{
      user: user ?? null,
      isLoading,
      isAuthenticated,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### 7.5 Phone Login Support

Firebase allowed phone-based lookup. For Convex:

```typescript
// /convex/users.ts

export const getUserByPhone = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .unique();
  },
});
```

The auth service will:
1. Query user by phone to get email
2. Use email for Convex Auth sign-in

---

## 8. Real-Time Subscriptions Migration

### 8.1 Firebase → Convex Listener Migration

| Firebase Listener | Convex Equivalent |
|-------------------|-------------------|
| `onAuthStateChanged()` | `useConvexAuth()` hook |
| `onSnapshot(collection)` | `useQuery()` hook |
| Manual unsubscribe | Automatic (React lifecycle) |

### 8.2 Example: Notification Listener

**Firebase (Current):**
```typescript
// InAppNotificationBridge.tsx
useEffect(() => {
  const unsubscribe = onSnapshot(
    query(collection(db, "notifications"), where("toUid", "==", user.uid)),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          // Show notification
        }
      });
    }
  );
  return () => unsubscribe();
}, [user.uid]);
```

**Convex (New):**
```typescript
// InAppNotificationBridge.tsx
const notifications = useQuery(
  api.notifications.listForUser,
  user?._id ? { userId: user._id } : "skip"
);

// Handle new notifications
const prevNotificationsRef = useRef<Set<string>>(new Set());

useEffect(() => {
  if (!notifications) return;

  const currentIds = new Set(notifications.map(n => n._id));
  const newNotifications = notifications.filter(
    n => !prevNotificationsRef.current.has(n._id)
  );

  newNotifications.forEach(notification => {
    // Show local notification
    scheduleNotificationAsync({
      content: { title: notification.title, body: notification.body },
      trigger: null,
    });
  });

  prevNotificationsRef.current = currentIds;
}, [notifications]);
```

### 8.3 Example: Matchroom Real-time

**Firebase (Current):**
```typescript
// app/matchrooms/[id].tsx
useEffect(() => {
  const unsubscribe = onSnapshot(doc(db, "matchrooms", roomId), (snap) => {
    setRoom(snap.data());
  });
  return () => unsubscribe();
}, [roomId]);
```

**Convex (New):**
```typescript
// app/matchrooms/[id].tsx
import { useMatchroom } from "@/src/services/matchService";

export default function MatchroomDetail() {
  const { id } = useLocalSearchParams();
  const matchroom = useMatchroom(id as string); // Auto-reactive!

  if (!matchroom) return <Loading />;

  return <MatchroomView data={matchroom} />;
}
```

---

## 9. File Storage Migration

### 9.1 Current Firebase Storage Usage

- Team logo uploads (`teamService.ts`)
- Profile picture uploads
- Match evidence/screenshots

### 9.2 Convex Storage Implementation

```typescript
// /convex/storage.ts

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Generate upload URL
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Get file URL
export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Delete file
export const deleteFile = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await ctx.storage.delete(args.storageId);
  },
});
```

### 9.3 Storage Service Wrapper

```typescript
// /src/services/storageService.ts

import { api } from "../convex/_generated/api";
import { ConvexClient } from "./convexClient";
import type { Id } from "../convex/_generated/dataModel";

class StorageService {
  async uploadFile(file: Blob): Promise<{ ok: boolean; storageId?: Id<"_storage">; error?: string }> {
    try {
      // 1. Get upload URL
      const uploadUrl = await ConvexClient.mutation(api.storage.generateUploadUrl, {});

      // 2. Upload file
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) throw new Error("Upload failed");

      const { storageId } = await response.json();
      return { ok: true, storageId };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async getFileUrl(storageId: Id<"_storage">): Promise<string | null> {
    return await ConvexClient.query(api.storage.getFileUrl, { storageId });
  }

  async deleteFile(storageId: Id<"_storage">): Promise<{ ok: boolean }> {
    try {
      await ConvexClient.mutation(api.storage.deleteFile, { storageId });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }
}

export const storageService = new StorageService();
```

---

## 10. Cloud Functions Migration

### 10.1 Current Cloud Functions

| Function | Type | Purpose |
|----------|------|---------|
| `createTeam` | onCall | Create team with validation |
| `requestToJoinTeam` | onCall | Join request with notifications |
| `respondToJoinRequest` | onCall | Accept/reject with updates |
| `transferCaptain` | onCall | Captain role transfer |
| `removeMember` | onCall | Remove with counter updates |
| `sendFriendRequest` | onCall | Friend request with dedup |
| `respondFriendRequest` | onCall | Bidirectional friendship |
| `removeFriend` | onCall | Bidirectional removal |
| `blockUser` | onCall | Block record creation |

### 10.2 Convex Replacement Strategy

Cloud Functions → Convex Mutations (for transactional ops)
Cloud Functions → Convex Actions (for external API calls)

### 10.3 Example: Team Creation

**Firebase Cloud Function (Current):**
```typescript
// functions/src/teams.ts
export const createTeam = onCall(async (request) => {
  const { name, game } = request.data;
  const uid = request.auth?.uid;

  // Validation
  if (!uid) throw new HttpsError("unauthenticated", "Must be logged in");

  // Create team
  const teamRef = db.collection("teams").doc();
  await teamRef.set({
    name,
    game,
    captainUid: uid,
    memberUids: [uid],
    memberCount: 1,
    createdAt: admin.firestore.Timestamp.now(),
  });

  // Create member record
  await db.collection("teams").doc(teamRef.id).collection("members").doc(uid).set({
    uid,
    role: "captain",
    joinedAt: admin.firestore.Timestamp.now(),
  });

  return { teamId: teamRef.id };
});
```

**Convex Mutation (New):**
```typescript
// /convex/teams.ts

import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
    game: v.string(),
    maxMembers: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Must be logged in");

    // Get user from users table
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .unique();

    if (!user) throw new Error("User not found");

    const now = Date.now();

    // Create team (transaction is automatic)
    const teamId = await ctx.db.insert("teams", {
      name: args.name,
      nameLower: args.name.toLowerCase(),
      game: args.game,
      captainUid: user._id,
      memberUids: [user._id],
      memberCount: 1,
      maxMembers: args.maxMembers ?? 10,
      stats: { wins: 0, losses: 0, matchesPlayed: 0 },
      createdAt: now,
      updatedAt: now,
    });

    // Create member record (same transaction)
    await ctx.db.insert("teamMembers", {
      teamId,
      userId: user._id,
      username: user.username,
      role: "captain",
      joinedAt: now,
    });

    return teamId;
  },
});
```

### 10.4 Scheduled Functions (for background tasks)

```typescript
// /convex/matchrooms.ts

export const scheduleExpiration = mutation({
  args: { matchroomId: v.id("matchrooms"), expiresAt: v.number() },
  handler: async (ctx, args) => {
    const delay = args.expiresAt - Date.now();
    if (delay > 0) {
      await ctx.scheduler.runAfter(delay, internal.matchrooms.checkExpiration, {
        matchroomId: args.matchroomId,
      });
    }
  },
});

export const checkExpiration = internalMutation({
  args: { matchroomId: v.id("matchrooms") },
  handler: async (ctx, args) => {
    const matchroom = await ctx.db.get(args.matchroomId);
    if (matchroom && matchroom.status === "open") {
      await ctx.db.patch(args.matchroomId, {
        status: "expired",
        updatedAt: Date.now(),
      });
    }
  },
});
```

---

## 11. Step-by-Step Migration Plan

### Phase 1: Setup & Infrastructure (Week 1)

- [ ] **1.1** Install Convex packages
  ```bash
  npm install convex @convex-dev/auth @auth/core
  ```

- [ ] **1.2** Initialize Convex project
  ```bash
  npx convex dev
  ```

- [ ] **1.3** Create `/convex/schema.ts` with all tables

- [ ] **1.4** Set up Convex Auth in `/convex/auth.ts`

- [ ] **1.5** Update `app/_layout.tsx` with ConvexProvider

- [ ] **1.6** Create `/src/services/convexClient.ts` wrapper

- [ ] **1.7** Add environment variables
  ```
  EXPO_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
  ```

### Phase 2: Core Services Migration (Week 2-3)

- [ ] **2.1** Migrate `authService.ts`
  - Replace Firebase Auth calls with Convex Auth
  - Update sign up flow
  - Update sign in flow
  - Update password reset

- [ ] **2.2** Migrate `userService.ts`
  - Create `/convex/users.ts` queries/mutations
  - Update availability checks (username, phone, email)
  - Update profile operations

- [ ] **2.3** Migrate `matchService.ts`
  - Create `/convex/matchrooms.ts`
  - Create, read, update, delete operations
  - Player join/leave operations
  - Status transitions

- [ ] **2.4** Migrate `teamService.ts`
  - Create `/convex/teams.ts`
  - Team CRUD operations
  - Member management
  - Logo upload with Convex Storage

### Phase 3: Booking & Zone Services (Week 3-4)

- [ ] **3.1** Migrate `bookingService.ts`
  - Create `/convex/bookings.ts`
  - Booking intent operations
  - Approval flows

- [ ] **3.2** Migrate `bookingRequestService.ts`
  - Create `/convex/bookingRequests.ts`
  - Request creation
  - Offer handling

- [ ] **3.3** Migrate `zoneService.ts`
  - Create `/convex/zones.ts`
  - Zone CRUD
  - Branch management

- [ ] **3.4** Migrate `zoneAdminBookingService.ts`
  - Convert onSnapshot to useQuery
  - Booking queue management

- [ ] **3.5** Migrate `zoneAdminResourceService.ts`
  - Resource management
  - Real-time availability

### Phase 4: Social & Notifications (Week 4-5)

- [ ] **4.1** Create `socialService.ts`
  - Friend requests
  - Friend management
  - Block functionality

- [ ] **4.2** Migrate `notificationService.ts` (new)
  - Create `/convex/notifications.ts`
  - Notification CRUD
  - Real-time subscriptions

- [ ] **4.3** Update `InAppNotificationBridge.tsx`
  - Replace onSnapshot with useQuery
  - Handle new notification detection

### Phase 5: Supporting Services (Week 5)

- [ ] **5.1** Migrate `skillRatingService.ts`

- [ ] **5.2** Migrate `pricingRuleService.ts`

- [ ] **5.3** Migrate `reportService.ts`

- [ ] **5.4** Migrate `superAdminService.ts`

- [ ] **5.5** Create `chatService.ts`
  - Create `/convex/chat.ts`
  - Real-time messaging

### Phase 6: Screen Updates (Week 6-7)

- [ ] **6.1** Remove all direct Firebase imports from screens

- [ ] **6.2** Update screens to use service layer

- [ ] **6.3** Replace onSnapshot patterns with useQuery

- [ ] **6.4** Update AuthContext integration

### Phase 7: Context & Hooks (Week 7)

- [ ] **7.1** Update `AuthContext.tsx`
  - Use ConvexAuthProvider
  - Update user state management

- [ ] **7.2** Update `useZoneData.ts` hook
  - Replace onSnapshot with useQuery

- [ ] **7.3** Create custom hooks for common patterns

### Phase 8: Cleanup & Testing (Week 8)

- [ ] **8.1** Remove all Firebase dependencies
  ```bash
  npm uninstall firebase firebase-admin
  ```

- [ ] **8.2** Delete Firebase configuration files
  - `firebaseConfig.ts`
  - `firebase.json`
  - `firestore.rules`
  - `storage.rules`
  - `.firebaserc`
  - `/functions` directory

- [ ] **8.3** Comprehensive testing
  - Auth flows
  - CRUD operations
  - Real-time subscriptions
  - File uploads
  - Cross-feature integration

- [ ] **8.4** Data migration (if needed)
  - Export Firebase data
  - Transform to Convex format
  - Import to Convex

---

## 12. Risk Mitigation

### 12.1 Potential Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | High | Keep Firebase running in parallel, comprehensive backups |
| Auth state loss | High | Implement user re-authentication flow if needed |
| Real-time sync issues | Medium | Thorough testing of all subscriptions |
| Performance regression | Medium | Benchmark before/after, optimize queries |
| Missing functionality | High | Detailed audit, feature parity checklist |

### 12.2 Rollback Plan

1. Keep Firebase project intact until migration is verified
2. Maintain git branches for easy rollback
3. Feature flag for switching between backends (if critical)

### 12.3 Parallel Running Strategy

```
Week 1-6: Firebase (primary) + Convex (development)
Week 7:   Convex (staging) + Firebase (backup)
Week 8:   Convex (production) + Firebase (archived)
```

---

## 13. Testing Strategy

### 13.1 Unit Tests

- All Convex functions
- Service layer methods
- Type validations

### 13.2 Integration Tests

- Auth flow (sign up → sign in → sign out)
- CRUD operations on all collections
- Real-time subscription updates
- File upload/download
- Cross-service operations

### 13.3 E2E Tests

- Complete user journey: Player flow
- Complete user journey: Zone admin flow
- Complete user journey: Super admin flow

### 13.4 Performance Tests

- Query response times
- Real-time update latency
- File upload speeds
- Concurrent user load

---

## 14. Clarifying Questions

Before proceeding with implementation, please clarify:

### Authentication

1. **Should we support phone-based login directly in Convex Auth, or keep the phone-to-email lookup pattern?**
   - Current: Phone → lookup email → Firebase Auth login
   - Option A: Same pattern with Convex
   - Option B: Implement phone OTP via Convex Auth

2. **Is the existing Express backend (`/matchhai-backend`) staying for Steam/FACEIT/PSN integrations, or should those move to Convex Actions?**

### Data Migration

3. **Do we need to migrate existing Firebase data to Convex?**
   - If yes, what's the expected data volume?
   - Any data that should NOT be migrated?

4. **Should user passwords be reset, or attempt to migrate auth credentials?**
   - Firebase → Convex Auth credential migration is complex
   - Option A: Force password reset for all users
   - Option B: Implement custom migration tool

### Features

5. **The current Cloud Functions (`/functions`) handle teams and social features. Should these exact behaviors be replicated, or are there any changes desired?**

6. **Are there any Firebase features currently unused that we should NOT implement in Convex?**

### Timeline & Priority

7. **What's the target timeline for this migration?**

8. **Is there a specific feature or service that should be migrated first as a proof of concept?**

### Testing & Deployment

9. **Is there a staging environment where we can test the Convex implementation before production?**

10. **Should the migration be behind a feature flag for gradual rollout?**

---

## Appendix A: Firebase to Convex Operation Mapping

### Firestore Operations

| Firebase | Convex | Notes |
|----------|--------|-------|
| `collection(db, "users")` | Schema definition | Defined in schema.ts |
| `doc(db, "users", uid)` | `ctx.db.get(userId)` | Direct by ID |
| `getDoc(docRef)` | `ctx.db.get(id)` | Returns document or null |
| `getDocs(query)` | `ctx.db.query().collect()` | Returns array |
| `addDoc(collection, data)` | `ctx.db.insert(table, data)` | Returns new ID |
| `setDoc(docRef, data)` | `ctx.db.insert()` or `ctx.db.replace()` | |
| `updateDoc(docRef, data)` | `ctx.db.patch(id, data)` | Partial update |
| `deleteDoc(docRef)` | `ctx.db.delete(id)` | |
| `where("field", "==", val)` | `.withIndex()` | Requires index |
| `orderBy("field")` | `.order("asc"/"desc")` | |
| `limit(n)` | `.take(n)` | |
| `serverTimestamp()` | `Date.now()` | Or use _creationTime |
| `arrayUnion(val)` | Array spread in mutation | Manual in handler |
| `arrayRemove(val)` | Array filter in mutation | Manual in handler |
| `writeBatch()` | Single mutation | Auto-batched |
| `runTransaction()` | Mutation handler | Auto-transactional |

### Auth Operations

| Firebase | Convex |
|----------|--------|
| `createUserWithEmailAndPassword()` | Convex Auth `signUp` |
| `signInWithEmailAndPassword()` | Convex Auth `signIn` |
| `signOut()` | Convex Auth `signOut` |
| `onAuthStateChanged()` | `useConvexAuth()` hook |
| `updateProfile()` | Mutation to update users table |
| `sendPasswordResetEmail()` | Convex Auth password reset |

### Storage Operations

| Firebase | Convex |
|----------|--------|
| `ref(storage, path)` | N/A (ID-based) |
| `uploadBytes(ref, file)` | POST to generateUploadUrl |
| `getDownloadURL(ref)` | `ctx.storage.getUrl(id)` |
| `deleteObject(ref)` | `ctx.storage.delete(id)` |

---

## Appendix B: Service Method Signatures

### AuthService

```typescript
interface AuthService {
  signUp(email: string, password: string, profile: UserProfile): Promise<ServiceResult<User>>;
  signIn(emailOrPhone: string, password: string): Promise<ServiceResult<User>>;
  signOut(): Promise<ServiceResult>;
  sendPasswordReset(email: string): Promise<ServiceResult>;
  getCurrentUser(): User | null;
  useAuth(): { user: User | null; isLoading: boolean; isAuthenticated: boolean };
}
```

### MatchService

```typescript
interface MatchService {
  create(params: CreateMatchroomParams): Promise<ServiceResult<{ id: string }>>;
  get(id: string): Promise<Matchroom | null>;
  update(id: string, updates: Partial<Matchroom>): Promise<ServiceResult>;
  delete(id: string): Promise<ServiceResult>;
  joinSlot(matchroomId: string, side: "A" | "B", slotIndex: number): Promise<ServiceResult>;
  leaveSlot(matchroomId: string, side: "A" | "B", slotIndex: number): Promise<ServiceResult>;
  updateStatus(id: string, status: MatchroomStatus): Promise<ServiceResult>;

  // Hooks
  useMatchroom(id: string): Matchroom | null | undefined;
  useOpenMatchrooms(filters?: MatchroomFilters): Matchroom[] | undefined;
  useUserMatchrooms(userId: string): Matchroom[] | undefined;
}
```

---

**Document End**

*This migration plan should be reviewed and approved before implementation begins.*
