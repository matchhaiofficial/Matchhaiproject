import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { api, components } from "./_generated/api";
import { hashPassword } from "better-auth/crypto";
import type { Doc, Id } from "./_generated/dataModel";

const DEMO_DOMAIN = "@matchhai.demo";
const DEMO_PASSWORD = "MatchHaiDemo123!";
const KARACHI_REALISTIC_SEED_SOURCE = "karachi_realistic_demo_2026";
const KARACHI_REALISTIC_PASSWORD = "Demo@123456";
const KARACHI_REALISTIC_EMAIL_DOMAIN = "@matchhai.demo";
const DEFAULT_CURRENCY = "PKR";
const MAX_USERNAME_LEN = 24;
const DEFAULT_PLAYER_COUNT = 200;
const DEFAULT_ZONE_COUNT = 200;
const DEFAULT_TEAM_COUNT = 200;
const DEFAULT_MATCHROOM_COUNT = 200;

type DemoExport = {
  password: string;
  superAdmin: { email: string; username: string } | null;
  players: Array<{
    userId: string;
    authId: string | null;
    email: string;
    fullName: string;
    username: string;
    games: string[];
    skillScores: any;
    steamProfileUrl?: string;
    faceitProfileUrl?: string;
    friendCount: number;
  }>;
  zoneAdmins: Array<{
    userId: string;
    authId: string | null;
    email: string;
    fullName: string;
    username: string;
    zoneId: string | null;
    venueBrandName: string | null;
    city: string | null;
    branches: any[];
    games: any;
  }>;
  teams: Array<{
    teamId: string;
    name: string;
    tag?: string;
    game: string;
    captainUid: string;
    captainUsername?: string;
    memberCount: number;
    maxMembers: number;
    memberUids: string[];
  }>;
  matchrooms: Array<{
    matchroomId: string;
    matchCode: string | null;
    title: string;
    game: string;
    hostUid: string;
    hostName: string;
    zoneId?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    scheduledStartAt?: number;
    maxPlayers: number;
    currentPlayers: number;
    pricing: { perPlayer: number; currency: string };
  }>;
};

function requireSeedKey(seedKey: string) {
  if (String(process.env.DEMO_SEED_ENABLED || "").trim() !== "true") {
    throw new Error("Demo seed is disabled. Set DEMO_SEED_ENABLED=true in the Convex environment to enable seeding.");
  }
  const expected = process.env.DEMO_SEED_KEY;
  if (!expected) {
    throw new Error("DEMO_SEED_KEY is not configured in the Convex environment.");
  }
  if (seedKey !== expected) {
    throw new Error("Invalid seedKey.");
  }
}

// NOTE: This module is intentionally self-contained (no client imports).
// It seeds demo data using real Convex mutations where possible and can also remove it safely.

const DEFAULT_COUNTRY_CODE = "PK";

const CITIES = ["Karachi"];

const AREAS_BY_CITY: Record<string, string[]> = {
  Karachi: ["Gulshan-e-Iqbal", "DHA Phase 6", "Clifton", "Johar", "North Nazimabad", "Bahadurabad"],
};

const MALE_FIRST_NAMES = [
  "Muhammad",
  "Ahmed",
  "Ali",
  "Usman",
  "Hamza",
  "Bilal",
  "Hassan",
  "Hussain",
  "Ahsan",
  "Fahad",
  "Saad",
  "Zain",
  "Umer",
  "Farhan",
  "Imran",
  "Shahzaib",
  "Abdullah",
  "Ammar",
  "Rafay",
  "Talha",
  "Rizwan",
  "Arsalan",
];

const FEMALE_FIRST_NAMES = [
  "Ayesha",
  "Fatima",
  "Hira",
  "Sana",
  "Iqra",
  "Mariam",
  "Zainab",
  "Noor",
  "Laiba",
  "Mehak",
  "Eman",
  "Sara",
  "Anam",
  "Mahnoor",
  "Areeba",
  "Komal",
];

const LAST_NAMES = [
  "Khan",
  "Malik",
  "Sheikh",
  "Raza",
  "Qureshi",
  "Chaudhry",
  "Butt",
  "Hussain",
  "Farooq",
  "Nawaz",
  "Javed",
  "Abbasi",
  "Akhtar",
  "Siddiqui",
  "Ansari",
  "Mughal",
  "Awan",
];

const TEAM_MASCOTS = [
  "Falcons",
  "Vipers",
  "Titans",
  "Wolves",
  "Rangers",
  "Panthers",
  "Dragons",
  "Eagles",
  "Lions",
  "Sharks",
  "Warriors",
  "Phoenix",
  "Royals",
  "Blazers",
];

const GAME_KEYS = [
  "cs2",
  "valorant",
  "fc26",
  "tekken8",
  "futsal",
  "indoor_cricket",
  "padel",
  "pickleball",
] as const;

function to2(n: number) {
  return String(n).padStart(2, "0");
}

function to3(n: number) {
  return String(n).padStart(3, "0");
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, items: T[]) {
  return items[Math.floor(rand() * items.length)];
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function tierFromRating(rating: number) {
  if (rating <= 30) return "Beginner";
  if (rating <= 50) return "Casual";
  if (rating <= 70) return "Intermediate";
  if (rating <= 85) return "Advanced";
  if (rating <= 95) return "Pro";
  return "Elite";
}

function normalizeUsername(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

function buildEmail(kind: "player" | "zone" | "super", i: number) {
  if (kind === "super") return `demo.superadmin${DEMO_DOMAIN}`;
  const prefix = kind === "player" ? "demo.player" : "demo.zone";
  return `${prefix}${to3(i)}${DEMO_DOMAIN}`;
}

function buildPhone(i: number) {
  const rand = mulberry32(40000 + i);
  const prefix = 300 + Math.floor(rand() * 90);
  const line = 1000000 + Math.floor(rand() * 8999999);
  return `+92${prefix}${line}`;
}

function buildPlayerName(i: number) {
  const rand = mulberry32(9000 + i);
  const isFemale = rand() < 0.28;
  const first = isFemale ? pick(rand, FEMALE_FIRST_NAMES) : pick(rand, MALE_FIRST_NAMES);
  const last = pick(rand, LAST_NAMES);
  if (!isFemale && rand() < 0.55) {
    const middle = pick(rand, MALE_FIRST_NAMES.filter((n) => n !== first));
    return `${first} ${middle} ${last}`;
  }
  return `${first} ${last}`;
}

function buildZoneAdminName(i: number) {
  const rand = mulberry32(12000 + i);
  const first = pick(rand, MALE_FIRST_NAMES);
  const middle = pick(rand, MALE_FIRST_NAMES.filter((n) => n !== first));
  const last = pick(rand, LAST_NAMES);
  return `${first} ${middle} ${last}`;
}

function buildUsernameFromName(fullName: string, city: string, i: number) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/g)
    .filter(Boolean);
  const first = parts[0] || "demo";
  const last = parts.length > 1 ? parts[parts.length - 1] : "user";

  const firstPart = normalizeUsername(first).slice(0, 6) || "demo";
  const lastPart = normalizeUsername(last).slice(0, 6) || "user";

  const cityNorm = normalizeUsername(city);
  const cityTag = cityNorm.startsWith("kar") ? "khi" : cityNorm.slice(0, 3) || "khi";
  const suffix = String(i).padStart(3, "0").slice(-3);

  return `${firstPart}_${lastPart}_${cityTag}${suffix}`.slice(0, MAX_USERNAME_LEN);
}

function pickGamesForPlayer(i: number) {
  const rand = mulberry32(50000 + i);
  const baseCount = rand() < 0.5 ? 1 : rand() < 0.85 ? 2 : 3;
  const preferred: string[] = [];
  const shuffled = [...GAME_KEYS].sort(() => rand() - 0.5);
  for (const game of shuffled) {
    if (preferred.length >= baseCount) break;
    preferred.push(game);
  }

  // Ensure most players can host/join venue matchrooms (cs2 is the most broadly supported venue title).
  if (!preferred.includes("cs2")) {
    preferred.unshift("cs2");
  }

  const unique = Array.from(new Set(preferred));
  return unique.slice(0, 3);
}

function buildPlayerFlags(games: string[]) {
  const flags: Record<string, boolean> = {};
  for (const g of games) {
    if (g === "cs2") flags.playsCs2 = true;
    if (g === "cs16") flags.playsCs16 = true;
    if (g === "valorant") flags.playsValorant = true;
    if (g === "fc26") flags.playsFc = true;
    if (g === "tekken8") flags.playsTekken = true;
    if (g === "futsal") flags.playsFutsal = true;
    if (g === "indoor_cricket") flags.playsIndoorCricket = true;
    if (g === "padel") flags.playsPadel = true;
    if (g === "pickleball") flags.playsPickleball = true;
  }
  return flags;
}

function buildSkillScore(rand: () => number, initialSource: "steam" | "faceit" | "questionnaire") {
  const rating = clamp(Math.round(25 + rand() * 70), 0, 100);
  const matchesPlayed = Math.round(rand() * 40);
  const wins = Math.round(matchesPlayed * (0.35 + rand() * 0.4));
  const losses = Math.max(0, matchesPlayed - wins);
  const now = Date.now();
  return {
    rating,
    tier: tierFromRating(rating),
    matchesPlayed,
    wins,
    losses,
    initialSource,
    initialRating: rating,
    lastMatchDate: matchesPlayed > 0 ? now - Math.round(rand() * 60) * 24 * 60 * 60 * 1000 : null,
    lastUpdated: now,
  };
}

function buildSkillScoresForGames(i: number, games: string[]) {
  const rand = mulberry32(90000 + i);
  const scores: Record<string, any> = {};
  for (const game of games) {
    const source = game === "cs2" ? "steam" : game === "valorant" ? "faceit" : "questionnaire";
    const skill = buildSkillScore(rand, source as any);
    if (game === "fc26") {
      scores.fc26 = skill;
      scores.fc25 = skill;
    } else {
      scores[game] = skill;
    }
  }
  return scores;
}

function buildSteamProfile(i: number, fullName: string) {
  const rand = mulberry32(60000 + i);
  const steamId = `7656119${String(100000000 + i).padStart(9, "0")}`;
  const personaName = `${fullName.split(" ")[0]}_${Math.floor(rand() * 9000 + 1000)}`;
  const cs2Hours = Math.round(rand() * 2200);
  return {
    steamId,
    personaName,
    avatarUrl: `https://avatars.steamstatic.com/demo_${to3(i)}.jpg`,
    countryCode: DEFAULT_COUNTRY_CODE,
    cs2Hours,
    stats: {
      totalKills: Math.round(rand() * 12000),
      totalDeaths: Math.round(rand() * 11000),
      totalWins: Math.round(rand() * 1800),
      totalDamage: Math.round(rand() * 950000),
      kdRatio: String((0.6 + rand() * 1.8).toFixed(2)),
    },
  };
}

function buildFaceitProfile(i: number, fullName: string) {
  const rand = mulberry32(70000 + i);
  const nickname = `${normalizeUsername(fullName.split(" ")[0])}${Math.floor(rand() * 900 + 100)}`;
  return {
    faceitId: `faceit_demo_${to3(i)}`,
    nickname,
    game: rand() < 0.7 ? "cs2" : "valorant",
    elo: Math.round(800 + rand() * 1400),
    skillLevel: clamp(Math.round(1 + rand() * 9), 1, 10),
    country: DEFAULT_COUNTRY_CODE,
    avatarUrl: `https://faceit-cdn.demo/avatar_${to3(i)}.png`,
  };
}

function doesUserPlayGameFromRecord(user: any, game: string) {
  switch (game) {
    case "cs2":
      return !!user?.playsCs2;
    case "cs16":
      return !!user?.playsCs16;
    case "valorant":
      return !!user?.playsValorant;
    case "fc25":
    case "fc26":
      return !!user?.playsFc;
    case "tekken8":
      return !!user?.playsTekken;
    case "futsal":
      return !!user?.playsFutsal;
    case "indoor_cricket":
      return !!user?.playsIndoorCricket;
    case "padel":
      return !!user?.playsPadel;
    case "pickleball":
      return !!user?.playsPickleball;
    default:
      return false;
  }
}

type DemoZoneProfile = "gaming" | "sports" | "hybrid";

function zoneProfileForIndex(i: number): DemoZoneProfile {
  if (i % 10 === 0 || i % 10 === 5) return "hybrid";
  if (i % 3 === 0) return "sports";
  return "gaming";
}

function buildZoneBranch(i: number, branchIndex: number, city: string, profile: DemoZoneProfile) {
  const rand = mulberry32(80000 + i * 10 + branchIndex);
  const areas = AREAS_BY_CITY[city] || ["Central"];
  const areaLabel = pick(rand, areas);
  const branchDisplayName = branchIndex === 0 ? "Main Branch" : `Branch ${branchIndex + 1}`;
  const addressLine1 = `${Math.floor(rand() * 90 + 10)} ${areaLabel}, ${city}`;
  const googleMapsUrl = `https://maps.google.com/?q=${encodeURIComponent(addressLine1)}`;

  const supportsCs2 = profile !== "sports";
  const supportsFc25 = profile === "gaming" ? rand() < 0.55 : profile === "hybrid" ? rand() < 0.35 : false;
  const supportsTekken8 = profile === "gaming" ? rand() < 0.45 : profile === "hybrid" ? rand() < 0.3 : false;
  const supportsFutsal = profile === "sports" ? rand() < 0.75 : profile === "hybrid" ? rand() < 0.45 : rand() < 0.15;
  const supportsIndoorCricket = profile === "sports" ? rand() < 0.55 : profile === "hybrid" ? rand() < 0.35 : rand() < 0.12;
  const supportsPadel = profile === "sports" ? rand() < 0.35 : profile === "hybrid" ? rand() < 0.25 : rand() < 0.08;
  const supportsPickleball = profile === "sports" ? rand() < 0.35 : profile === "hybrid" ? rand() < 0.25 : rand() < 0.08;

  // Keep resource counts intentionally small so seeding stays fast while still looking realistic.
  const pcRegularCount = supportsCs2 ? String(Math.floor(rand() * 5) + 6) : "0";
  const pcPremiumCount = supportsCs2 ? String(Math.floor(rand() * 3) + 2) : "0";
  const pcEliteCount = supportsCs2 ? String(Math.floor(rand() * 2) + 1) : "0";
  const regularPrice = String(Math.floor(rand() * 150) + 250);
  const premiumPrice = String(Math.floor(rand() * 200) + 350);
  const elitePrice = String(Math.floor(rand() * 250) + 450);

  const ps5Count = String(Math.floor(rand() * 2) + 1);
  const ps5Price1v1 = String(Math.floor(rand() * 200) + 600);
  const ps5Price2v2 = String(Math.floor(rand() * 250) + 850);

  const futsalCount = "1";
  const futsalPrice = String(Math.floor(rand() * 900) + 2500);

  const indoorNetCount = "1";
  const indoorPrice = String(Math.floor(rand() * 1100) + 3000);

  const padelCount = "1";
  const padelPrice = String(Math.floor(rand() * 1400) + 4000);

  const pickleCount = "1";
  const picklePrice = String(Math.floor(rand() * 1200) + 3500);

  const includeConsole = profile !== "sports" && rand() < 0.8;

  return {
    id: `b_${to3(i)}_${to2(branchIndex + 1)}`,
    branchDisplayName,
    city,
    areaLabel,
    addressLine1,
    googleMapsUrl,
    contactPhone: buildPhone(i * 3 + branchIndex),

    supportsCs2,
    supportsFc25,
    supportsTekken8,
    supportsFutsal,
    supportsIndoorCricket,
    supportsPadel,
    supportsPickleball,

    pricing: {
      pc: supportsCs2
        ? {
            regular: { count: pcRegularCount, price: regularPrice },
            premium: { count: pcPremiumCount, price: premiumPrice },
            elite: { count: pcEliteCount, price: elitePrice },
          }
        : undefined,
      console: includeConsole ? { ps5: { count: ps5Count, price1v1: ps5Price1v1, price2v2: ps5Price2v2 } } : undefined,
      futsal: supportsFutsal ? { standard: { count: futsalCount, price: futsalPrice } } : undefined,
      indoor_cricket: supportsIndoorCricket ? { standard: { count: indoorNetCount, price: indoorPrice } } : undefined,
      padel: supportsPadel ? { standard: { count: padelCount, price: padelPrice } } : undefined,
      pickleball: supportsPickleball ? { standard: { count: pickleCount, price: picklePrice } } : undefined,
    },

    notes: rand() < 0.5 ? "Walk-ins welcome." : "Advance booking recommended.",
    source: "manual",
    isActive: true,
    resourceModelVersion: 0,
  };
}

function zoneGameArrayFromBranches(branches: any[]) {
  const games = new Set<string>();
  for (const b of branches) {
    if (b.supportsCs2) games.add("cs2");
    if (b.supportsFc25) games.add("fc26");
    if (b.supportsTekken8) games.add("tekken8");
    if (b.supportsFutsal) games.add("futsal");
    if (b.supportsIndoorCricket) games.add("indoor_cricket");
    if (b.supportsPadel) games.add("padel");
    if (b.supportsPickleball) games.add("pickleball");
  }
  if (games.size === 0) games.add("cs2");
  return Array.from(games);
}

function buildZoneName(i: number, city: string, profile: DemoZoneProfile) {
  const rand = mulberry32(100000 + i);
  const area = pick(rand, AREAS_BY_CITY[city] || ["Central"]);
  const kind =
    profile === "sports"
      ? rand() < 0.6
        ? "Sports Complex"
        : rand() < 0.85
          ? "Futsal Arena"
          : "Sports Hub"
      : profile === "hybrid"
        ? rand() < 0.6
          ? "Sports & Gaming Hub"
          : rand() < 0.85
            ? "Arena + Courts"
            : "Community Hub"
        : rand() < 0.6
          ? "Gaming Arena"
          : rand() < 0.85
            ? "Esports Lounge"
            : "Gaming Hub";
  const prefix = rand() < 0.55 ? area : city;
  return `${prefix} ${kind}`;
}

async function ensureBetterAuthUser(
  ctx: any,
  input: {
    email: string;
    name: string;
    username: string;
    phone: string;
    passwordPlaintext?: string;
    forceCredentialPassword?: boolean;
    phoneNumberVerified?: boolean;
  },
) {
  const existing = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "email", operator: "eq", value: input.email }],
  });

  if (existing) {
    const id = String((existing as any).id || (existing as any)._id || "");
    if (!id) throw new Error("Found Better Auth user but could not resolve id.");
    const username =
      String((existing as any).username || (existing as any).displayUsername || input.username || "").slice(
        0,
        MAX_USERNAME_LEN
      ) || input.username;

    if (input.phoneNumberVerified) {
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: "user",
          where: [{ field: "_id", operator: "eq", value: id }],
          update: {
            emailVerified: true,
            phoneNumber: input.phone,
            phoneNumberVerified: true,
            updatedAt: Date.now(),
          },
        },
      });
    }

    const passwordToUse = input.passwordPlaintext || DEMO_PASSWORD;
    const shouldForcePassword = !!input.forceCredentialPassword;
    const isDemoEmail = String(input.email || "").toLowerCase().endsWith(KARACHI_REALISTIC_EMAIL_DOMAIN);
    if (shouldForcePassword && isDemoEmail) {
      const passwordHash = await hashPassword(passwordToUse);
      const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "account",
        where: [
          { field: "userId", operator: "eq", value: id },
          { connector: "AND", field: "providerId", operator: "eq", value: "credential" },
        ],
      });

      if (account) {
        await ctx.runMutation(components.betterAuth.adapter.updateOne, {
          input: {
            model: "account",
            where: [{ field: "_id", operator: "eq", value: String((account as any).id || (account as any)._id || "") }],
            update: {
              password: passwordHash,
              updatedAt: Date.now(),
            },
          },
        });
      } else {
        await ctx.runMutation(components.betterAuth.adapter.create, {
          input: {
            model: "account",
            data: {
              accountId: id,
              providerId: "credential",
              password: passwordHash,
              userId: id,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          },
        });
      }
    }
    return { authUserId: id, username };
  }

  const now = Date.now();

  const emailLocal = normalizeUsername(String(input.email || "").split("@")[0] || "");
  const emailSuffix = emailLocal.slice(-3) || to3(Math.abs(hashString(emailLocal)) % 1000);
  const trim = (value: string) => (value || "").slice(0, MAX_USERNAME_LEN) || `demo_${emailSuffix}`;
  const candidates = Array.from(
    new Set([trim(input.username), trim(`${input.username}_${emailSuffix}`), trim(emailLocal)])
  );

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
            phoneNumberVerified: !!input.phoneNumberVerified,
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
      const msg = String(err?.message || err || "");
      if (msg.toLowerCase().includes("username already exists")) {
        continue;
      }
      throw err;
    }
  }

  if (!created) {
    throw new Error("Failed to create Better Auth user (username collisions).");
  }

  const authUserId = String((created as any).id || (created as any)?._id || "");
  if (!authUserId) {
    throw new Error("Failed to create Better Auth user.");
  }

  const passwordToUse = input.passwordPlaintext || DEMO_PASSWORD;
  const passwordHash = await hashPassword(passwordToUse);
  const existingAccount = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "account",
    where: [
      { field: "userId", operator: "eq", value: authUserId },
      { connector: "AND", field: "providerId", operator: "eq", value: "credential" },
    ],
  });

  if (!existingAccount || (input.forceCredentialPassword && String(input.email || "").toLowerCase().endsWith(KARACHI_REALISTIC_EMAIL_DOMAIN))) {
    if (existingAccount && input.forceCredentialPassword) {
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: {
          model: "account",
          where: [{ field: "_id", operator: "eq", value: String((existingAccount as any).id || (existingAccount as any)._id || "") }],
        },
      });
    }
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

function hashString(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

async function ensureConvexUser(ctx: any, input: {
  authId: string;
  email: string;
  fullName: string;
  username: string;
  phone: string;
  accountType: "player" | "zone";
  city?: string;
  areasPreferred?: string[];
  flags?: Record<string, boolean>;
  skillScores?: any;
  steam?: any;
  faceit?: any;
}): Promise<Id<"users">> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", normalizedEmail))
    .unique();
  const desiredUsernameLower = normalizeUsername(input.username);
  if (existing) {
    // Best-effort: align existing demo users to a unique username shape without breaking email identity.
    if (existing.usernameLower !== desiredUsernameLower) {
      const collisions = await ctx.db
        .query("users")
        .withIndex("by_usernameLower", (q: any) => q.eq("usernameLower", desiredUsernameLower))
        .collect();
      const other = collisions.find((u: any) => String(u._id) !== String(existing._id));
      if (!other) {
        await ctx.db.patch(existing._id, {
          username: input.username,
          usernameLower: desiredUsernameLower,
          updatedAt: Date.now(),
        } as any);
      }
    }
    return existing._id;
  }

  const now = Date.now();

  const suffixFromEmail = (() => {
    const local = normalizeUsername(String(normalizedEmail).split("@")[0] || "");
    const digits = (local.match(/(\d{3,})$/) || [])[1];
    return (digits ? digits.slice(-3) : local.slice(-3) || to3(Math.abs(hashString(local)) % 1000)).slice(0, 3);
  })();

  const emailLocal = normalizeUsername(String(normalizedEmail).split("@")[0] || "");
  const candidates = Array.from(
    new Set([
      String(input.username || "").slice(0, MAX_USERNAME_LEN),
      String(`${input.username}_${suffixFromEmail}`).slice(0, MAX_USERNAME_LEN),
      String(emailLocal).slice(0, MAX_USERNAME_LEN),
      `demo_${suffixFromEmail}`,
    ])
  ).filter(Boolean);

  let username = candidates[0] || `demo_${suffixFromEmail}`;
  let usernameLower = normalizeUsername(username);

  for (const c of candidates) {
    const lower = normalizeUsername(c);
    const collision = await ctx.db
      .query("users")
      .withIndex("by_usernameLower", (q: any) => q.eq("usernameLower", lower))
      .collect();
    if (collision.length === 0) {
      username = c;
      usernameLower = lower;
      break;
    }
  }

  const base: Record<string, any> = {
    authId: input.authId,
    email: normalizedEmail,
    fullName: input.fullName,
    username,
    usernameLower,
    phone: input.phone,
    accountType: input.accountType,
    isOnline: false,
    isVerified: true,
    onboardingCompleted: true,
    onboardingStep: 4,
    city: input.city,
    areasPreferred: input.areasPreferred || [],
    trustScore: 70,
    createdAt: now,
    updatedAt: now,
  };

  if (input.accountType === "player") {
    base.hideAreasPublicly = false;
    base.hidePlatformsPublicly = false;
    base.restrictInvitesToFriends = false;
  }

  if (input.flags) Object.assign(base, input.flags);
  if (input.skillScores) base.skillScores = input.skillScores;

  if (input.steam) {
    base.steamProfileUrl = `https://steamcommunity.com/profiles/${input.steam.steamId}`;
    base.steamId = input.steam.steamId;
    base.steamPersonaName = input.steam.personaName;
    base.steamCs2Hours = input.steam.cs2Hours;
    base.steamStats = input.steam;
  }

  if (input.faceit) {
    base.faceitProfileUrl = `https://www.faceit.com/en/players/${input.faceit.nickname}`;
    base.faceitId = input.faceit.faceitId;
    base.faceitNickname = input.faceit.nickname;
    base.faceitGame = input.faceit.game;
    base.faceitElo = input.faceit.elo;
    base.faceitSkillLevel = input.faceit.skillLevel;
    base.faceitStats = input.faceit;
  }

  const userId = await ctx.db.insert("users", base as any);
  return userId as Id<"users">;
}

async function ensureDemoSuperAdmin(ctx: any) {
  const email = buildEmail("super", 0);
  const fullName = "MatchHai Demo Super Admin";
  const username = "demo_superadmin";
  const phone = buildPhone(999);
  const auth = await ensureBetterAuthUser(ctx, { email, name: fullName, username, phone });

  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .unique();

  if (!existing) {
    const now = Date.now();
    await ctx.db.insert("users", {
      authId: auth.authUserId,
      email,
      fullName,
      username: auth.username,
      usernameLower: normalizeUsername(auth.username),
      phone,
      accountType: "player",
      isOnline: false,
      isVerified: true,
      onboardingCompleted: true,
      onboardingStep: 4,
      role: "super-admin",
      city: "Karachi",
      createdAt: now,
      updatedAt: now,
    } as any);
  } else if (existing.role !== "super-admin") {
    await ctx.db.patch(existing._id, { role: "super-admin", updatedAt: Date.now() } as any);
  }

  return { email, username: auth.username };
}

async function upsertFriendshipRing(ctx: any, playerIds: Array<Id<"users">>) {
  for (let idx = 0; idx < playerIds.length; idx += 1) {
    const fromUid = playerIds[idx];
    const fromUser = (await ctx.db.get(fromUid)) as Doc<"users"> | null;
    if (!fromUser) continue;
    const fromUsername = fromUser.username;

    for (let step = 1; step <= 3; step += 1) {
      const toUid = playerIds[(idx + step) % playerIds.length];
      if (toUid === fromUid) continue;

      const notificationId = await ctx.runMutation(api.social.sendFriendRequest, {
        fromUid,
        fromUsername,
        toUid,
      });

      if (notificationId) {
        await ctx.runMutation(api.social.respondFriendRequest, {
          notificationId: notificationId as any,
          accept: true,
        });
      }
    }
  }
}

function scheduledStartForIndex(i: number) {
  const now = Date.now();
  const daysAhead = 3 + (i % 10);
  const base = now + daysAhead * 24 * 60 * 60 * 1000;
  const date = new Date(base);
  const hourOptions = [10, 12, 14, 16, 18, 20, 21, 22];
  const hour = hourOptions[i % hourOptions.length];
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
}

function formatDateYMD(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatTimeHM(ts: number) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function matchroomMaxPlayers(game: string) {
  if (game === "cs2" || game === "valorant") return 10;
  if (game === "futsal") return 10;
  if (game === "indoor_cricket") return 12;
  if (game === "padel" || game === "pickleball") return 4;
  return 2;
}

function buildSlots(maxPlayers: number) {
  const teamSize = maxPlayers % 2 === 0 ? maxPlayers / 2 : Math.max(1, Math.floor(maxPlayers / 2));
  const makeSide = (side: "A" | "B") =>
    Array.from({ length: teamSize }, (_, idx) => ({
      slotId: `${side}${idx + 1}`,
      status: "open" as const,
      role: "Player",
    }));
  return { slotsA: makeSide("A"), slotsB: makeSide("B") };
}

function generateMatchroomTitle(i: number, city: string, game: string) {
  const rand = mulberry32(110000 + i);
  const verbs = ["Scrim", "Friendly", "Ranked Practice", "Bo3 Series", "Weekend Match", "Evening Lobby"];
  const verb = pick(rand, verbs);
  const gameLabel = game === "cs2"
    ? "CS2"
    : game === "valorant"
      ? "Valorant"
      : game === "fc26"
        ? "FC26"
        : game === "tekken8"
          ? "Tekken 8"
          : game === "futsal"
            ? "Futsal"
            : game === "indoor_cricket"
              ? "Indoor Cricket"
              : game === "padel"
                ? "Padel"
                : "Pickleball";
  return `${city} ${gameLabel} ${verb}`;
}

export const seedDemoDataLegacy = mutation({
  args: {
    seedKey: v.string(),
    playerCount: v.optional(v.number()),
    zoneCount: v.optional(v.number()),
    teamCount: v.optional(v.number()),
    matchroomCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireSeedKey(args.seedKey);

    const playerCount = args.playerCount ?? DEFAULT_PLAYER_COUNT;
    const zoneCount = args.zoneCount ?? DEFAULT_ZONE_COUNT;
    const teamCount = args.teamCount ?? DEFAULT_TEAM_COUNT;
    const matchroomCount = args.matchroomCount ?? DEFAULT_MATCHROOM_COUNT;

    const superAdmin = await ensureDemoSuperAdmin(ctx);

    const playerIds: Array<Id<"users">> = [];
    const zoneAdminIds: Array<Id<"users">> = [];
    const zoneIds: Array<Id<"zones">> = [];

    for (let i = 1; i <= playerCount; i += 1) {
      const city = CITIES[(i - 1) % CITIES.length];
      const fullName = buildPlayerName(i);
      const email = buildEmail("player", i);
      const phone = buildPhone(i);
      const username = buildUsernameFromName(fullName, city, i);
      const auth = await ensureBetterAuthUser(ctx, { email, name: fullName, username, phone });

      const games = pickGamesForPlayer(i);
      const flags = buildPlayerFlags(games);
      const skillScores = buildSkillScoresForGames(i, games);
      const steam = buildSteamProfile(i, fullName);
      const faceit = buildFaceitProfile(i, fullName);

      const userId = await ensureConvexUser(ctx, {
        authId: auth.authUserId,
        email,
        fullName,
        username: auth.username,
        phone,
        accountType: "player",
        city,
        areasPreferred: [pick(mulberry32(91000 + i), AREAS_BY_CITY[city] || ["Central"])],
        flags,
        skillScores,
        steam,
        faceit,
      });
      playerIds.push(userId);
    }

    for (let i = 1; i <= zoneCount; i += 1) {
      const city = CITIES[(i - 1) % CITIES.length];
      const fullName = buildZoneAdminName(i);
      const email = buildEmail("zone", i);
      const phone = buildPhone(2000 + i);
      const username = buildUsernameFromName(fullName, city, i);
      const auth = await ensureBetterAuthUser(ctx, { email, name: fullName, username, phone });

      const adminId = await ensureConvexUser(ctx, {
        authId: auth.authUserId,
        email,
        fullName,
        username: auth.username,
        phone,
        accountType: "zone",
        city,
        areasPreferred: [pick(mulberry32(92000 + i), AREAS_BY_CITY[city] || ["Central"])],
      });

      zoneAdminIds.push(adminId);

      const existingZone = await ctx.db
        .query("zones")
        .withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", adminId))
        .unique();
      if (existingZone) {
        zoneIds.push(existingZone._id);
        continue;
      }

      const profile = zoneProfileForIndex(i);
      const branchCount = 1 + (i % 3);
      const branches = Array.from({ length: branchCount }, (_, branchIndex) =>
        buildZoneBranch(i, branchIndex, city, profile)
      );
      const games = zoneGameArrayFromBranches(branches);
      const venueBrandName = buildZoneName(i, city, profile);

      const zoneId = await ctx.runMutation(api.zones.create, {
        ownerUid: adminId as any,
        ownerUsername: auth.username,
        ownerFullName: fullName,
        name: venueBrandName,
        venueBrandName,
        contactEmail: email,
        contactPhone: phone,
        type: profile,
        description: `A community venue in ${city} with both casual and competitive sessions.`,
        address: branches[0]?.addressLine1,
        city,
        phone,
        games,
        branches,
        defaultPricing: { hourlyRate: 350, currency: DEFAULT_CURRENCY },
      });

      zoneIds.push(zoneId as Id<"zones">);
      await ctx.runMutation(api.zones.approve, { zoneId: zoneId as any });

      for (const branch of branches) {
        const branchId = String(branch.id);
        const pricing = branch.pricing || {};

        const pc: any = (pricing as any).pc || {};
        const tiers: Array<{ tier: string; count: number; price: number }> = [];
        if (pc.regular?.count && pc.regular?.price) {
          tiers.push({ tier: "regular", count: Number(pc.regular.count), price: Number(pc.regular.price) });
        }
        if (pc.premium?.count && pc.premium?.price) {
          tiers.push({ tier: "premium", count: Number(pc.premium.count), price: Number(pc.premium.price) });
        }
        if (pc.elite?.count && pc.elite?.price) {
          tiers.push({ tier: "elite", count: Number(pc.elite.count), price: Number(pc.elite.price) });
        }

        for (const t of tiers) {
          for (let seat = 1; seat <= Math.max(0, t.count); seat += 1) {
            await ctx.runMutation(api.zones.createResource, {
              zoneId: zoneId as any,
              branchId,
              kind: "seat",
              name: `PC ${t.tier.toUpperCase()}-${seat}`,
              assetType: "pc",
              tier: t.tier,
              surface: "pc",
              roomLabel: "PC Hall",
              capacity: 1,
              hourlyRate: t.price,
            });
          }
        }

        const ps5 = pricing.console?.ps5;
        if (ps5?.count && ps5?.price1v1) {
          const count = Number(ps5.count);
          const rate = Number(ps5.price1v1);
          for (let idx = 1; idx <= Math.max(0, count); idx += 1) {
            await ctx.runMutation(api.zones.createResource, {
              zoneId: zoneId as any,
              branchId,
              kind: "seat",
              name: `PS5-${idx}`,
              assetType: "console",
              tier: "ps5",
              surface: "ps5",
              roomLabel: "Console Room",
              capacity: 2,
              hourlyRate: rate,
            });
          }
        }

        const courts: Array<{ assetType: string; label: string; price: number; count: number }> = [];
        if (pricing.futsal?.standard?.count && pricing.futsal?.standard?.price) {
          courts.push({ assetType: "futsal", label: "Futsal Court", price: Number(pricing.futsal.standard.price), count: Number(pricing.futsal.standard.count) });
        }
        if (pricing.indoor_cricket?.standard?.count && pricing.indoor_cricket?.standard?.price) {
          courts.push({ assetType: "indoor_cricket", label: "Cricket Net", price: Number(pricing.indoor_cricket.standard.price), count: Number(pricing.indoor_cricket.standard.count) });
        }
        if (pricing.padel?.standard?.count && pricing.padel?.standard?.price) {
          courts.push({ assetType: "padel", label: "Padel Court", price: Number(pricing.padel.standard.price), count: Number(pricing.padel.standard.count) });
        }
        if (pricing.pickleball?.standard?.count && pricing.pickleball?.standard?.price) {
          courts.push({ assetType: "pickleball", label: "Pickleball Court", price: Number(pricing.pickleball.standard.price), count: Number(pricing.pickleball.standard.count) });
        }

        for (const c of courts) {
          for (let idx = 1; idx <= Math.max(0, c.count); idx += 1) {
            await ctx.runMutation(api.zones.createResource, {
              zoneId: zoneId as any,
              branchId,
              kind: "court",
              name: `${c.label} ${idx}`,
              assetType: c.assetType,
              tier: undefined,
              surface: "standard",
              roomLabel: undefined,
              capacity: c.assetType === "indoor_cricket" ? 12 : 10,
              hourlyRate: c.price,
            });
          }
        }

        await ctx.runMutation(api.zones.createPricingRule, {
          zoneId: zoneId as any,
          branchId,
          assetType: "pc",
          isEnabled: true,
          priority: 10,
          ruleType: "percentage_discount",
          value: -15,
          timeStart: "18:00",
          timeEnd: "23:00",
          daysOfWeek: [4, 5, 6],
          name: "Peak hours uplift",
          description: "Peak hours rate adjustment for evening sessions.",
          createdByUid: String(adminId),
        });
      }
    }

    await upsertFriendshipRing(ctx, playerIds);

    for (let i = 1; i <= teamCount; i += 1) {
      const captainId = playerIds[(i - 1) % playerIds.length];
      const captain = (await ctx.db.get(captainId)) as Doc<"users"> | null;
      if (!captain) continue;

      const rand = mulberry32(130000 + i);
      const city = CITIES[(i - 1) % CITIES.length];
      const mascot = pick(rand, TEAM_MASCOTS);
      const name = `${city} ${mascot}`;
      const tag = `${city.slice(0, 2).toUpperCase()}${mascot.slice(0, 1)}`.slice(0, 5);
      const game = pickGamesForPlayer(i)[0] || "cs2";

      if (!doesUserPlayGameFromRecord(captain, game)) continue;

      const existingTeams = await ctx.db
        .query("teams")
        .withIndex("by_captainUid", (q: any) => q.eq("captainUid", captain._id))
        .collect();
      const already = existingTeams.find((t: any) => t.game === game && t.nameLower === name.toLowerCase());
      let teamId: any = already?._id;
      if (!teamId) {
        teamId = await ctx.runMutation(api.teams.create, {
          name,
          tag,
          game,
          captainUid: captain._id,
          captainUsername: captain.username,
          maxMembers: 10,
          description: `Community roster for ${game}. Seeded for demo testing.`,
        });
      }

      const desiredExtras = Math.floor(rand() * 10);
      const eligible = playerIds.filter((uid) => uid !== captainId);
      let added = 0;
      for (let idx = 0; idx < eligible.length && added < desiredExtras; idx += 1) {
        const candidateId = eligible[(idx + i) % eligible.length];
        const candidate = (await ctx.db.get(candidateId)) as Doc<"users"> | null;
        if (!candidate) continue;
        if (!doesUserPlayGameFromRecord(candidate, game)) continue;
        try {
          await ctx.runMutation(api.teams.addMember, {
            teamId: teamId as any,
            userId: candidate._id,
            username: candidate.username,
          });
          added += 1;
        } catch {
          // ignore
        }
      }
    }

    for (let i = 1; i <= matchroomCount; i += 1) {
      const hostId = playerIds[(i - 1) % playerIds.length];
      const host = (await ctx.db.get(hostId)) as Doc<"users"> | null;
      if (!host) continue;

      const zoneId = zoneIds[(i - 1) % zoneIds.length];
      const zone = (await ctx.db.get(zoneId)) as Doc<"zones"> | null;
      if (!zone) continue;

      const zoneGames = Array.isArray(zone.games) ? zone.games : [];
      const hostGames = pickGamesForPlayer(i);
      const rotatingPreference = (() => {
        const variants = [
          ["futsal", "cs2", "fc26", "tekken8", "indoor_cricket", "padel", "pickleball"],
          ["fc26", "cs2", "tekken8", "futsal", "indoor_cricket", "padel", "pickleball"],
          ["tekken8", "cs2", "fc26", "futsal", "indoor_cricket", "padel", "pickleball"],
          ["indoor_cricket", "cs2", "futsal", "fc26", "tekken8", "padel", "pickleball"],
        ];
        return variants[i % variants.length];
      })();

      const game =
        rotatingPreference.find((g) => hostGames.includes(g) && zoneGames.includes(g))
        || hostGames.find((g) => zoneGames.includes(g))
        || "cs2";
      if (!doesUserPlayGameFromRecord(host, game)) continue;

      const startAt = scheduledStartForIndex(i);
      const scheduledDate = formatDateYMD(startAt);
      const scheduledTime = formatTimeHM(startAt);
      const matchCode = `DEMO_MR${to3(i)}`;

      const existingRooms = await ctx.db
        .query("matchrooms")
        .withIndex("by_hostUid", (q: any) => q.eq("hostUid", String(host._id)))
        .collect();
      const existing = existingRooms.find((r: any) => String(r.matchCode || "") === matchCode);
      if (existing) continue;

      const maxPlayers = matchroomMaxPlayers(game);
      const { slotsA, slotsB } = buildSlots(maxPlayers);
      const title = generateMatchroomTitle(i, String(zone.city || CITIES[(i - 1) % CITIES.length]), game);
      const location = `${zone.venueBrandName || zone.name} • ${zone.primaryBranch?.areaLabel || zone.city || ""}`;

      const perPlayer = (() => {
        const branch = Array.isArray(zone.branches) ? zone.branches[0] : null;
        const pricing = branch?.pricing;
        if (game === "cs2" || game === "valorant") {
          const n = Number(pricing?.pc?.regular?.price);
          return Number.isFinite(n) && n > 0 ? n : 350;
        }
        if (game === "fc26" || game === "tekken8") {
          const n = Number(pricing?.console?.ps5?.price1v1);
          return Number.isFinite(n) && n > 0 ? Math.round(n / 2) : 400;
        }
        const n = Number(pricing?.[game]?.standard?.price);
        return Number.isFinite(n) && n > 0 ? Math.round(n / maxPlayers) : 500;
      })();

      await ctx.runMutation(api.matchrooms.create, {
        hostUid: String(host._id),
        hostName: host.username,
        game,
        title,
        description: "Seeded demo matchroom. Created for QA and realistic flow testing.",
        matchCode,
        maxPlayers,
        players: [
          {
            uid: String(host._id),
            username: host.username,
            joinedAt: Date.now(),
            role: "Host",
          },
        ],
        playerUids: [String(host._id)],
        location,
        locationMode: "zone",
        zoneId: String(zone._id),
        zoneOwnerUid: String(zone.ownerUid),
        scheduledDate,
        scheduledTime,
        scheduledStartAt: startAt,
        lockAt: startAt - 24 * 60 * 60 * 1000,
        expiresAt: startAt - 24 * 60 * 60 * 1000,
        durationMinutes: 60,
        pricing: { perPlayer, currency: DEFAULT_CURRENCY },
        slotsA,
        slotsB,
        captainUidA: String(host._id),
        skillLevel: "Any",
        hostRole: "Player",
        bookingSource: "seed",
        isPrivate: false,
        paymentStatus: "unpaid",
        zoneAdminApproved: true,
      });
    }

    return {
      ok: true,
      superAdmin,
      counts: {
        players: playerIds.length,
        zoneAdmins: zoneAdminIds.length,
        zones: zoneIds.length,
      },
      password: DEMO_PASSWORD,
    };
  },
});

type DemoSeedCursor = {
  phase: "players" | "zones" | "friendships" | "teams" | "matchrooms" | "done";
  index: number;
};

function normalizeSeedCursor(input: any): DemoSeedCursor {
  const phase = String(input?.phase || "players");
  const validPhases = new Set(["players", "zones", "friendships", "teams", "matchrooms", "done"]);
  const index = Number(input?.index || 1);
  return {
    phase: (validPhases.has(phase) ? phase : "players") as DemoSeedCursor["phase"],
    index: Number.isFinite(index) && index >= 1 ? Math.floor(index) : 1,
  };
}

export const seedDemoSuperAdmin = internalMutation({
  args: { seedKey: v.string() },
  handler: async (ctx, args) => {
    requireSeedKey(args.seedKey);
    return await ensureDemoSuperAdmin(ctx);
  },
});

export const seedDemoPlayerByIndex = internalMutation({
  args: { seedKey: v.string(), i: v.number() },
  handler: async (ctx, args) => {
    requireSeedKey(args.seedKey);

    const i = Math.floor(args.i);
    const city = CITIES[(i - 1) % CITIES.length];
    const fullName = buildPlayerName(i);
    const email = buildEmail("player", i);
    const phone = buildPhone(i);
    const username = buildUsernameFromName(fullName, city, i);
    const auth = await ensureBetterAuthUser(ctx, { email, name: fullName, username, phone });

    const games = pickGamesForPlayer(i);
    const flags = buildPlayerFlags(games);
    const skillScores = buildSkillScoresForGames(i, games);
    const steam = buildSteamProfile(i, fullName);
    const faceit = buildFaceitProfile(i, fullName);

    const userId = await ensureConvexUser(ctx, {
      authId: auth.authUserId,
      email,
      fullName,
      username: auth.username,
      phone,
      accountType: "player",
      city,
      areasPreferred: [pick(mulberry32(91000 + i), AREAS_BY_CITY[city] || ["Central"])],
      flags,
      skillScores,
      steam,
      faceit,
    });

    return { ok: true, userId: String(userId) };
  },
});

export const seedDemoZoneByIndex = internalMutation({
  args: { seedKey: v.string(), i: v.number() },
  handler: async (ctx, args) => {
    requireSeedKey(args.seedKey);

    const i = Math.floor(args.i);
    const city = CITIES[(i - 1) % CITIES.length];
    const fullName = buildZoneAdminName(i);
    const email = buildEmail("zone", i);
    const phone = buildPhone(2000 + i);
    const username = buildUsernameFromName(fullName, city, i);
    const auth = await ensureBetterAuthUser(ctx, { email, name: fullName, username, phone });

    const adminId = await ensureConvexUser(ctx, {
      authId: auth.authUserId,
      email,
      fullName,
      username: auth.username,
      phone,
      accountType: "zone",
      city,
      areasPreferred: [pick(mulberry32(92000 + i), AREAS_BY_CITY[city] || ["Central"])],
    });

    const existingZone = await ctx.db
      .query("zones")
      .withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", adminId))
      .unique();
    if (existingZone) {
      return { ok: true, adminId: String(adminId), zoneId: String(existingZone._id) };
    }

    const profile = zoneProfileForIndex(i);
    const branchCount = 1 + (i % 2);
    const branches = Array.from({ length: branchCount }, (_, branchIndex) => buildZoneBranch(i, branchIndex, city, profile));
    const games = zoneGameArrayFromBranches(branches);
    const venueBrandName = buildZoneName(i, city, profile);

    const zoneId = (await ctx.runMutation(api.zones.create, {
      ownerUid: adminId as any,
      ownerUsername: auth.username,
      ownerFullName: fullName,
      name: venueBrandName,
      venueBrandName,
      contactEmail: email,
      contactPhone: phone,
      type: profile,
      description: `A community venue in ${city} with both casual and competitive sessions.`,
      address: branches[0]?.addressLine1,
      city,
      phone,
      games,
      branches,
      defaultPricing: { hourlyRate: 350, currency: DEFAULT_CURRENCY },
    })) as any;

    await ctx.runMutation(api.zones.approve, { zoneId: zoneId as any });

    for (const branch of branches) {
      const branchId = String(branch.id);
      const pricing = branch.pricing || {};

      const pc: any = (pricing as any).pc || {};
      const tiers: Array<{ tier: string; count: number; price: number }> = [];
      if (pc.regular?.count && pc.regular?.price) {
        tiers.push({ tier: "regular", count: Number(pc.regular.count), price: Number(pc.regular.price) });
      }
      if (pc.premium?.count && pc.premium?.price) {
        tiers.push({ tier: "premium", count: Number(pc.premium.count), price: Number(pc.premium.price) });
      }
      if (pc.elite?.count && pc.elite?.price) {
        tiers.push({ tier: "elite", count: Number(pc.elite.count), price: Number(pc.elite.price) });
      }

      for (const t of tiers) {
        const cap = t.tier === "regular" ? 3 : t.tier === "premium" ? 2 : 1;
        for (let seat = 1; seat <= Math.min(Math.max(0, t.count), cap); seat += 1) {
          await ctx.runMutation(api.zones.createResource, {
            zoneId: zoneId as any,
            branchId,
            kind: "seat",
            name: `PC ${t.tier.toUpperCase()}-${seat}`,
            assetType: "pc",
            tier: t.tier,
            surface: "pc",
            roomLabel: "PC Hall",
            capacity: 1,
            hourlyRate: t.price,
          });
        }
      }

      const ps5 = pricing.console?.ps5;
      if (ps5?.count && ps5?.price1v1) {
        const count = Number(ps5.count);
        const rate = Number(ps5.price1v1);
        for (let idx = 1; idx <= Math.min(Math.max(0, count), 1); idx += 1) {
          await ctx.runMutation(api.zones.createResource, {
            zoneId: zoneId as any,
            branchId,
            kind: "seat",
            name: `PS5-${idx}`,
            assetType: "console",
            tier: "ps5",
            surface: "ps5",
            roomLabel: "Console Room",
            capacity: 2,
            hourlyRate: rate,
          });
        }
      }

      const courts: Array<{ assetType: string; label: string; price: number; count: number }> = [];
      if (pricing.futsal?.standard?.count && pricing.futsal?.standard?.price) {
        courts.push({
          assetType: "futsal",
          label: "Futsal Court",
          price: Number(pricing.futsal.standard.price),
          count: Number(pricing.futsal.standard.count),
        });
      }
      if (pricing.indoor_cricket?.standard?.count && pricing.indoor_cricket?.standard?.price) {
        courts.push({
          assetType: "indoor_cricket",
          label: "Cricket Net",
          price: Number(pricing.indoor_cricket.standard.price),
          count: Number(pricing.indoor_cricket.standard.count),
        });
      }
      if (pricing.padel?.standard?.count && pricing.padel?.standard?.price) {
        courts.push({
          assetType: "padel",
          label: "Padel Court",
          price: Number(pricing.padel.standard.price),
          count: Number(pricing.padel.standard.count),
        });
      }
      if (pricing.pickleball?.standard?.count && pricing.pickleball?.standard?.price) {
        courts.push({
          assetType: "pickleball",
          label: "Pickleball Court",
          price: Number(pricing.pickleball.standard.price),
          count: Number(pricing.pickleball.standard.count),
        });
      }

      let courtCreated = false;
      for (const c of courts) {
        if (courtCreated) break;
        for (let idx = 1; idx <= Math.min(Math.max(0, c.count), 1); idx += 1) {
          await ctx.runMutation(api.zones.createResource, {
            zoneId: zoneId as any,
            branchId,
            kind: "court",
            name: `${c.label} ${idx}`,
            assetType: c.assetType,
            tier: undefined,
            surface: "standard",
            roomLabel: undefined,
            capacity: c.assetType === "indoor_cricket" ? 12 : 10,
            hourlyRate: c.price,
          });
        }
        courtCreated = true;
      }

      const ruleAssetType =
        tiers.length > 0
          ? "pc"
          : ps5?.count
            ? "console"
            : courts.length > 0
              ? String(courts[0]!.assetType)
              : "pc";

      await ctx.runMutation(api.zones.createPricingRule, {
        zoneId: zoneId as any,
        branchId,
        assetType: ruleAssetType,
        isEnabled: true,
        priority: 10,
        ruleType: "percentage_discount",
        value: -10,
        timeStart: ruleAssetType === "pc" ? "18:00" : undefined,
        timeEnd: ruleAssetType === "pc" ? "23:00" : undefined,
        daysOfWeek: ruleAssetType === "pc" ? [4, 5, 6] : [5, 6],
        name: ruleAssetType === "pc" ? "Peak hours uplift" : "Weekend offer",
        description:
          ruleAssetType === "pc"
            ? "Peak hours rate adjustment for evening sessions."
            : "Weekend pricing offer for demo venue testing.",
        createdByUid: String(adminId),
      });
    }

    return { ok: true, adminId: String(adminId), zoneId: String(zoneId) };
  },
});

export const seedDemoFriendshipsForIndex = internalMutation({
  args: { seedKey: v.string(), i: v.number(), playerCount: v.number() },
  handler: async (ctx, args) => {
    requireSeedKey(args.seedKey);

    const i = Math.floor(args.i);
    const playerCount = Math.floor(args.playerCount);
    const fromEmail = buildEmail("player", i);
    const fromUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", fromEmail))
      .unique();
    if (!fromUser) return { ok: true, skipped: true };

    for (let step = 1; step <= 3; step += 1) {
      const j = ((i - 1 + step) % playerCount) + 1;
      const toEmail = buildEmail("player", j);
      const toUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", toEmail))
        .unique();
      if (!toUser) continue;

      try {
        const notificationId = await ctx.runMutation(api.social.sendFriendRequest, {
          fromUid: fromUser._id,
          fromUsername: fromUser.username,
          toUid: toUser._id,
        });

        if (notificationId) {
          await ctx.runMutation(api.social.respondFriendRequest, {
            notificationId: notificationId as any,
            accept: true,
          });
        }
      } catch {
        // Ignore duplicates (already friends / request exists).
      }
    }

    return { ok: true };
  },
});

export const seedDemoTeamByIndex = internalMutation({
  args: { seedKey: v.string(), i: v.number(), playerCount: v.number() },
  handler: async (ctx, args) => {
    requireSeedKey(args.seedKey);

    const i = Math.floor(args.i);
    const playerCount = Math.floor(args.playerCount);
    const captainIndex = ((i - 1) % playerCount) + 1;
    const captainEmail = buildEmail("player", captainIndex);
    const captain = (await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", captainEmail))
      .unique()) as Doc<"users"> | null;
    if (!captain) return { ok: true, skipped: true };

    const rand = mulberry32(130000 + i);
    const city = CITIES[(i - 1) % CITIES.length];
    const mascot = pick(rand, TEAM_MASCOTS);
    const name = `${city} ${mascot}`;
    const tag = `${city.slice(0, 2).toUpperCase()}${mascot.slice(0, 1)}`.slice(0, 5);
    const game = pickGamesForPlayer(i)[0] || "cs2";

    if (!doesUserPlayGameFromRecord(captain, game)) return { ok: true, skipped: true };

    const existingTeams = await ctx.db
      .query("teams")
      .withIndex("by_captainUid", (q: any) => q.eq("captainUid", captain._id))
      .collect();
    const already = existingTeams.find((t: any) => t.game === game && t.nameLower === name.toLowerCase());
    let teamId: any = already?._id;
    if (!teamId) {
      teamId = await ctx.runMutation(api.teams.create, {
        name,
        tag,
        game,
        captainUid: captain._id,
        captainUsername: captain.username,
        maxMembers: 10,
        description: `Community roster for ${game}. Seeded for demo testing.`,
      });
    }

    const desiredExtras = clamp(Math.floor(rand() * 6), 0, 4);
    let added = 0;
    for (let step = 1; step <= playerCount && added < desiredExtras; step += 1) {
      const candidateIndex = ((captainIndex - 1 + step) % playerCount) + 1;
      const candidateEmail = buildEmail("player", candidateIndex);
      const candidate = (await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", candidateEmail))
        .unique()) as Doc<"users"> | null;
      if (!candidate) continue;
      if (!doesUserPlayGameFromRecord(candidate, game)) continue;
      try {
        await ctx.runMutation(api.teams.addMember, {
          teamId: teamId as any,
          userId: candidate._id,
          username: candidate.username,
        });
        added += 1;
      } catch {
        // Ignore duplicates / not eligible.
      }
    }

    return { ok: true, teamId: String(teamId) };
  },
});

export const seedDemoMatchroomByIndex = internalMutation({
  args: { seedKey: v.string(), i: v.number(), playerCount: v.number(), zoneCount: v.number() },
  handler: async (ctx, args): Promise<any> => {
    requireSeedKey(args.seedKey);

    const i = Math.floor(args.i);
    const playerCount = Math.floor(args.playerCount);
    const zoneCount = Math.floor(args.zoneCount);

    const hostIndex = ((i - 1) % playerCount) + 1;
    const hostEmail = buildEmail("player", hostIndex);
    const host = (await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", hostEmail))
      .unique()) as Doc<"users"> | null;
    if (!host) return { ok: true, skipped: true };

    const zoneAdminIndex = ((i - 1) % zoneCount) + 1;
    const zoneAdminEmail = buildEmail("zone", zoneAdminIndex);
    const zoneAdmin = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", zoneAdminEmail))
      .unique();
    if (!zoneAdmin) return { ok: true, skipped: true };

    const zone = await ctx.db
      .query("zones")
      .withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", zoneAdmin._id))
      .unique();
    if (!zone) return { ok: true, skipped: true };

    const zoneGames = Array.isArray((zone as any).games) ? (zone as any).games : [];
    const hostGames = pickGamesForPlayer(i);
    const rotatingPreference = (() => {
      const variants = [
        ["futsal", "cs2", "fc26", "tekken8", "indoor_cricket", "padel", "pickleball"],
        ["fc26", "cs2", "tekken8", "futsal", "indoor_cricket", "padel", "pickleball"],
        ["tekken8", "cs2", "fc26", "futsal", "indoor_cricket", "padel", "pickleball"],
        ["indoor_cricket", "cs2", "futsal", "fc26", "tekken8", "padel", "pickleball"],
      ];
      return variants[i % variants.length];
    })();

    const game =
      rotatingPreference.find((g) => hostGames.includes(g) && zoneGames.includes(g)) ||
      hostGames.find((g) => zoneGames.includes(g)) ||
      "cs2";
    if (!doesUserPlayGameFromRecord(host, game)) return { ok: true, skipped: true };

    const startAt = scheduledStartForIndex(i);
    const scheduledDate = formatDateYMD(startAt);
    const scheduledTime = formatTimeHM(startAt);
    const matchCode = `DEMO_MR${to3(i)}`;

    const existingRooms = await ctx.db
      .query("matchrooms")
      .withIndex("by_hostUid", (q: any) => q.eq("hostUid", String(host._id)))
      .collect();
    const existing = existingRooms.find((r: any) => String(r.matchCode || "") === matchCode);
    if (existing) return { ok: true, matchroomId: String(existing._id) };

    const maxPlayers = matchroomMaxPlayers(game);
    const { slotsA, slotsB } = buildSlots(maxPlayers);
    const title = generateMatchroomTitle(i, String((zone as any).city || CITIES[(i - 1) % CITIES.length]), game);
    const location = `${(zone as any).venueBrandName || (zone as any).name} - ${
      (zone as any).primaryBranch?.areaLabel || (zone as any).city || ""
    }`;

    const perPlayer = (() => {
      const branch = Array.isArray((zone as any).branches) ? (zone as any).branches[0] : null;
      const pricing = branch?.pricing;
      if (game === "cs2" || game === "valorant") {
        const n = Number(pricing?.pc?.regular?.price);
        return Number.isFinite(n) && n > 0 ? n : 350;
      }
      if (game === "fc26" || game === "tekken8") {
        const n = Number(pricing?.console?.ps5?.price1v1);
        return Number.isFinite(n) && n > 0 ? Math.round(n / 2) : 400;
      }
      const n = Number(pricing?.[game]?.standard?.price);
      return Number.isFinite(n) && n > 0 ? Math.round(n / maxPlayers) : 500;
    })();

    const matchroomId: any = await ctx.runMutation(api.matchrooms.create, {
      hostUid: String(host._id),
      hostName: host.username,
      game,
      title,
      description: "Seeded demo matchroom. Created for QA and realistic flow testing.",
      matchCode,
      maxPlayers,
      players: [
        {
          uid: String(host._id),
          username: host.username,
          joinedAt: Date.now(),
          role: "Host",
        },
      ],
      playerUids: [String(host._id)],
      location,
      locationMode: "zone",
      zoneId: String((zone as any)._id),
      zoneOwnerUid: String((zone as any).ownerUid),
      scheduledDate,
      scheduledTime,
      scheduledStartAt: startAt,
      lockAt: startAt - 24 * 60 * 60 * 1000,
      expiresAt: startAt - 24 * 60 * 60 * 1000,
      durationMinutes: 60,
      pricing: { perPlayer, currency: DEFAULT_CURRENCY },
      slotsA,
      slotsB,
      captainUidA: String(host._id),
      skillLevel: "Any",
      hostRole: "Player",
      bookingSource: "seed",
      isPrivate: false,
      paymentStatus: "unpaid",
      zoneAdminApproved: true,
    });

    return { ok: true, matchroomId: String(matchroomId) };
  },
});

export const seedDemoData = action({
  args: {
    seedKey: v.string(),
    cursor: v.optional(v.any()),
    playerCount: v.optional(v.number()),
    zoneCount: v.optional(v.number()),
    teamCount: v.optional(v.number()),
    matchroomCount: v.optional(v.number()),
    batchSize: v.optional(v.number()),
    maxMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    requireSeedKey(args.seedKey);

    const playerCount = args.playerCount ?? DEFAULT_PLAYER_COUNT;
    const zoneCount = args.zoneCount ?? DEFAULT_ZONE_COUNT;
    const teamCount = args.teamCount ?? DEFAULT_TEAM_COUNT;
    const matchroomCount = args.matchroomCount ?? DEFAULT_MATCHROOM_COUNT;

    const batchSize = clamp(Math.floor(args.batchSize ?? 2), 1, 10);
    const maxMs = clamp(Math.floor(args.maxMs ?? 15_000), 1_000, 120_000);

    const startedAt = Date.now();
    let cursor = normalizeSeedCursor(args.cursor);

    const internalAny = (await import("./_generated/api")).internal as any;

    const superAdmin = await ctx.runMutation(internalAny.demoSeed.seedDemoSuperAdmin, {
      seedKey: args.seedKey,
    });

    while (Date.now() - startedAt < maxMs && cursor.phase !== "done") {
      if (cursor.phase === "players") {
        for (let k = 0; k < batchSize && cursor.index <= playerCount; k += 1) {
          await ctx.runMutation(internalAny.demoSeed.seedDemoPlayerByIndex, { seedKey: args.seedKey, i: cursor.index });
          cursor.index += 1;
          if (Date.now() - startedAt >= maxMs) break;
        }
        if (cursor.index > playerCount) cursor = { phase: "zones", index: 1 };
        continue;
      }

      if (cursor.phase === "zones") {
        for (let k = 0; k < batchSize && cursor.index <= zoneCount; k += 1) {
          await ctx.runMutation(internalAny.demoSeed.seedDemoZoneByIndex, { seedKey: args.seedKey, i: cursor.index });
          cursor.index += 1;
          if (Date.now() - startedAt >= maxMs) break;
        }
        if (cursor.index > zoneCount) cursor = { phase: "friendships", index: 1 };
        continue;
      }

      if (cursor.phase === "friendships") {
        for (let k = 0; k < batchSize && cursor.index <= playerCount; k += 1) {
          await ctx.runMutation(internalAny.demoSeed.seedDemoFriendshipsForIndex, {
            seedKey: args.seedKey,
            i: cursor.index,
            playerCount,
          });
          cursor.index += 1;
          if (Date.now() - startedAt >= maxMs) break;
        }
        if (cursor.index > playerCount) cursor = { phase: "teams", index: 1 };
        continue;
      }

      if (cursor.phase === "teams") {
        for (let k = 0; k < batchSize && cursor.index <= teamCount; k += 1) {
          await ctx.runMutation(internalAny.demoSeed.seedDemoTeamByIndex, {
            seedKey: args.seedKey,
            i: cursor.index,
            playerCount,
          });
          cursor.index += 1;
          if (Date.now() - startedAt >= maxMs) break;
        }
        if (cursor.index > teamCount) cursor = { phase: "matchrooms", index: 1 };
        continue;
      }

      if (cursor.phase === "matchrooms") {
        for (let k = 0; k < batchSize && cursor.index <= matchroomCount; k += 1) {
          await ctx.runMutation(internalAny.demoSeed.seedDemoMatchroomByIndex, {
            seedKey: args.seedKey,
            i: cursor.index,
            playerCount,
            zoneCount,
          });
          cursor.index += 1;
          if (Date.now() - startedAt >= maxMs) break;
        }
        if (cursor.index > matchroomCount) cursor = { phase: "done", index: 0 };
        continue;
      }

      cursor = { phase: "done", index: 0 };
    }

    return {
      ok: true,
      done: cursor.phase === "done",
      cursor,
      superAdmin,
      password: DEMO_PASSWORD,
    };
  },
});

export const exportDemoData = query({
  args: {
    playerCount: v.optional(v.number()),
    zoneCount: v.optional(v.number()),
    teamCount: v.optional(v.number()),
    matchroomCount: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<DemoExport> => {
    const playerCount = args.playerCount ?? DEFAULT_PLAYER_COUNT;
    const zoneCount = args.zoneCount ?? DEFAULT_ZONE_COUNT;
    const teamCount = args.teamCount ?? DEFAULT_TEAM_COUNT;
    const matchroomCount = args.matchroomCount ?? DEFAULT_MATCHROOM_COUNT;

    const superEmail = buildEmail("super", 0);
    const superUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", superEmail))
      .unique();

    const playerUsers: any[] = [];
    for (let i = 1; i <= playerCount; i += 1) {
      const email = buildEmail("player", i);
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .unique();
      if (user) playerUsers.push(user);
    }

    const zoneAdminUsers: any[] = [];
    for (let i = 1; i <= zoneCount; i += 1) {
      const email = buildEmail("zone", i);
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .unique();
      if (user) zoneAdminUsers.push(user);
    }

    const zones: any[] = [];
    for (const admin of zoneAdminUsers) {
      const zone = await ctx.db
        .query("zones")
        .withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", admin._id))
        .unique();
      if (zone) zones.push(zone);
    }

    const teams: any[] = [];
    for (const player of playerUsers) {
      const owned = await ctx.db
        .query("teams")
        .withIndex("by_captainUid", (q: any) => q.eq("captainUid", player._id))
        .collect();
      for (const t of owned) teams.push(t);
      if (teams.length >= teamCount) break;
    }

    const matchrooms: any[] = [];
    for (const player of playerUsers) {
      const hosted = await ctx.db
        .query("matchrooms")
        .withIndex("by_hostUid", (q: any) => q.eq("hostUid", String(player._id)))
        .collect();
      for (const room of hosted) {
        if (String(room.matchCode || "").startsWith("DEMO_MR")) {
          matchrooms.push(room);
        }
      }
      if (matchrooms.length >= matchroomCount) break;
    }

    const playersExport = await Promise.all(
      playerUsers.map(async (u) => {
        const friendships = await ctx.db
          .query("friendships")
          .withIndex("by_userId", (q: any) => q.eq("userId", u._id))
          .collect();
        return {
          userId: String(u._id),
          authId: u.authId ? String(u.authId) : null,
          email: u.email,
          fullName: u.fullName,
          username: u.username,
          games: GAME_KEYS.filter((g) => doesUserPlayGameFromRecord(u, g)).map(String),
          skillScores: u.skillScores || null,
          steamProfileUrl: u.steamProfileUrl,
          faceitProfileUrl: u.faceitProfileUrl,
          friendCount: friendships.length,
        };
      })
    );

    const zoneAdminsExport = zoneAdminUsers.map((u) => {
      const zone = zones.find((z) => String(z.ownerUid) === String(u._id)) || null;
      return {
        userId: String(u._id),
        authId: u.authId ? String(u.authId) : null,
        email: u.email,
        fullName: u.fullName,
        username: u.username,
        zoneId: zone ? String(zone._id) : null,
        venueBrandName: zone ? String(zone.venueBrandName || zone.name || "") : null,
        city: zone ? String(zone.city || "") : null,
        branches: zone?.branches || [],
        games: zone?.games || [],
      };
    });

    return {
      password: DEMO_PASSWORD,
      superAdmin: superUser ? { email: superUser.email, username: superUser.username } : null,
      players: playersExport,
      zoneAdmins: zoneAdminsExport,
      teams: teams.map((t) => ({
        teamId: String(t._id),
        name: t.name,
        tag: t.tag,
        game: t.game,
        captainUid: String(t.captainUid),
        captainUsername: t.captainUsername,
        memberCount: t.memberCount,
        maxMembers: t.maxMembers,
        memberUids: (t.memberUids || []).map(String),
      })),
      matchrooms: matchrooms.map((r) => ({
        matchroomId: String(r._id),
        matchCode: r.matchCode ? String(r.matchCode) : null,
        title: r.title,
        game: r.game,
        hostUid: String(r.hostUid),
        hostName: r.hostName,
        zoneId: r.zoneId ? String(r.zoneId) : undefined,
        scheduledDate: r.scheduledDate,
        scheduledTime: r.scheduledTime,
        scheduledStartAt: r.scheduledStartAt,
        maxPlayers: r.maxPlayers,
        currentPlayers: r.currentPlayers,
        pricing: r.pricing,
      })),
    };
  },
});

export const removeDemoDataLegacy = mutation({
  args: {
    seedKey: v.string(),
    playerCount: v.optional(v.number()),
    zoneCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireSeedKey(args.seedKey);

    const playerCount = args.playerCount ?? DEFAULT_PLAYER_COUNT;
    const zoneCount = args.zoneCount ?? DEFAULT_ZONE_COUNT;

    const playerUsers: any[] = [];
    const zoneAdminUsers: any[] = [];

    for (let i = 1; i <= playerCount; i += 1) {
      const email = buildEmail("player", i);
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .unique();
      if (user) playerUsers.push(user);
    }

    for (let i = 1; i <= zoneCount; i += 1) {
      const email = buildEmail("zone", i);
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .unique();
      if (user) zoneAdminUsers.push(user);
    }

    const superEmail = buildEmail("super", 0);
    const superUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", superEmail))
      .unique();

    const demoUserIds = new Set<string>([
      ...playerUsers.map((u) => String(u._id)),
      ...zoneAdminUsers.map((u) => String(u._id)),
      ...(superUser ? [String(superUser._id)] : []),
    ]);

    const deleted: Record<string, number> = {};
    const bump = (key: string, n: number) => {
      deleted[key] = (deleted[key] || 0) + n;
    };

    // Zones + resources + pricing + zone matchrooms.
    for (const admin of zoneAdminUsers) {
      const zone = await ctx.db
        .query("zones")
        .withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", admin._id))
        .unique();
      if (!zone) continue;

      const rooms = await ctx.db
        .query("matchrooms")
        .withIndex("by_zoneId", (q: any) => q.eq("zoneId", String(zone._id)))
        .collect();

      const hasNonDemo = rooms.some((room: any) => {
        const hostUid = String(room.hostUid || "");
        return hostUid && !demoUserIds.has(hostUid);
      });
      if (hasNonDemo) {
        throw new Error(
          `Refusing to delete demo zone ${String(zone._id)} because it contains non-demo matchrooms.`
        );
      }

      const resources = await ctx.db
        .query("zoneResources")
        .withIndex("by_zoneId", (q: any) => q.eq("zoneId", zone._id))
        .collect();
      for (const r of resources) await ctx.db.delete(r._id);
      bump("zoneResources", resources.length);

      const rules = await ctx.db
        .query("pricingRules")
        .withIndex("by_zoneId", (q: any) => q.eq("zoneId", zone._id))
        .collect();
      for (const rule of rules) await ctx.db.delete(rule._id);
      bump("pricingRules", rules.length);

      for (const room of rooms) {
        await deleteMatchroomAndChat(ctx, room._id);
        bump("matchrooms", 1);
      }

      await ctx.db.delete(zone._id);
      bump("zones", 1);
    }

    // Any remaining demo-hosted matchrooms (e.g. broadcast).
    for (const player of playerUsers) {
      const hosted = await ctx.db
        .query("matchrooms")
        .withIndex("by_hostUid", (q: any) => q.eq("hostUid", String(player._id)))
        .collect();
      for (const room of hosted) {
        await deleteMatchroomAndChat(ctx, room._id);
        bump("matchrooms", 1);
      }
    }

    // Teams + members.
    for (const player of playerUsers) {
      const ownedTeams = await ctx.db
        .query("teams")
        .withIndex("by_captainUid", (q: any) => q.eq("captainUid", player._id))
        .collect();
      for (const team of ownedTeams) {
        const members = await ctx.db
          .query("teamMembers")
          .withIndex("by_teamId", (q: any) => q.eq("teamId", team._id))
          .collect();
        for (const member of members) await ctx.db.delete(member._id);
        bump("teamMembers", members.length);
        await ctx.db.delete(team._id);
        bump("teams", 1);
      }
    }

    // Social + notifications + push + chat membership.
    for (const userId of demoUserIds) {
      const friendships = await ctx.db
        .query("friendships")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId as any))
        .collect();
      for (const f of friendships) await ctx.db.delete(f._id);
      bump("friendships", friendships.length);

      const blocks = await ctx.db
        .query("userBlocks")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId as any))
        .collect();
      for (const b of blocks) await ctx.db.delete(b._id);
      bump("userBlocks", blocks.length);

      const toNotifs = await ctx.db
        .query("notifications")
        .withIndex("by_toUid", (q: any) => q.eq("toUid", userId as any))
        .collect();
      for (const n of toNotifs) await ctx.db.delete(n._id);
      bump("notifications", toNotifs.length);

      const fromNotifs = await ctx.db
        .query("notifications")
        .withIndex("by_fromUid", (q: any) => q.eq("fromUid", userId as any))
        .collect();
      for (const n of fromNotifs) await ctx.db.delete(n._id);
      bump("notifications", fromNotifs.length);

      const devices = await ctx.db
        .query("pushDevices")
        .withIndex("by_userId", (q: any) => q.eq("userId", userId as any))
        .collect();
      for (const d of devices) await ctx.db.delete(d._id);
      bump("pushDevices", devices.length);

      const memberships = await ctx.db
        .query("chatroomMembers")
        .withIndex("by_userId", (q: any) => q.eq("userId", String(userId)))
        .collect();
      for (const m of memberships) await ctx.db.delete(m._id);
      bump("chatroomMembers", memberships.length);
    }

    // Users.
    for (const u of [...playerUsers, ...zoneAdminUsers, ...(superUser ? [superUser] : [])]) {
      await ctx.db.delete(u._id);
      bump("users", 1);
    }

    // Better Auth cleanup.
    const authUsers = await listBetterAuthUsersByDomain(ctx, DEMO_DOMAIN);
    const authUserIds = authUsers.map((u: any) => String(u._id || u.id)).filter(Boolean);

    if (authUserIds.length > 0) {
      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: { model: "session", where: [{ field: "userId", operator: "in", value: authUserIds }] },
        paginationOpts: { cursor: null, numItems: 100000 },
      });

      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: { model: "account", where: [{ field: "userId", operator: "in", value: authUserIds }] },
        paginationOpts: { cursor: null, numItems: 100000 },
      });
    }

    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model: "verification", where: [{ field: "identifier", operator: "ends_with", value: DEMO_DOMAIN }] },
      paginationOpts: { cursor: null, numItems: 100000 },
    });

    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model: "user", where: [{ field: "email", operator: "ends_with", value: DEMO_DOMAIN }] },
      paginationOpts: { cursor: null, numItems: 100000 },
    });

    return { ok: true, deleted };
  },
});

type DemoRemoveCursor = {
  phase: "zones" | "zoneAdmins" | "players" | "super" | "auth" | "done";
  index: number;
};

function normalizeRemoveCursor(input: any): DemoRemoveCursor {
  const phase = String(input?.phase || "zones");
  const valid = new Set(["zones", "zoneAdmins", "players", "super", "auth", "done"]);
  const index = Number(input?.index || 1);
  return {
    phase: (valid.has(phase) ? phase : "zones") as DemoRemoveCursor["phase"],
    index: Number.isFinite(index) && index >= 1 ? Math.floor(index) : 1,
  };
}

export const removeDemoZoneByIndex = internalMutation({
  args: { seedKey: v.string(), i: v.number() },
  handler: async (ctx, args): Promise<any> => {
    requireSeedKey(args.seedKey);
    const i = Math.floor(args.i);

    const zoneAdminEmail = buildEmail("zone", i);
    const zoneAdmin = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", zoneAdminEmail))
      .unique();
    if (!zoneAdmin) return { ok: true, skipped: true };

    const zone = await ctx.db
      .query("zones")
      .withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", zoneAdmin._id))
      .unique();
    if (!zone) return { ok: true, skipped: true };

    const rooms = await ctx.db
      .query("matchrooms")
      .withIndex("by_zoneId", (q: any) => q.eq("zoneId", String(zone._id)))
      .collect();

    for (const room of rooms) {
      const hostUid = String(room.hostUid || "");
      if (!hostUid) continue;
      const host = await ctx.db.get(hostUid as any);
      if (host && typeof (host as any).email === "string" && !(host as any).email.endsWith(DEMO_DOMAIN)) {
        throw new Error(`Refusing to delete demo zone ${String(zone._id)}: found non-demo matchroom host.`);
      }
    }

    const resources = await ctx.db
      .query("zoneResources")
      .withIndex("by_zoneId", (q: any) => q.eq("zoneId", zone._id))
      .collect();
    for (const r of resources) await ctx.db.delete(r._id);

    const rules = await ctx.db
      .query("pricingRules")
      .withIndex("by_zoneId", (q: any) => q.eq("zoneId", zone._id))
      .collect();
    for (const rule of rules) await ctx.db.delete(rule._id);

    for (const room of rooms) {
      await deleteMatchroomAndChat(ctx, room._id);
    }

    await ctx.db.delete(zone._id);

    return {
      ok: true,
      deleted: {
        zoneResources: resources.length,
        pricingRules: rules.length,
        matchrooms: rooms.length,
        zones: 1,
      },
    };
  },
});

async function deleteUserSurfaceData(ctx: any, userId: any) {
  const deleted: Record<string, number> = {};
  const bump = (key: string, n: number) => {
    deleted[key] = (deleted[key] || 0) + n;
  };

  const friendships = await ctx.db
    .query("friendships")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId as any))
    .collect();
  for (const f of friendships) await ctx.db.delete(f._id);
  bump("friendships", friendships.length);

  const blocks = await ctx.db
    .query("userBlocks")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId as any))
    .collect();
  for (const b of blocks) await ctx.db.delete(b._id);
  bump("userBlocks", blocks.length);

  const toNotifs = await ctx.db
    .query("notifications")
    .withIndex("by_toUid", (q: any) => q.eq("toUid", userId as any))
    .collect();
  for (const n of toNotifs) await ctx.db.delete(n._id);
  bump("notifications", toNotifs.length);

  const fromNotifs = await ctx.db
    .query("notifications")
    .withIndex("by_fromUid", (q: any) => q.eq("fromUid", userId as any))
    .collect();
  for (const n of fromNotifs) await ctx.db.delete(n._id);
  bump("notifications", fromNotifs.length);

  const devices = await ctx.db
    .query("pushDevices")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId as any))
    .collect();
  for (const d of devices) await ctx.db.delete(d._id);
  bump("pushDevices", devices.length);

  const memberships = await ctx.db
    .query("chatroomMembers")
    .withIndex("by_userId", (q: any) => q.eq("userId", String(userId)))
    .collect();
  for (const m of memberships) await ctx.db.delete(m._id);
  bump("chatroomMembers", memberships.length);

  return deleted;
}

export const removeDemoZoneAdminByIndex = internalMutation({
  args: { seedKey: v.string(), i: v.number() },
  handler: async (ctx, args): Promise<any> => {
    requireSeedKey(args.seedKey);
    const i = Math.floor(args.i);

    const email = buildEmail("zone", i);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .unique();
    if (!user) return { ok: true, skipped: true };

    const deleted = await deleteUserSurfaceData(ctx, user._id);
    await ctx.db.delete(user._id);
    deleted.users = (deleted.users || 0) + 1;

    return { ok: true, deleted };
  },
});

export const removeDemoPlayerByIndex = internalMutation({
  args: { seedKey: v.string(), i: v.number() },
  handler: async (ctx, args): Promise<any> => {
    requireSeedKey(args.seedKey);
    const i = Math.floor(args.i);

    const email = buildEmail("player", i);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .unique();
    if (!user) return { ok: true, skipped: true };

    const deleted: Record<string, number> = {};
    const bump = (key: string, n: number) => {
      deleted[key] = (deleted[key] || 0) + n;
    };

    const hosted = await ctx.db
      .query("matchrooms")
      .withIndex("by_hostUid", (q: any) => q.eq("hostUid", String(user._id)))
      .collect();
    const demoHosted = hosted.filter((r: any) => String(r.matchCode || "").startsWith("DEMO_MR"));
    for (const room of demoHosted) {
      await deleteMatchroomAndChat(ctx, room._id);
    }
    bump("matchrooms", demoHosted.length);

    const ownedTeams = await ctx.db
      .query("teams")
      .withIndex("by_captainUid", (q: any) => q.eq("captainUid", user._id))
      .collect();
    for (const team of ownedTeams) {
      const members = await ctx.db
        .query("teamMembers")
        .withIndex("by_teamId", (q: any) => q.eq("teamId", team._id))
        .collect();
      for (const member of members) await ctx.db.delete(member._id);
      bump("teamMembers", members.length);
      await ctx.db.delete(team._id);
      bump("teams", 1);
    }

    const surfaces = await deleteUserSurfaceData(ctx, user._id);
    for (const [k, n] of Object.entries(surfaces)) bump(k, n);

    await ctx.db.delete(user._id);
    bump("users", 1);

    return { ok: true, deleted };
  },
});

export const removeDemoSuperAdmin = internalMutation({
  args: { seedKey: v.string() },
  handler: async (ctx, args): Promise<any> => {
    requireSeedKey(args.seedKey);
    const email = buildEmail("super", 0);
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .unique();
    if (!user) return { ok: true, skipped: true };
    const deleted = await deleteUserSurfaceData(ctx, user._id);
    await ctx.db.delete(user._id);
    deleted.users = (deleted.users || 0) + 1;
    return { ok: true, deleted };
  },
});

export const removeDemoBetterAuthCleanup = internalMutation({
  args: { seedKey: v.string() },
  handler: async (ctx, args): Promise<any> => {
    requireSeedKey(args.seedKey);

    const authUsers = await listBetterAuthUsersByDomain(ctx, DEMO_DOMAIN);
    const authUserIds = authUsers.map((u: any) => String(u._id || u.id)).filter(Boolean);

    if (authUserIds.length > 0) {
      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: { model: "session", where: [{ field: "userId", operator: "in", value: authUserIds }] },
        paginationOpts: { cursor: null, numItems: 100000 },
      });

      await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
        input: { model: "account", where: [{ field: "userId", operator: "in", value: authUserIds }] },
        paginationOpts: { cursor: null, numItems: 100000 },
      });
    }

    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model: "verification", where: [{ field: "identifier", operator: "ends_with", value: DEMO_DOMAIN }] },
      paginationOpts: { cursor: null, numItems: 100000 },
    });

    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model: "user", where: [{ field: "email", operator: "ends_with", value: DEMO_DOMAIN }] },
      paginationOpts: { cursor: null, numItems: 100000 },
    });

    return { ok: true, deletedAuthUsers: authUserIds.length };
  },
});

export const removeDemoData = action({
  args: {
    seedKey: v.string(),
    cursor: v.optional(v.any()),
    playerCount: v.optional(v.number()),
    zoneCount: v.optional(v.number()),
    batchSize: v.optional(v.number()),
    maxMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    requireSeedKey(args.seedKey);

    const playerCount = args.playerCount ?? DEFAULT_PLAYER_COUNT;
    const zoneCount = args.zoneCount ?? DEFAULT_ZONE_COUNT;
    const batchSize = clamp(Math.floor(args.batchSize ?? 1), 1, 10);
    const maxMs = clamp(Math.floor(args.maxMs ?? 15_000), 1_000, 120_000);

    const startedAt = Date.now();
    let cursor = normalizeRemoveCursor(args.cursor);
    const internalAny = (await import("./_generated/api")).internal as any;

    while (Date.now() - startedAt < maxMs && cursor.phase !== "done") {
      if (cursor.phase === "zones") {
        for (let k = 0; k < batchSize && cursor.index <= zoneCount; k += 1) {
          await ctx.runMutation(internalAny.demoSeed.removeDemoZoneByIndex, { seedKey: args.seedKey, i: cursor.index });
          cursor.index += 1;
          if (Date.now() - startedAt >= maxMs) break;
        }
        if (cursor.index > zoneCount) cursor = { phase: "zoneAdmins", index: 1 };
        continue;
      }

      if (cursor.phase === "zoneAdmins") {
        for (let k = 0; k < batchSize && cursor.index <= zoneCount; k += 1) {
          await ctx.runMutation(internalAny.demoSeed.removeDemoZoneAdminByIndex, { seedKey: args.seedKey, i: cursor.index });
          cursor.index += 1;
          if (Date.now() - startedAt >= maxMs) break;
        }
        if (cursor.index > zoneCount) cursor = { phase: "players", index: 1 };
        continue;
      }

      if (cursor.phase === "players") {
        for (let k = 0; k < batchSize && cursor.index <= playerCount; k += 1) {
          await ctx.runMutation(internalAny.demoSeed.removeDemoPlayerByIndex, { seedKey: args.seedKey, i: cursor.index });
          cursor.index += 1;
          if (Date.now() - startedAt >= maxMs) break;
        }
        if (cursor.index > playerCount) cursor = { phase: "super", index: 1 };
        continue;
      }

      if (cursor.phase === "super") {
        await ctx.runMutation(internalAny.demoSeed.removeDemoSuperAdmin, { seedKey: args.seedKey });
        cursor = { phase: "auth", index: 1 };
        continue;
      }

      if (cursor.phase === "auth") {
        await ctx.runMutation(internalAny.demoSeed.removeDemoBetterAuthCleanup, { seedKey: args.seedKey });
        cursor = { phase: "done", index: 0 };
        continue;
      }

      cursor = { phase: "done", index: 0 };
    }

    return { ok: true, done: cursor.phase === "done", cursor };
  },
});

async function listBetterAuthUsersByDomain(ctx: any, domainSuffix: string) {
  const results: any[] = [];
  let cursor: string | null = null;
  while (true) {
    const batch: any = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      where: [{ field: "email", operator: "ends_with", value: domainSuffix }],
      paginationOpts: { cursor, numItems: 200 },
    });

    const items = Array.isArray((batch as any)?.items)
      ? (batch as any).items
      : Array.isArray(batch)
        ? batch
        : [];

    results.push(...items);

    const next: any = (batch as any)?.continueCursor ?? (batch as any)?.nextCursor ?? null;
    if (!next || items.length === 0) break;
    cursor = next;
  }
  return results;
}

async function deleteMatchroomAndChat(ctx: any, matchroomId: any) {
  const chatrooms = await ctx.db
    .query("chatrooms")
    .withIndex("by_matchroomId", (q: any) => q.eq("matchroomId", matchroomId))
    .collect();

  for (const chat of chatrooms) {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_chatroomId", (q: any) => q.eq("chatroomId", chat._id))
      .collect();
    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    const members = await ctx.db
      .query("chatroomMembers")
      .withIndex("by_chatroomId", (q: any) => q.eq("chatroomId", chat._id))
      .collect();
    for (const m of members) {
      await ctx.db.delete(m._id);
    }

    await ctx.db.delete(chat._id);
  }

  await ctx.db.delete(matchroomId);
}

// ============================================================================
// Karachi realistic demo seed (2026)
// ============================================================================

type KarachiRealisticSeedCursor = {
  phase: "players" | "zones" | "done";
  index: number;
};

function normalizeKarachiRealisticCursor(input: any): KarachiRealisticSeedCursor {
  const phase = String(input?.phase || "players");
  const validPhases = new Set(["players", "zones", "done"]);
  const index = Number(input?.index || 1);
  return {
    phase: (validPhases.has(phase) ? phase : "players") as KarachiRealisticSeedCursor["phase"],
    index: Number.isFinite(index) && index >= 1 ? Math.floor(index) : 1,
  };
}

function isDemoEmail(email: string) {
  return String(email || "").trim().toLowerCase().endsWith(KARACHI_REALISTIC_EMAIL_DOMAIN);
}

function clampInt(value: unknown, min: number, max: number) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function normalizePlayerFullName(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .replace(/[^\p{L}\s.'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function normalizePlayerUsername(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned.slice(0, 20);
}

function isValidUsername(value: string) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(value);
}

function toDemoEmailForSeed(inputEmail: unknown, rowIndex: number) {
  const raw = String(inputEmail || "").trim().toLowerCase();
  const local = normalizeUsername(raw.split("@")[0] || "");
  const suffix = to3((rowIndex % 1000) || 1);
  const stableLocal = local.length >= 3 ? local : `demo_${suffix}`;
  return `${stableLocal}${stableLocal.endsWith(suffix) ? "" : `.${suffix}`}${KARACHI_REALISTIC_EMAIL_DOMAIN}`;
}

function buildPakistaniMobile03(seed: number) {
  const rand = mulberry32(123456 + seed);
  const line = 100000000 + Math.floor(rand() * 899999999);
  return `03${line}`;
}

function pickAgeRange(seed: number) {
  const ranges = ["13-17", "18-24", "25-34", "35+"] as const;
  return ranges[seed % ranges.length];
}

function gameKeyFromExcel(value: unknown): "cs2" | "cs16" | "valorant" | "fc26" | "tekken8" | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "cs2" || raw.includes("counter-strike 2")) return "cs2";
  if (raw.includes("cs 1.6") || raw.includes("cs1.6") || raw.includes("1.6")) return "cs16";
  if (raw.includes("valorant")) return "valorant";
  if (raw.includes("fc26") || raw.includes("fc 26")) return "fc26";
  if (raw.includes("tekken 8") || raw.includes("tekken8")) return "tekken8";
  return null;
}

function skillTierToRating(tier: unknown) {
  const raw = String(tier || "").trim().toLowerCase();
  if (!raw) return { tierLabel: "Casual", rating: 50 };
  if (raw === "beginner") return { tierLabel: "Beginner", rating: 35 };
  if (raw === "casual") return { tierLabel: "Casual", rating: 50 };
  if (raw === "intermediate") return { tierLabel: "Intermediate", rating: 65 };
  if (raw === "advanced") return { tierLabel: "Advanced", rating: 78 };
  if (raw === "semi-pro" || raw === "semi pro") return { tierLabel: "Semi-Pro", rating: 86 };
  if (raw === "pro") return { tierLabel: "Pro", rating: 92 };
  return { tierLabel: String(tier).slice(0, 40) || "Casual", rating: 55 };
}

async function ensureKarachiRealisticUser(ctx: any, input: {
  authId: string;
  email: string;
  fullName: string;
  username: string;
  phone: string;
  accountType: "player" | "zone";
  playerGameKey?: string | null;
  roleStyle?: string | null;
  skillTier?: string | null;
}) {
  const now = Date.now();
  const normalizedEmail = String(input.email || "").trim().toLowerCase();

  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", normalizedEmail))
    .unique();

  if (existing) {
    const existingIsDemo = !!(existing as any).isDemo || String((existing as any).seedSource || "") === KARACHI_REALISTIC_SEED_SOURCE;
    if (!existingIsDemo && !isDemoEmail(normalizedEmail)) {
      return { ok: false as const, skipped: true as const, reason: "existing_non_demo_email_conflict" as const };
    }

    await ctx.db.patch(existing._id, {
      authId: input.authId,
      isDemo: true,
      seedSource: KARACHI_REALISTIC_SEED_SOURCE,
      isVerified: true,
      phoneValidated: true,
      phoneOtpVerified: true,
      phoneOtpVerifiedAt: now,
      phoneValidationCheckedAt: now,
      kycVerificationStatus: "verified",
      kycVerifiedAt: now,
      emailVerificationStatus: "verified",
      emailVerifiedAt: now,
      phone: input.phone,
      fullName: input.fullName || existing.fullName,
      updatedAt: now,
    } as any);

    return { ok: true as const, userId: existing._id, created: false as const };
  }

  const usernameCandidates = Array.from(
    new Set([
      String(input.username || "").slice(0, 20),
      String(`${input.username}_${to3(Math.abs(hashString(normalizedEmail)) % 1000)}`).slice(0, 20),
      normalizeUsername(String(normalizedEmail).split("@")[0] || "").slice(0, 20),
    ])
  ).filter((u) => isValidUsername(u));

  let finalUsername = usernameCandidates[0] || `demo_${to3(Math.abs(hashString(normalizedEmail)) % 1000)}`;
  let finalLower = normalizeUsername(finalUsername);
  for (const candidate of usernameCandidates) {
    const lower = normalizeUsername(candidate);
    const collision = await ctx.db
      .query("users")
      .withIndex("by_usernameLower", (q: any) => q.eq("usernameLower", lower))
      .collect();
    if (collision.length === 0) {
      finalUsername = candidate;
      finalLower = lower;
      break;
    }
  }

  const areas = AREAS_BY_CITY.Karachi || ["Gulshan-e-Iqbal"];
  const rand = mulberry32(Math.abs(hashString(normalizedEmail)) % 100000);
  const preferredAreas = Array.from(new Set([pick(rand, areas), pick(rand, areas), pick(rand, areas)])).slice(0, 5);

  const base: Record<string, any> = {
    authId: input.authId,
    email: normalizedEmail,
    fullName: input.fullName,
    username: finalUsername,
    usernameLower: finalLower,
    phone: input.phone,
    phoneValidated: true,
    phoneOtpVerified: true,
    phoneOtpVerifiedAt: now,
    phoneValidationCheckedAt: now,
    accountType: input.accountType,
    isOnline: false,
    isVerified: true,
    isDemo: true,
    seedSource: KARACHI_REALISTIC_SEED_SOURCE,
    kycVerificationStatus: "verified",
    kycVerifiedAt: now,
    emailVerificationStatus: "verified",
    emailVerifiedAt: now,
    onboardingCompleted: true,
    onboardingStep: 4,
    city: "Karachi",
    areasPreferred: preferredAreas,
    ageRange: pickAgeRange(Math.abs(hashString(normalizedEmail))),
    createdAt: now,
    updatedAt: now,
  };

  if (input.accountType === "player") {
    const game = input.playerGameKey || null;
    base.playsCs2 = game === "cs2";
    base.playsCs16 = game === "cs16";
    base.playsValorant = game === "valorant";
    base.playsFc = game === "fc26";
    base.playsTekken = game === "tekken8";

    if (game === "cs2" && input.roleStyle) base.cs2Role = String(input.roleStyle).slice(0, 40);
    if (game === "cs16" && input.roleStyle) base.cs16Role = String(input.roleStyle).slice(0, 40);
    if (game === "valorant" && input.roleStyle) base.valorantRole = String(input.roleStyle).slice(0, 40);

    const { tierLabel, rating } = skillTierToRating(input.skillTier);
    const key =
      game === "cs2"
        ? "cs2"
        : game === "cs16"
          ? "cs16"
          : game === "valorant"
            ? "valorant"
            : game === "fc26"
              ? "fc26"
              : game === "tekken8"
                ? "tekken8"
                : null;
    if (key) {
      base.skillScores = {
        [key]: {
          rating,
          tier: tierLabel,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          lastMatchDate: null,
          lastUpdated: now,
        },
      };
    }
  }

  const userId = await ctx.db.insert("users", base as any);
  return { ok: true as const, userId, created: true as const };
}

async function ensureKarachiRealisticBetterAuth(ctx: any, input: {
  email: string;
  fullName: string;
  username: string;
  phone: string;
}) {
  const auth = await ensureBetterAuthUser(ctx, {
    email: input.email,
    name: input.fullName,
    username: input.username,
    phone: input.phone,
    passwordPlaintext: KARACHI_REALISTIC_PASSWORD,
    forceCredentialPassword: true,
    phoneNumberVerified: true,
  });
  return auth;
}

export const seedKarachiRealisticPlayerByIndex = internalMutation({
  args: { seedKey: v.string(), i: v.number(), player: v.any() },
  handler: async (ctx, args): Promise<any> => {
    requireSeedKey(args.seedKey);

    const i = Math.floor(args.i);
    const row = args.player || {};

    const city = String(row.city || row.City || "").trim();
    const country = String(row.country || row.Country || "").trim();
    if (city !== "Karachi" || country !== "Pakistan") {
      return { ok: true, skipped: true, reason: "invalid_city_or_country" };
    }

    const email = toDemoEmailForSeed(row.email || row["Email (Demo)"] || row.Email, i);
    const fullName = normalizePlayerFullName(row.fullName || row["Player Name"] || row.playerName || row.name) || `Demo Player ${to3(i)}`;
    const usernameRaw = normalizePlayerUsername(row.username || row.Username) || normalizeUsername(email.split("@")[0] || "");
    const username = isValidUsername(usernameRaw) ? usernameRaw : `demo_${to3(i)}`;
    const phone = buildPakistaniMobile03(10000 + i);

    const gameKey = gameKeyFromExcel(row.game || row.Game);
    const roleStyle = String(row.roleStyle || row["Preferred Role / Style"] || row.role || row.style || "").trim() || null;
    const skillTier = String(row.skillTier || row["Skill Tier"] || "").trim() || null;

    const auth = await ensureKarachiRealisticBetterAuth(ctx, { email, fullName, username, phone });

    const ensured = await ensureKarachiRealisticUser(ctx, {
      authId: auth.authUserId,
      email,
      fullName,
      username: auth.username,
      phone,
      accountType: "player",
      playerGameKey: gameKey,
      roleStyle,
      skillTier,
    });

    if (!ensured.ok) return ensured;

    return { ok: true, userId: String(ensured.userId), created: ensured.created };
  },
});

const KARACHI_ZONE_BRANDS = [
  "Gaming Nexus",
  "ManCave",
  "Cyber Xtreme Gaming Arena",
  "ROG",
  "DEVILIAN'Z",
  "Penguin Esports",
  "O2 Esports",
  "Arcadium",
  "Nuke Town",
] as const;

function buildKarachiZoneVenueName(i: number, areaLabel: string) {
  const brand = KARACHI_ZONE_BRANDS[(i - 1) % KARACHI_ZONE_BRANDS.length];
  return `${brand} - ${areaLabel}`.slice(0, 80);
}

function buildBranchIdFrom(zoneKey: string, branchName: string) {
  const raw = `${zoneKey}::${branchName}`;
  return `kr_${to3(Math.abs(hashString(raw)) % 1000)}_${to3(Math.abs(hashString(raw + "_b")) % 1000)}`;
}

function buildKarachiBranchPricing(i: number) {
  const rand = mulberry32(99000 + i);
  const pcRegularCount = String(5 + Math.floor(rand() * 16)); // 5-20
  const pcPremiumCount = String(3 + Math.floor(rand() * 10)); // 3-12
  const pcEliteCount = String(1 + Math.floor(rand() * 8)); // 1-8
  const pcRegularPrice = String(250 + Math.floor(rand() * 151)); // 250-400
  const pcPremiumPrice = String(400 + Math.floor(rand() * 301)); // 400-700
  const pcElitePrice = String(700 + Math.floor(rand() * 501)); // 700-1200

  const consoleRegularCount = String(1 + Math.floor(rand() * 4)); // 1-4
  const consolePremiumCount = String(1 + Math.floor(rand() * 3)); // 1-3
  const consoleEliteCount = String(1 + Math.floor(rand() * 2)); // 1-2

  const reg1v1 = String(500 + Math.floor(rand() * 301)); // 500-800
  const reg2v2 = String(700 + Math.floor(rand() * 501)); // 700-1200
  const prem1v1 = String(800 + Math.floor(rand() * 401)); // 800-1200
  const prem2v2 = String(1200 + Math.floor(rand() * 601)); // 1200-1800
  const elite1v1 = String(1200 + Math.floor(rand() * 601)); // 1200-1800
  const elite2v2 = String(1800 + Math.floor(rand() * 701)); // 1800-2500

  return {
    pc: {
      regular: { count: pcRegularCount, price: pcRegularPrice },
      premium: { count: pcPremiumCount, price: pcPremiumPrice },
      elite: { count: pcEliteCount, price: pcElitePrice },
    },
    console: {
      regular: { count: consoleRegularCount, price1v1: reg1v1, price2v2: reg2v2 },
      premium: { count: consolePremiumCount, price1v1: prem1v1, price2v2: prem2v2 },
      elite: { count: consoleEliteCount, price1v1: elite1v1, price2v2: elite2v2 },
    },
  };
}

function buildKarachiBranchSpecs() {
  return {
    pcSpecs: {
      regular: { cpu: "Core i5 / Ryzen 5", gpu: "GTX 1660 / RTX 2060", monitorRefreshRate: "144Hz" },
      premium: { cpu: "Core i7 / Ryzen 7", gpu: "RTX 3060 / RTX 4060", monitorRefreshRate: "165Hz / 180Hz" },
      elite: { cpu: "Core i7/i9 or Ryzen 7/9", gpu: "RTX 4070 / RTX 4080", monitorRefreshRate: "240Hz" },
    },
    specs: "Gaming chairs, high-speed internet, and UPS backup.",
  };
}

function buildKarachiAggregateCapacity(branches: any[]) {
  const toPositive = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  return (branches || []).reduce(
    (acc, branch) => {
      const pricing = branch?.pricing || {};
      const pc = pricing.pc || {};
      const consolePricing = pricing.console || {};

      acc.pcSeats +=
        toPositive(pc.regular?.count) + toPositive(pc.premium?.count) + toPositive(pc.elite?.count);
      acc.consoleSeats +=
        toPositive(consolePricing.regular?.count) +
        toPositive(consolePricing.premium?.count) +
        toPositive(consolePricing.elite?.count) +
        toPositive(consolePricing.ps5?.count) +
        toPositive(consolePricing.xbox?.count);

      return acc;
    },
    { pcSeats: 0, consoleSeats: 0 },
  );
}

export const seedKarachiRealisticZoneByIndex = internalMutation({
  args: { seedKey: v.string(), i: v.number() },
  handler: async (ctx, args): Promise<any> => {
    requireSeedKey(args.seedKey);

    const now = Date.now();
    const i = Math.floor(args.i);
    const areas = AREAS_BY_CITY.Karachi || ["Gulshan-e-Iqbal"];
    const areaLabel = areas[(i - 1) % areas.length];
    const venueBrandName = buildKarachiZoneVenueName(i, areaLabel);
    const zoneKey = normalizeUsername(venueBrandName);

    const adminEmail = `${zoneKey}.${to3(i)}${KARACHI_REALISTIC_EMAIL_DOMAIN}`;
    const adminFullName = `Owner ${venueBrandName}`.slice(0, 60);
    const baseUsername = normalizeUsername(zoneKey).slice(0, 16) || "zone";
    const adminUsername = `${baseUsername}_${to3(i)}`.slice(0, 20);
    const adminPhone = buildPakistaniMobile03(50000 + i);

    const auth = await ensureKarachiRealisticBetterAuth(ctx, {
      email: adminEmail,
      fullName: adminFullName,
      username: adminUsername,
      phone: adminPhone,
    });

    const ensuredAdmin = await ensureKarachiRealisticUser(ctx, {
      authId: auth.authUserId,
      email: adminEmail,
      fullName: adminFullName,
      username: auth.username,
      phone: adminPhone,
      accountType: "zone",
    });

    if (!ensuredAdmin.ok) return ensuredAdmin;

    const existingZone = await ctx.db
      .query("zones")
      .withIndex("by_ownerUid", (q: any) => q.eq("ownerUid", ensuredAdmin.userId))
      .unique();

    const branchCount = (i % 3 === 0) ? 2 : 1;
    const branches = Array.from({ length: branchCount }, (_, idx) => {
      const branchDisplayName = idx === 0 ? "Main Branch" : "Branch 2";
      const addressLine1 = `${10 + (i % 80)} ${areaLabel}, Karachi`;
      const googleMapsUrl = `https://maps.google.com/?q=${encodeURIComponent(addressLine1)}`;
      const pricing = buildKarachiBranchPricing(i * 10 + idx);
      const specs = buildKarachiBranchSpecs();
      return {
        id: buildBranchIdFrom(zoneKey, branchDisplayName),
        branchDisplayName,
        name: branchDisplayName,
        city: "Karachi",
        areaLabel,
        addressLine1,
        googleMapsUrl,
        contactPhone: buildPakistaniMobile03(70000 + i * 5 + idx),
        supportsCs2: true,
        supportsFc25: true,
        supportsTekken8: true,
        supportsFutsal: false,
        supportsIndoorCricket: false,
        supportsPadel: false,
        supportsPickleball: false,
        pricing,
        ...specs,
        notes: "Walk-ins welcome. Booking recommended on weekends.",
        source: "seed",
        isActive: true,
        isDemo: true,
        seedSource: KARACHI_REALISTIC_SEED_SOURCE,
        resourceModelVersion: 0,
      };
    });

    const zoneDoc: any = {
      ownerUid: ensuredAdmin.userId,
      ownerUsername: auth.username,
      ownerFullName: adminFullName,
      name: venueBrandName,
      venueBrandName,
      contactEmail: adminEmail,
      contactPhone: adminPhone,
      type: "gaming",
      status: "active",
      onboardingStep: 4,
      description: `A Karachi gaming zone with PC and console setups.`,
      address: branches[0]?.addressLine1,
      city: "Karachi",
      phone: adminPhone,
      isDemo: true,
      seedSource: KARACHI_REALISTIC_SEED_SOURCE,
      games: ["cs2", "fc26", "tekken8"],
      branches,
      primaryBranch: {
        branchDisplayName: branches[0]?.branchDisplayName,
        city: "Karachi",
        areaLabel,
        addressLine1: branches[0]?.addressLine1,
        googleMapsUrl: branches[0]?.googleMapsUrl,
      },
      capacity: buildKarachiAggregateCapacity(branches),
      pricing: branches[0]?.pricing,
      defaultPricing: { hourlyRate: 350, currency: DEFAULT_CURRENCY },
      approvedAt: now,
      createdAt: existingZone ? existingZone.createdAt : now,
      updatedAt: now,
    };

    let zoneId: any = null;
    if (existingZone) {
      // Merge branches by id for idempotency.
      const existingBranches = Array.isArray((existingZone as any).branches) ? (existingZone as any).branches : [];
      const mergedById = new Map<string, any>();
      for (const b of existingBranches) mergedById.set(String(b?.id || ""), b);
      for (const b of branches) mergedById.set(String(b?.id || ""), b);
      zoneDoc.branches = Array.from(mergedById.values()).filter((b) => b && b.id);

      await ctx.db.patch(existingZone._id, zoneDoc);
      zoneId = existingZone._id;
    } else {
      zoneId = await ctx.db.insert("zones", zoneDoc);
    }

    // Seed a small number of resources per branch (idempotent by name per branch).
    const createdResources: string[] = [];
    for (const b of branches) {
      const branchId = String(b.id);
      const existing = await ctx.db
        .query("zoneResources")
        .withIndex("by_zoneId_and_branchId", (q: any) => q.eq("zoneId", zoneId).eq("branchId", branchId))
        .collect();
      const existingNames = new Set(existing.map((r: any) => String(r.name)));

      const pc = b.pricing?.pc;
      const consolePricing = b.pricing?.console;
      const pcTiers: Array<{ tier: string; count: number; price: number }> = [
        { tier: "regular", count: Number(pc?.regular?.count || 0), price: Number(pc?.regular?.price || 0) },
        { tier: "premium", count: Number(pc?.premium?.count || 0), price: Number(pc?.premium?.price || 0) },
        { tier: "elite", count: Number(pc?.elite?.count || 0), price: Number(pc?.elite?.price || 0) },
      ].filter((t) => t.count > 0 && t.price > 0);

      for (const t of pcTiers) {
        for (let seat = 1; seat <= Math.min(t.count, 2); seat += 1) {
          const name = `PC ${t.tier.toUpperCase()}-${seat}`;
          if (existingNames.has(name)) continue;
          await ctx.db.insert("zoneResources", {
            zoneId,
            branchId,
            kind: "seat",
            name,
            assetType: "pc",
            tier: t.tier,
            surface: "pc",
            roomLabel: "PC Hall",
            capacity: 1,
            hourlyRate: t.price,
            lifecycleStatus: "available",
            isActive: true,
            isDemo: true,
            seedSource: KARACHI_REALISTIC_SEED_SOURCE,
            createdAt: now,
            updatedAt: now,
          } as any);
          existingNames.add(name);
          createdResources.push(name);
        }
      }

      const cTiers: Array<{ tier: string; count: number; price1v1: number }> = [
        { tier: "regular", count: Number(consolePricing?.regular?.count || 0), price1v1: Number(consolePricing?.regular?.price1v1 || 0) },
        { tier: "premium", count: Number(consolePricing?.premium?.count || 0), price1v1: Number(consolePricing?.premium?.price1v1 || 0) },
        { tier: "elite", count: Number(consolePricing?.elite?.count || 0), price1v1: Number(consolePricing?.elite?.price1v1 || 0) },
      ].filter((t) => t.count > 0 && t.price1v1 > 0);

      for (const t of cTiers) {
        for (let unit = 1; unit <= Math.min(t.count, 1); unit += 1) {
          const name = `CONSOLE ${t.tier.toUpperCase()}-${unit}`;
          if (existingNames.has(name)) continue;
          await ctx.db.insert("zoneResources", {
            zoneId,
            branchId,
            kind: "seat",
            name,
            assetType: "console",
            tier: t.tier,
            surface: "ps5",
            roomLabel: "Console Room",
            capacity: 2,
            hourlyRate: t.price1v1,
            lifecycleStatus: "available",
            isActive: true,
            isDemo: true,
            seedSource: KARACHI_REALISTIC_SEED_SOURCE,
            createdAt: now,
            updatedAt: now,
          } as any);
          existingNames.add(name);
          createdResources.push(name);
        }
      }
    }

    return {
      ok: true,
      adminUserId: String(ensuredAdmin.userId),
      zoneId: String(zoneId),
      createdZone: !existingZone,
      resourcesCreated: createdResources.length,
      branchCount: branches.length,
    };
  },
});

export const seedKarachiRealisticDemo = action({
  args: {
    seedKey: v.string(),
    cursor: v.optional(v.any()),
    players: v.array(v.any()),
    zoneCount: v.optional(v.number()),
    batchSize: v.optional(v.number()),
    maxMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    requireSeedKey(args.seedKey);

    const zoneCount = clampInt(args.zoneCount ?? 50, 1, 200);
    const batchSize = clampInt(args.batchSize ?? 2, 1, 10);
    const maxMs = clampInt(args.maxMs ?? 15_000, 1_000, 120_000);

    const startedAt = Date.now();
    let cursor = normalizeKarachiRealisticCursor(args.cursor);

    const internalAny = (await import("./_generated/api")).internal as any;

    const counts = {
      playersCreated: 0,
      playersUpdated: 0,
      playersSkipped: 0,
      zonesCreated: 0,
      zonesUpdated: 0,
      zoneAdmins: 0,
      branches: 0,
      resourcesCreated: 0,
    };

    while (Date.now() - startedAt < maxMs && cursor.phase !== "done") {
      if (cursor.phase === "players") {
        for (let k = 0; k < batchSize && cursor.index <= args.players.length; k += 1) {
          const player = args.players[cursor.index - 1];
          const res = await ctx.runMutation(internalAny.demoSeed.seedKarachiRealisticPlayerByIndex, {
            seedKey: args.seedKey,
            i: cursor.index,
            player,
          });
          if (res?.created) counts.playersCreated += 1;
          else if (res?.ok && !res?.skipped) counts.playersUpdated += 1;
          else counts.playersSkipped += 1;
          cursor.index += 1;
          if (Date.now() - startedAt >= maxMs) break;
        }
        if (cursor.index > args.players.length) cursor = { phase: "zones", index: 1 };
        continue;
      }

      if (cursor.phase === "zones") {
        for (let k = 0; k < batchSize && cursor.index <= zoneCount; k += 1) {
          const res = await ctx.runMutation(internalAny.demoSeed.seedKarachiRealisticZoneByIndex, {
            seedKey: args.seedKey,
            i: cursor.index,
          });
          if (res?.createdZone) counts.zonesCreated += 1;
          else if (res?.ok) counts.zonesUpdated += 1;
          if (res?.ok) counts.zoneAdmins += 1;
          counts.branches += Number(res?.branchCount || 0);
          counts.resourcesCreated += Number(res?.resourcesCreated || 0);
          cursor.index += 1;
          if (Date.now() - startedAt >= maxMs) break;
        }
        if (cursor.index > zoneCount) cursor = { phase: "done", index: 0 };
        continue;
      }

      cursor = { phase: "done", index: 0 };
    }

    return {
      ok: true,
      done: cursor.phase === "done",
      cursor,
      counts,
      password: KARACHI_REALISTIC_PASSWORD,
      seedSource: KARACHI_REALISTIC_SEED_SOURCE,
    };
  },
});

type KarachiRealisticRemoveCursor = {
  phase: "auth" | "zoneResources" | "zones" | "zoneAdmins" | "players" | "done";
};

function normalizeKarachiRealisticRemoveCursor(input: any): KarachiRealisticRemoveCursor {
  const phase = String(input?.phase || "auth");
  const validPhases = new Set(["auth", "zoneResources", "zones", "zoneAdmins", "players", "done"]);
  return {
    phase: (validPhases.has(phase) ? phase : "auth") as KarachiRealisticRemoveCursor["phase"],
  };
}

const KARACHI_REMOVE_PHASES: KarachiRealisticRemoveCursor["phase"][] = [
  "auth",
  "zoneResources",
  "zones",
  "zoneAdmins",
  "players",
  "done",
];

function nextKarachiRemovePhase(phase: KarachiRealisticRemoveCursor["phase"]) {
  const idx = KARACHI_REMOVE_PHASES.indexOf(phase);
  return idx >= 0 && idx + 1 < KARACHI_REMOVE_PHASES.length ? KARACHI_REMOVE_PHASES[idx + 1] : "done";
}

export const removeKarachiRealisticDemoStep = internalMutation({
  args: { seedKey: v.string(), phase: v.string(), batchSize: v.number() },
  handler: async (ctx, args): Promise<any> => {
    requireSeedKey(args.seedKey);

    const phase = String(args.phase || "auth");
    const batchSize = clampInt(args.batchSize, 1, 500);
    const deleted: Record<string, number> = {};
    const bump = (key: string, n: number) => {
      deleted[key] = (deleted[key] || 0) + n;
    };

    if (phase === "auth") {
      const seedUsers = await ctx.db
        .query("users")
        .withIndex("by_seedSource", (q: any) => q.eq("seedSource", KARACHI_REALISTIC_SEED_SOURCE))
        .collect();

      const authUserIds = seedUsers
        .map((u: any) => String(u.authId || ""))
        .filter(Boolean);

      const authEmails = seedUsers
        .map((u: any) => String(u.email || ""))
        .filter((e: string) => e && isDemoEmail(e));

      if (authUserIds.length > 0) {
        await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
          input: { model: "session", where: [{ field: "userId", operator: "in", value: authUserIds }] },
          paginationOpts: { cursor: null, numItems: 100000 },
        });

        await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
          input: { model: "account", where: [{ field: "userId", operator: "in", value: authUserIds }] },
          paginationOpts: { cursor: null, numItems: 100000 },
        });

        await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
          input: { model: "user", where: [{ field: "_id", operator: "in", value: authUserIds }] },
          paginationOpts: { cursor: null, numItems: 100000 },
        });
      }

      if (authEmails.length > 0) {
        await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
          input: { model: "verification", where: [{ field: "identifier", operator: "in", value: authEmails }] },
          paginationOpts: { cursor: null, numItems: 100000 },
        });
      }

      bump("betterAuthUsers", authUserIds.length);
      return { ok: true, phaseDone: true, deleted };
    }

    if (phase === "zoneResources") {
      const resources = await ctx.db
        .query("zoneResources")
        .withIndex("by_seedSource", (q: any) => q.eq("seedSource", KARACHI_REALISTIC_SEED_SOURCE))
        .order("desc")
        .take(batchSize);
      for (const r of resources) await ctx.db.delete(r._id);
      bump("zoneResources", resources.length);
      return { ok: true, phaseDone: resources.length < batchSize, deleted };
    }

    if (phase === "zones") {
      const zones = await ctx.db
        .query("zones")
        .withIndex("by_seedSource", (q: any) => q.eq("seedSource", KARACHI_REALISTIC_SEED_SOURCE))
        .order("desc")
        .take(batchSize);
      for (const z of zones) await ctx.db.delete(z._id);
      bump("zones", zones.length);
      return { ok: true, phaseDone: zones.length < batchSize, deleted };
    }

    if (phase === "zoneAdmins") {
      const admins = await ctx.db
        .query("users")
        .withIndex("by_seedSource", (q: any) => q.eq("seedSource", KARACHI_REALISTIC_SEED_SOURCE))
        .filter((q: any) => q.eq(q.field("accountType"), "zone"))
        .order("desc")
        .take(batchSize);
      for (const u of admins) await ctx.db.delete(u._id);
      bump("zoneAdmins", admins.length);
      return { ok: true, phaseDone: admins.length < batchSize, deleted };
    }

    if (phase === "players") {
      const players = await ctx.db
        .query("users")
        .withIndex("by_seedSource", (q: any) => q.eq("seedSource", KARACHI_REALISTIC_SEED_SOURCE))
        .filter((q: any) => q.eq(q.field("accountType"), "player"))
        .order("desc")
        .take(batchSize);
      for (const u of players) await ctx.db.delete(u._id);
      bump("players", players.length);
      return { ok: true, phaseDone: players.length < batchSize, deleted };
    }

    return { ok: true, phaseDone: true, deleted };
  },
});

export const removeKarachiRealisticDemo = action({
  args: {
    seedKey: v.string(),
    cursor: v.optional(v.any()),
    batchSize: v.optional(v.number()),
    maxMs: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<any> => {
    requireSeedKey(args.seedKey);

    const batchSize = clampInt(args.batchSize ?? 200, 1, 500);
    const maxMs = clampInt(args.maxMs ?? 15_000, 1_000, 120_000);

    const startedAt = Date.now();
    let cursor = normalizeKarachiRealisticRemoveCursor(args.cursor);

    const deleted: Record<string, number> = {};

    const internalAny = (await import("./_generated/api")).internal as any;

    while (Date.now() - startedAt < maxMs && cursor.phase !== "done") {
      const res = await ctx.runMutation(internalAny.demoSeed.removeKarachiRealisticDemoStep, {
        seedKey: args.seedKey,
        phase: cursor.phase,
        batchSize,
      });

      for (const [k, n] of Object.entries(res?.deleted || {})) {
        deleted[k] = (deleted[k] || 0) + Number(n || 0);
      }

      if (res?.phaseDone) {
        cursor = { phase: nextKarachiRemovePhase(cursor.phase) };
      }
    }

    return { ok: true, done: cursor.phase === "done", cursor, deleted, seedSource: KARACHI_REALISTIC_SEED_SOURCE };
  },
});
