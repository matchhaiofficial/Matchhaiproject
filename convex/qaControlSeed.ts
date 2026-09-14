import { hashPassword } from "better-auth/crypto";
import { v } from "convex/values";

import { createDefaultBranchOperatingHours } from "../constants/branchOperatingHours";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation } from "./_generated/server";

const QA_PASSWORD = "Demo@123456";
const QA_SEED_SOURCE = "qa_e2e_control_2026";
const QA_TEAM_PREFIX = "QA Control ";

const CS2_EMAILS = [
  "momo_cs201.001@matchhai.demo",
  "bloody_cs202.002@matchhai.demo",
  "ang3l10wow_cs203.003@matchhai.demo",
  "dynamite_cs204.004@matchhai.demo",
  "scoffic_cs205.005@matchhai.demo",
  "sharpshooter_cs206.006@matchhai.demo",
  "soulm8_cs207.007@matchhai.demo",
  "bullet_cs208.008@matchhai.demo",
  "executor_cs209.009@matchhai.demo",
  "insmutje_cs210.010@matchhai.demo",
] as const;

const TEKKEN_EMAILS = [
  "atifbutt_tk801.051@matchhai.demo",
  "thejon_tk802.052@matchhai.demo",
  "farzeen_tk803.053@matchhai.demo",
  "arslanash_tk804.054@matchhai.demo",
] as const;

const FC_EMAILS = [
  "forazamj_fc2601.101@matchhai.demo",
  "sulimvn_fc2602.102@matchhai.demo",
  "afzal8_fc2603.103@matchhai.demo",
  "hamzak77_fc2604.104@matchhai.demo",
] as const;

const SUPER_ADMIN_EMAIL = "demo.superadmin@matchhai.demo";
const READY_ZONE_ADMIN_EMAIL = "demo.zone001@matchhai.demo";
const INCOMPLETE_ZONE_ADMIN_EMAIL = "demo.zone004@matchhai.demo";
const KYC_BLOCKED_PLAYER_EMAIL = "demo.player001@matchhai.demo";

const POSITIVE_PLAYER_EMAILS = [...CS2_EMAILS, ...TEKKEN_EMAILS, ...FC_EMAILS] as const;
const CONTROL_EMAILS = [
  ...POSITIVE_PLAYER_EMAILS,
  SUPER_ADMIN_EMAIL,
  READY_ZONE_ADMIN_EMAIL,
  INCOMPLETE_ZONE_ADMIN_EMAIL,
  KYC_BLOCKED_PLAYER_EMAIL,
] as const;

type ControlAccountKind = "player" | "super_admin" | "zone" | "kyc_blocked_player";

function requireSeedKey(seedKey: string) {
  const runtime = String(process.env.MATCHHAI_ENV || "").trim().toLowerCase();
  if (!["qa", "development", "dev", "local", "test"].includes(runtime)) {
    throw new Error("QA control seeding is restricted to QA/development runtimes.");
  }
  if (String(process.env.DEMO_SEED_ENABLED || "").trim() !== "true") {
    throw new Error("QA seed is disabled. Set DEMO_SEED_ENABLED=true temporarily.");
  }
  const expected = String(process.env.DEMO_SEED_KEY || "");
  if (!expected || seedKey !== expected) throw new Error("Invalid seedKey.");
}

function accountKind(email: string): ControlAccountKind {
  if (email === SUPER_ADMIN_EMAIL) return "super_admin";
  if (email === READY_ZONE_ADMIN_EMAIL || email === INCOMPLETE_ZONE_ADMIN_EMAIL) return "zone";
  if (email === KYC_BLOCKED_PLAYER_EMAIL) return "kyc_blocked_player";
  if ((POSITIVE_PLAYER_EMAILS as readonly string[]).includes(email)) return "player";
  throw new Error(`Unknown QA control account: ${email}`);
}

async function getUserByEmail(ctx: any, email: string): Promise<Doc<"users">> {
  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .unique();
  if (!user) throw new Error(`Required QA fixture is missing: ${email}`);
  if (!user.authId) throw new Error(`Required QA fixture has no auth link: ${email}`);
  return user;
}

export const prepareAccount = internalMutation({
  args: { seedKey: v.string(), email: v.string() },
  returns: v.object({ email: v.string(), kind: v.string(), userId: v.string() }),
  handler: async (ctx, args) => {
    requireSeedKey(args.seedKey);
    const email = args.email.trim().toLowerCase();
    const kind = accountKind(email);
    const user = await getUserByEmail(ctx, email);
    const authId = String(user.authId || "");
    if (!authId) throw new Error(`Required QA fixture has no auth link: ${email}`);
    const now = Date.now();
    const isPositive = kind === "player" || kind === "zone";

    const passwordHash = await hashPassword(QA_PASSWORD);
    const credential = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "userId", operator: "eq", value: authId },
        { connector: "AND", field: "providerId", operator: "eq", value: "credential" },
      ],
    });
    if (!credential) throw new Error(`Credential account is missing for ${email}`);
    const credentialId = String((credential as any).id || (credential as any)._id || "");
    if (!credentialId) throw new Error(`Credential account id is missing for ${email}`);

    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "account",
        where: [{ field: "_id", operator: "eq", value: credentialId }],
        update: { password: passwordHash, updatedAt: now },
      },
    });
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: "user",
        where: [{ field: "_id", operator: "eq", value: authId }],
        update: {
          emailVerified: true,
          phoneNumberVerified: isPositive,
          updatedAt: now,
        },
      },
    });

    const common = {
      accountStatus: "active" as const,
      isDemo: true,
      isVerified: true,
      onboardingCompleted: true,
      onboardingStep: 4,
      seedSource: user.seedSource || QA_SEED_SOURCE,
      updatedAt: now,
    };
    if (kind === "super_admin") {
      await ctx.db.patch(user._id, {
        ...common,
        accountType: "super_admin",
        role: "super_admin",
        isSystemAdminAccount: true,
        hiddenFromPublic: true,
        isHiddenFromDiscovery: true,
        mustChangePassword: false,
        phoneOtpVerified: true,
        phoneOtpVerifiedAt: now,
        walletBalance: undefined,
      });
    } else if (kind === "kyc_blocked_player") {
      await ctx.db.patch(user._id, {
        ...common,
        accountType: "player",
        role: undefined,
        phoneOtpVerified: false,
        phoneOtpVerifiedAt: undefined,
        kycVerificationStatus: "not_started",
        kycVerifiedAt: undefined,
        walletBalance: 5000,
      });
    } else {
      await ctx.db.patch(user._id, {
        ...common,
        accountType: kind,
        role: undefined,
        phoneOtpVerified: true,
        phoneOtpVerifiedAt: now,
        kycVerificationStatus: "verified",
        kycVerifiedAt: now,
        ...(kind === "player"
          ? {
              walletBalance: 5000,
              photoURL: `https://api.dicebear.com/9.x/initials/png?seed=${encodeURIComponent(user.username)}`,
            }
          : {}),
      });
    }
    return { email, kind, userId: String(user._id) };
  },
});

type TeamSpec = {
  name: string;
  tag: string;
  game: string;
  memberEmails: readonly string[];
};

const TEAM_SPECS: readonly TeamSpec[] = [
  { name: "QA Control CS2 Alpha", tag: "Q2A", game: "cs2", memberEmails: CS2_EMAILS.slice(0, 5) },
  { name: "QA Control CS2 Bravo", tag: "Q2B", game: "cs2", memberEmails: CS2_EMAILS.slice(5, 10) },
  { name: "QA Control Tekken Alpha", tag: "QTA", game: "tekken8", memberEmails: TEKKEN_EMAILS.slice(0, 2) },
  { name: "QA Control Tekken Bravo", tag: "QTB", game: "tekken8", memberEmails: TEKKEN_EMAILS.slice(2, 4) },
  { name: "QA Control FC Alpha", tag: "QFA", game: "fc26", memberEmails: FC_EMAILS.slice(0, 2) },
  { name: "QA Control FC Bravo", tag: "QFB", game: "fc26", memberEmails: FC_EMAILS.slice(2, 4) },
] as const;

async function upsertExactTeam(ctx: any, spec: TeamSpec, usersByEmail: Map<string, Doc<"users">>) {
  const members = spec.memberEmails.map((email) => {
    const user = usersByEmail.get(email);
    if (!user) throw new Error(`Team fixture is missing ${email}`);
    return user;
  });
  const captain = members[0];
  const now = Date.now();
  const existing = await ctx.db
    .query("teams")
    .withIndex("by_nameLower", (q: any) => q.eq("nameLower", spec.name.toLowerCase()))
    .unique();
  const teamValues = {
    name: spec.name,
    nameLower: spec.name.toLowerCase(),
    tag: spec.tag,
    game: spec.game,
    captainUid: captain._id,
    captainUsername: captain.username,
    memberUids: members.map((user) => String(user._id)),
    memberCount: members.length,
    maxMembers: members.length,
    mainRosterSize: members.length,
    maxSubstitutes: 0,
    description: "Deterministic QA team. Safe to reset before a manual test cycle.",
    stats: { wins: 0, losses: 0, matchesPlayed: 0 },
    status: "active" as const,
    deletedAt: undefined,
    deletedByUid: undefined,
    updatedAt: now,
  };
  const teamId: Id<"teams"> = existing
    ? existing._id
    : await ctx.db.insert("teams", { ...teamValues, createdAt: now });
  if (existing) await ctx.db.patch(existing._id, teamValues);

  const existingMembers = await ctx.db
    .query("teamMembers")
    .withIndex("by_teamId", (q: any) => q.eq("teamId", teamId))
    .take(20);
  for (const row of existingMembers) await ctx.db.delete(row._id);
  for (let index = 0; index < members.length; index += 1) {
    const member = members[index];
    await ctx.db.insert("teamMembers", {
      teamId,
      odxerId: member._id,
      username: member.username,
      role: index === 0 ? "captain" : "member",
      rosterRole: "main",
      rosterOrder: index,
      joinedAt: now,
    });
  }
  return teamId;
}

export const prepareRelationships = internalMutation({
  args: { seedKey: v.string() },
  returns: v.object({ teams: v.number(), readyZone: v.string(), incompleteZone: v.string() }),
  handler: async (ctx, args) => {
    requireSeedKey(args.seedKey);
    const usersByEmail = new Map<string, Doc<"users">>();
    for (const email of CONTROL_EMAILS) usersByEmail.set(email, await getUserByEmail(ctx, email));

    for (const spec of TEAM_SPECS) await upsertExactTeam(ctx, spec, usersByEmail);

    const readyAdmin = usersByEmail.get(READY_ZONE_ADMIN_EMAIL)!;
    const incompleteAdmin = usersByEmail.get(INCOMPLETE_ZONE_ADMIN_EMAIL)!;
    const readyZone = await ctx.db
      .query("zones")
      .withIndex("by_ownerUid", (q) => q.eq("ownerUid", readyAdmin._id))
      .unique();
    const incompleteZone = await ctx.db
      .query("zones")
      .withIndex("by_ownerUid", (q) => q.eq("ownerUid", incompleteAdmin._id))
      .unique();
    if (!readyZone || !incompleteZone) throw new Error("Required QA control zone is missing.");

    const now = Date.now();
    const readyBranches = (readyZone.branches || []).map((branch: any) => ({
      ...branch,
      operatingHours: branch?.operatingHours || createDefaultBranchOperatingHours(),
    }));
    const incompleteBranches = (incompleteZone.branches || []).map((branch: any) => {
      const { operatingHours: _removed, ...rest } = branch || {};
      return rest;
    });
    await ctx.db.patch(readyZone._id, { status: "active", branches: readyBranches, updatedAt: now });
    await ctx.db.patch(incompleteZone._id, { status: "active", branches: incompleteBranches, updatedAt: now });

    return {
      teams: TEAM_SPECS.length,
      readyZone: String(readyZone._id),
      incompleteZone: String(incompleteZone._id),
    };
  },
});

export const cleanupLegacyScenarioNoise = internalMutation({
  args: { seedKey: v.string() },
  returns: v.object({
    matchrooms: v.number(),
    notifications: v.number(),
    teams: v.number(),
    teamMembers: v.number(),
    skippedTeamsWithChallenges: v.number(),
  }),
  handler: async (ctx, args) => {
    requireSeedKey(args.seedKey);
    let matchroomCount = 0;
    let notificationCount = 0;
    let teamCount = 0;
    let teamMemberCount = 0;
    let skippedTeamsWithChallenges = 0;

    const rooms = await ctx.db.query("matchrooms").withIndex("by_createdAt").take(200);
    for (const room of rooms) {
      if (room.bookingSource !== "seed") continue;
      const host = await ctx.db.get(room.hostUid as Id<"users">).catch(() => null);
      if (!host?.email?.startsWith("demo.player")) continue;
      const notifications = await ctx.db
        .query("notifications")
        .withIndex("by_matchroomId", (q) => q.eq("matchroomId", room._id))
        .take(500);
      for (const notification of notifications) {
        await ctx.db.delete(notification._id);
        notificationCount += 1;
      }
      const members = await ctx.db
        .query("matchroomMembers")
        .withIndex("by_matchroomId", (q) => q.eq("matchroomId", room._id))
        .take(20);
      for (const member of members) await ctx.db.delete(member._id);
      if (room.lifecycleScheduledFnId) {
        try {
          await ctx.scheduler.cancel(room.lifecycleScheduledFnId as any);
        } catch {
          // The job may already have completed or been cancelled; deleting the
          // stale room remains safe and the lifecycle handler is idempotent.
        }
      }
      await ctx.db.delete(room._id);
      matchroomCount += 1;
    }

    const teams = await ctx.db.query("teams").take(100);
    for (const team of teams) {
      if (team.name.startsWith(QA_TEAM_PREFIX)) continue;
      const captain = await ctx.db.get(team.captainUid);
      if (!captain?.email?.startsWith("demo.player")) continue;
      const linkedA = await ctx.db
        .query("teamChallenges")
        .withIndex("by_challengerTeamId", (q) => q.eq("challengerTeamId", team._id))
        .first();
      const linkedB = await ctx.db
        .query("teamChallenges")
        .withIndex("by_opponentTeamId", (q) => q.eq("opponentTeamId", team._id))
        .first();
      if (linkedA || linkedB) {
        skippedTeamsWithChallenges += 1;
        continue;
      }
      const members = await ctx.db
        .query("teamMembers")
        .withIndex("by_teamId", (q) => q.eq("teamId", team._id))
        .take(20);
      for (const member of members) {
        await ctx.db.delete(member._id);
        teamMemberCount += 1;
      }
      await ctx.db.delete(team._id);
      teamCount += 1;
    }

    return {
      matchrooms: matchroomCount,
      notifications: notificationCount,
      teams: teamCount,
      teamMembers: teamMemberCount,
      skippedTeamsWithChallenges,
    };
  },
});

const accountResultValidator = v.object({ email: v.string(), kind: v.string(), userId: v.string() });

type CleanupResult = {
  matchrooms: number;
  notifications: number;
  teams: number;
  teamMembers: number;
  skippedTeamsWithChallenges: number;
};

type PrepareResult = {
  accounts: Array<{ email: string; kind: string; userId: string }>;
  teams: number;
  readyZone: string;
  incompleteZone: string;
  cleanup: CleanupResult | null;
};

export const prepareQaControlPack = action({
  args: { seedKey: v.string(), cleanLegacyNoise: v.optional(v.boolean()) },
  returns: v.object({
    accounts: v.array(accountResultValidator),
    teams: v.number(),
    readyZone: v.string(),
    incompleteZone: v.string(),
    cleanup: v.union(
      v.null(),
      v.object({
        matchrooms: v.number(),
        notifications: v.number(),
        teams: v.number(),
        teamMembers: v.number(),
        skippedTeamsWithChallenges: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args): Promise<PrepareResult> => {
    requireSeedKey(args.seedKey);
    const qaInternal: any = (internal as any).qaControlSeed;
    const cleanup: CleanupResult | null = args.cleanLegacyNoise
      ? await ctx.runMutation(qaInternal.cleanupLegacyScenarioNoise, { seedKey: args.seedKey })
      : null;
    const accounts: PrepareResult["accounts"] = [];
    for (const email of CONTROL_EMAILS) {
      const result: { email: string; kind: string; userId: string } = await ctx.runMutation(
        qaInternal.prepareAccount,
        { seedKey: args.seedKey, email },
      );
      accounts.push(result);
    }
    const relationships: { teams: number; readyZone: string; incompleteZone: string } = await ctx.runMutation(
      qaInternal.prepareRelationships,
      { seedKey: args.seedKey },
    );
    return { accounts, ...relationships, cleanup };
  },
});
