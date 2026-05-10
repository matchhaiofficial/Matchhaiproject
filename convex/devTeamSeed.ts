import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { api, components } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { hashPassword } from "better-auth/crypto";

function requireSeedKey(seedKey: string) {
  const expected = process.env.DEMO_SEED_KEY;
  if (!expected) throw new Error("DEMO_SEED_KEY is not configured.");
  if (seedKey !== expected) throw new Error("Invalid seedKey.");
}

const DEMO_DOMAIN = "@matchhai.demo";
const DEFAULT_DEMO_PASSWORD = "MatchHaiDemo123!";
const MAX_USERNAME_LEN = 24;

function toUsernameSeed(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20) || "demo_player";
}

function randomTag(rand: () => number) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const pick = () => letters[Math.floor(rand() * letters.length)] || "X";
  return `${pick()}${pick()}${pick()}`.slice(0, 5);
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function doesUserPlayGamePatch(gameKey: string) {
  const g = String(gameKey || "").toLowerCase();
  if (g === "cs2") return { playsCs2: true };
  if (g === "cs16") return { playsCs16: true };
  if (g === "valorant") return { playsValorant: true };
  if (g === "fc25" || g === "fc26") return { playsFc: true };
  if (g === "tekken8") return { playsTekken: true };
  if (g === "futsal") return { playsFutsal: true };
  if (g === "indoor_cricket") return { playsIndoorCricket: true };
  if (g === "padel") return { playsPadel: true };
  if (g === "pickleball") return { playsPickleball: true };
  return {};
}

function hashString(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function demoPhoneForEmail(email: string) {
  // Better Auth enforces unique phone numbers. Use a deterministic, demo-safe number.
  const digits = String(Math.abs(hashString(String(email || "").toLowerCase())) % 1_000_000_000).padStart(9, "0");
  return `03${digits}`.slice(0, 11);
}

async function ensureBetterAuthUser(ctx: any, input: { email: string; name: string; username: string; phone: string; forceCredentialPassword?: boolean }) {
  const existing = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "email", operator: "eq", value: input.email }],
  });

  if (existing) {
    const id = String((existing as any).id || (existing as any)._id || "");
    if (!id) throw new Error("Found Better Auth user but could not resolve id.");
    const username =
      String((existing as any).username || (existing as any).displayUsername || input.username || "").slice(0, MAX_USERNAME_LEN) ||
      input.username;

    // Ensure credential account exists and (optionally) force-reset its password for demo seeding.
    const now = Date.now();
    const passwordHash = await hashPassword(DEFAULT_DEMO_PASSWORD);
    const existingAccount = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "userId", operator: "eq", value: id },
        { connector: "AND", field: "providerId", operator: "eq", value: "credential" },
      ],
    });

    if (existingAccount && input.forceCredentialPassword) {
      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        model: "account",
        where: [
          { field: "userId", operator: "eq", value: id },
          { connector: "AND", field: "providerId", operator: "eq", value: "credential" },
        ],
      });
    }

    if (!existingAccount || input.forceCredentialPassword) {
      await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "account",
          data: {
            accountId: id,
            providerId: "credential",
            password: passwordHash,
            userId: id,
            createdAt: now,
            updatedAt: now,
          },
        },
      });
    }
    return { authUserId: id, username };
  }

  const now = Date.now();
  const local = toUsernameSeed(String(input.email || "").split("@")[0] || "demo");
  const suffix = local.slice(-3) || String(Math.abs(hashString(local)) % 1000).padStart(3, "0");
  const trim = (value: string) => (value || "").slice(0, MAX_USERNAME_LEN) || `demo_${suffix}`;
  const candidates = Array.from(new Set([trim(input.username), trim(`${input.username}_${suffix}`), trim(local)]));

  let created: any = null;
  let usernameUsed = candidates[0] || trim(input.username);
  for (const candidate of candidates) {
    try {
      usernameUsed = candidate;
      created = await ctx.runMutation(components.betterAuth.adapter.create, {
        input: {
          model: "user",
          data: {
            email: input.email,
            name: input.name,
            emailVerified: true,
            username: candidate,
            displayUsername: candidate,
            phoneNumber: input.phone,
            phoneNumberVerified: false,
            image: null,
            isAnonymous: false,
            twoFactorEnabled: false,
            createdAt: now,
            updatedAt: now,
            userId: null,
          },
        },
      });
      break;
    } catch (err: any) {
      const msg = String(err?.message || err || "").toLowerCase();
      if (msg.includes("username already exists")) continue;
      throw err;
    }
  }

  if (!created) throw new Error("Failed to create Better Auth user (username collisions).");

  const authUserId = String((created as any).id || (created as any)?._id || "");
  if (!authUserId) throw new Error("Failed to create Better Auth user.");

  const passwordHash = await hashPassword(DEFAULT_DEMO_PASSWORD);
  const existingAccount = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "account",
    where: [
      { field: "userId", operator: "eq", value: authUserId },
      { connector: "AND", field: "providerId", operator: "eq", value: "credential" },
    ],
  });

  if (!existingAccount) {
    await ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "account",
        data: {
          accountId: authUserId,
          providerId: "credential",
          password: passwordHash,
          userId: authUserId,
          createdAt: now,
          updatedAt: now,
        },
      },
    });
  }

  return { authUserId, username: usernameUsed };
}

function getRosterRule(gameKey: string) {
  const game = String(gameKey || "").toLowerCase();
  if (game === "cs2" || game === "cs16" || game === "valorant") return { mainSize: 5, maxSubstitutes: 0 };
  if (game === "fc25" || game === "fc26" || game === "tekken8") return { mainSize: 2, maxSubstitutes: 0 };
  // Default to 5 so challenges are meaningful.
  return { mainSize: 5, maxSubstitutes: 0 };
}

async function findUserByEmail(ctx: any, email: string) {
  return (await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .unique()) as Doc<"users"> | null;
}

async function findTeamByNameAndGame(ctx: any, name: string, game: string) {
  const row = (await ctx.db
    .query("teams")
    .withIndex("by_nameLower", (q: any) => q.eq("nameLower", name.toLowerCase()))
    .unique()) as Doc<"teams"> | null;
  if (!row) return null;
  if (String(row.game || "").toLowerCase() !== String(game || "").toLowerCase()) return null;
  if (row.status === "deleted" || Boolean(row.deletedAt)) return null;
  return row;
}

async function ensureDemoPlayersForGame(ctx: any, args: {
  seedKey: string;
  game: string;
  count: number;
  emailPrefix: string;
  withBetterAuth?: boolean;
}) {
  requireSeedKey(args.seedKey);
  const game = String(args.game || "").toLowerCase();
  const count = Math.max(1, Math.min(60, Math.floor(args.count)));
  const withBetterAuth = Boolean(args.withBetterAuth);
  const created: Array<{ userId: Id<"users">; username: string; email: string }> = [];

  for (let i = 1; i <= count; i += 1) {
    const email = `${args.emailPrefix}_${game}_${i}${DEMO_DOMAIN}`.toLowerCase();

    const existing = await findUserByEmail(ctx, email);
    if (existing) {
      created.push({ userId: existing._id, username: existing.username, email: existing.email });
      continue;
    }

    const base = toUsernameSeed(`${args.emailPrefix}_${game}_${i}`);
    const preferredUsername = `${base}_${String(i)}`.slice(0, MAX_USERNAME_LEN);
    let authId: string | null = null;
    let username = preferredUsername || base;

    if (withBetterAuth) {
      const auth = await ensureBetterAuthUser(ctx, {
        email,
        name: `Demo Player ${i}`,
        username: preferredUsername || base,
        phone: demoPhoneForEmail(email),
        forceCredentialPassword: true,
      });
      authId = auth.authUserId;
      username = String(auth.username || preferredUsername || base);
    }

    username = String(username).slice(0, MAX_USERNAME_LEN);
    const now = Date.now();

    const userId = await ctx.db.insert("users", {
      email,
      fullName: `Demo Player ${i}`,
      username,
      usernameLower: username.toLowerCase(),
      authId: authId || undefined,
      accountType: "player",
      isOnline: false,
      isVerified: true,
      walletBalance: 0,
      ...doesUserPlayGamePatch(game),
      createdAt: now,
      updatedAt: now,
    });

    created.push({ userId, username, email });
  }

  return { ok: true, players: created, passwordHint: DEFAULT_DEMO_PASSWORD };
}

async function fillTeamToCapacity(ctx: any, seedKey: string, teamId: Id<"teams">, candidates: Array<{ userId: Id<"users">; username: string }>) {
  requireSeedKey(seedKey);
  const team = await ctx.db.get(teamId);
  if (!team) throw new Error("Team not found");
  const capacity = Number(team.maxMembers || 0) > 0 ? Number(team.maxMembers) : Number(team.memberCount || 0);
  const missing = Math.max(0, capacity - Number(team.memberCount || 0));
  let added = 0;

  for (const candidate of candidates) {
    if (added >= missing) break;
    try {
      await ctx.runMutation(api.teams.addMember, {
        teamId,
        userId: candidate.userId,
        username: candidate.username,
      });
      added += 1;
    } catch {
      // Ignore duplicates / validation failures.
    }
  }

  const refreshed = await ctx.db.get(teamId);
  return { ok: true, added, memberCount: Number(refreshed?.memberCount || team.memberCount || 0), maxMembers: capacity };
}

export const seedChallengeTeamsForUser = mutation({
  args: {
    seedKey: v.string(),
    userEmail: v.string(),
    ensureCaptainTeams: v.optional(v.array(v.string())),
    opponentTeamCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireSeedKey(args.seedKey);
    const userEmail = String(args.userEmail || "").trim().toLowerCase();
    const user = await findUserByEmail(ctx, userEmail);
    if (!user) throw new Error(`User not found for email: ${userEmail}`);

    const ensureCaptainTeams = (args.ensureCaptainTeams || ["valorant", "cs16", "tekken8"]).map((g) => String(g).toLowerCase());
    const opponentTeamCount = Math.max(0, Math.min(40, Math.floor(args.opponentTeamCount ?? 20)));

    const createdCaptainTeams: Array<{ teamId: string; name: string; game: string }> = [];
    const filledTeams: Array<{ teamId: string; name: string; game: string; added: number; memberCount: number; maxMembers: number }> = [];

    // Ensure captain has teams for requested games.
    for (const game of ensureCaptainTeams) {
      const existing = await ctx.db
        .query("teams")
        .withIndex("by_captainUid", (q: any) => q.eq("captainUid", user._id))
        .collect();
      const already = existing.find((t: any) => String(t.game || "").toLowerCase() === game && t.status !== "deleted" && !t.deletedAt);
      if (already) continue;

      const rand = mulberry32(880000 + game.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
      const name = `${game.toUpperCase()} ${randomTag(rand)} Squad`;
      const teamId = await ctx.runMutation(api.teams.create, {
        name,
        tag: randomTag(rand),
        game,
        captainUid: user._id,
        captainUsername: user.username,
        // Use roster rule defaults by omitting maxMembers/mainRosterSize/maxSubstitutes.
        description: "Seeded team for challenge testing.",
      });
      createdCaptainTeams.push({ teamId: String(teamId), name, game });
    }

    // Fill all captain teams for the requested games to capacity.
    const captainTeams = await ctx.db
      .query("teams")
      .withIndex("by_captainUid", (q: any) => q.eq("captainUid", user._id))
      .collect();
    const activeCaptainTeams = captainTeams.filter((t: any) => t && t.status !== "deleted" && !t.deletedAt);
    const desiredGames = new Set(ensureCaptainTeams);
    for (const team of activeCaptainTeams) {
      const game = String(team.game || "").toLowerCase();
      if (!desiredGames.has(game)) continue;

      // Some older teams were created with incorrect caps. Normalize to roster rules for this seed run.
      const rule = getRosterRule(game);
      const desiredMain = rule.mainSize;
      const desiredSubs = rule.maxSubstitutes;
      const desiredMax = desiredMain + desiredSubs;
      const currentMax = Number(team.maxMembers || 0);
      const currentMain = Number(team.mainRosterSize || 0);
      const currentSubs = Number(team.maxSubstitutes || 0);
      if (!Number.isFinite(currentMain) || currentMain < desiredMain || !Number.isFinite(currentMax) || currentMax < desiredMax) {
        await ctx.db.patch(team._id, {
          mainRosterSize: desiredMain,
          maxSubstitutes: desiredSubs,
          maxMembers: desiredMax,
          updatedAt: Date.now(),
        });
      }

      const demoPlayers = await ensureDemoPlayersForGame(ctx, {
        seedKey: args.seedKey,
        game,
        count: 50,
        emailPrefix: "captain_fill",
        withBetterAuth: false,
      });
      const fill = await fillTeamToCapacity(
        ctx,
        args.seedKey,
        team._id,
        demoPlayers.players.map((p) => ({ userId: p.userId, username: p.username })),
      );
      filledTeams.push({ teamId: String(team._id), name: team.name, game: team.game, ...fill });
    }

    // Create opponent teams with full rosters for challenge testing.
    const opponentGames = [
      "cs2",
      "fc26",
      "valorant",
      "cs16",
      "tekken8",
      "futsal",
      "indoor_cricket",
      "padel",
      "pickleball",
    ];
    const opponentTeams: Array<{ teamId: string; name: string; game: string; memberCount: number; maxMembers: number }> = [];

    const rand = mulberry32(990123);
    for (let i = 1; i <= opponentTeamCount; i += 1) {
      const game = opponentGames[i % opponentGames.length]!;
      const name = `Opponent ${game.toUpperCase()} Team ${i}`;
      const existing = await ctx.db
        .query("teams")
        .withIndex("by_nameLower", (q: any) => q.eq("nameLower", name.toLowerCase()))
        .unique();
      if (existing) continue;

      // Create a demo captain and team.
      const demoCaptain = await ensureDemoPlayersForGame(ctx, {
        seedKey: args.seedKey,
        game,
        count: 1,
        emailPrefix: `opp_captain_${i}`,
        withBetterAuth: false,
      });
      const captain = demoCaptain.players[0]!;

      const teamId = await ctx.runMutation(api.teams.create, {
        name,
        tag: `OPP${String(i).padStart(2, "0")}`.slice(0, 5),
        game,
        captainUid: captain.userId,
        captainUsername: captain.username,
        description: "Seeded opponent team for challenge testing.",
      });

      // Fill to capacity with demo players.
      const morePlayers = await ensureDemoPlayersForGame(ctx, {
        seedKey: args.seedKey,
        game,
        count: 20,
        emailPrefix: `opp_${i}`,
        withBetterAuth: false,
      });
      const fill = await fillTeamToCapacity(
        ctx,
        args.seedKey,
        teamId as Id<"teams">,
        morePlayers.players.map((p) => ({ userId: p.userId, username: p.username })),
      );

      opponentTeams.push({
        teamId: String(teamId),
        name,
        game,
        memberCount: fill.memberCount,
        maxMembers: fill.maxMembers,
      });
    }

    return {
      ok: true,
      userId: String(user._id),
      createdCaptainTeams,
      filledCaptainTeams: filledTeams,
      opponentTeamsCreated: opponentTeams.length,
      opponentTeams: opponentTeams.slice(0, 10),
    };
  },
});

export const seedExtraFc26CaptainTeam = mutation({
  args: {
    seedKey: v.string(),
    label: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireSeedKey(args.seedKey);
    const label = toUsernameSeed(String(args.label || "extra"));
    const game = "fc26";

    const captainEmailPrefix = `demo_fc26_captain_${label}`.slice(0, 40);
    const captainResult = await ensureDemoPlayersForGame(ctx, {
      seedKey: args.seedKey,
      game,
      count: 1,
      emailPrefix: captainEmailPrefix,
      withBetterAuth: true,
    });
    const captain = captainResult.players[0]!;

    const teamName = `FC26 Demo Team ${label}`.replace(/_/g, " ").trim();
    const existingTeam = await findTeamByNameAndGame(ctx, teamName, game);
    let teamId: Id<"teams">;
    if (existingTeam) {
      teamId = existingTeam._id;
    } else {
      const rand = mulberry32(770000 + label.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
      const rule = getRosterRule(game);
      teamId = await ctx.runMutation(api.teams.create, {
        name: teamName,
        tag: `F26${randomTag(rand)}`.slice(0, 5),
        game,
        captainUid: captain.userId,
        captainUsername: captain.username,
        mainRosterSize: rule.mainSize,
        maxSubstitutes: rule.maxSubstitutes,
        maxMembers: rule.mainSize + rule.maxSubstitutes,
        description: "Seeded FC26 team for challenge testing.",
      });
    }

    const demoFill = await ensureDemoPlayersForGame(ctx, {
      seedKey: args.seedKey,
      game,
      count: 20,
      emailPrefix: `demo_fc26_${label}`.slice(0, 40),
      withBetterAuth: false,
    });
    const fill = await fillTeamToCapacity(
      ctx,
      args.seedKey,
      teamId,
      demoFill.players.map((p) => ({ userId: p.userId, username: p.username })),
    );

    return {
      ok: true,
      captain: { userId: String(captain.userId), username: captain.username, email: captain.email },
      team: { teamId: String(teamId), name: teamName, game, memberCount: fill.memberCount, maxMembers: fill.maxMembers },
      passwordHint: "Uses DEFAULT_DEMO_PASSWORD in convex/devTeamSeed.ts (do not share passwords in chat).",
    };
  },
});
