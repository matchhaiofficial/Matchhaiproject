// src/services/convex/teamMatchService.ts
// Convex-based team match challenge service

import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { currentUser, ensureVerifiedEmailAccess } from "./authService";
import { createMatchroom } from "./matchService";
import Logger from "../../utils/logger";
import { parseScheduledDateTime } from "../../utils/matchroomTime";
import { getTeamMainRosterSize } from "../../constants/teamRosterRules";

// Re-export types from original
export type TeamMatchChallengeStatus =
    | "pending"
    | "accepted"
    | "rejected"
    | "venue_proposed"
    | "venue_confirmed"
    | "admin_pending"
    | "completed"
    | "expired";

export interface TeamChallengeVenueChoice {
    zoneId: string;
    venueName: string;
    areaLabel?: string | null;
}

export interface TeamMatchChallenge {
    id: string;
    challengerTeamId: string;
    challengerTeamName: string;
    opponentTeamId: string;
    opponentTeamName: string;
    captainAUid: string;
    captainAName: string;
    captainBUid: string;
    captainBName: string;
    gameKey: string;
    format?: string;
    seriesType?: string | null;
    maxPlayers: number;
    scheduledDate?: string;
    scheduledTime?: string;
    pricePerPlayer?: number | null;
    zoneRateKey?: string | null;
    zoneRateLabel?: string | null;
    zoneRatePrice?: number | null;
    teamAPaymentStatus?: "unpaid" | "pending" | "paid" | null;
    teamBPaymentStatus?: "unpaid" | "pending" | "paid" | null;
    teamAPaymentAmount?: number | null;
    teamBPaymentAmount?: number | null;
    message?: string;
    status: TeamMatchChallengeStatus;
    commonAreas: string[];
    proposedVenueByCaptainA?: TeamChallengeVenueChoice | null;
    alternativeVenueByCaptainB?: TeamChallengeVenueChoice | null;
    captainVenueChoices?: Record<string, TeamChallengeVenueChoice>;
    confirmedVenue?: TeamChallengeVenueChoice | null;
    chatId?: string | null;
    matchroomId?: string | null;
    bookingRequestId?: string | null;
    adminReviewStatus?: "pending" | "approved" | "rejected" | null;
    lineupA?: string[];
    lineupB?: string[];
    createdAt?: any;
    updatedAt?: any;
}

type ServerResponse =
    | { ok: true; message?: string;[key: string]: any }
    | { ok: false; message: string;[key: string]: any };

// Helper to get current user
async function getCurrentUserInfo(): Promise<{ uid: string; convexId: Id<"users">; username: string } | null> {
    const user = await currentUser();
    if (!user) return null;
    const convexUser = await convex.query(api.users.getByAuthId, { authId: user.id });
    if (!convexUser) return null;
    return { uid: user.id, convexId: convexUser._id, username: convexUser.username };
}

const isValidVenueChoice = (choice: any): choice is TeamChallengeVenueChoice => {
    return !!choice &&
        typeof choice.zoneId === "string" &&
        choice.zoneId.trim().length > 0 &&
        typeof choice.venueName === "string" &&
        choice.venueName.trim().length > 0;
};

const getSeriesHours = (gameKey: string, seriesType?: string | null) => {
    const game = String(gameKey || "").toLowerCase();
    const series = String(seriesType || "BO1").toUpperCase();
    if (game === "cs2" || game === "cs16" || game === "valorant") return series === "BO3" ? 3 : series === "BO5" ? 5 : 1;
    if (game === "fc26" || game === "fc25") return series === "BO3" ? 1 : series === "BO5" ? 2 : 0.5;
    if (game === "tekken8") return series === "BO3" ? 2 : series === "BO5" ? 3 : 1;
    if (game === "padel" || game === "pickleball") return series === "BO3" ? 1 : series === "BO5" ? 2 : 1;
    if (game === "indoor_cricket") return 2;
    if (game === "futsal") return 1;
    return series === "BO3" ? 2 : series === "BO5" ? 3 : 1;
};

const toPositiveNumber = (value: unknown) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const getZonePricingSourcesForChallenge = (zoneData: any) => {
    const branchPricing = Array.isArray(zoneData?.branches)
        ? zoneData.branches.map((branch: any) => branch?.pricing)
        : [];
    return [...branchPricing, zoneData?.pricing].filter(Boolean);
};

const getFirstPositivePrice = (...values: unknown[]) => {
    for (const value of values) {
        const parsed = toPositiveNumber(value);
        if (parsed) return parsed;
    }
    return 0;
};

const getPreferredConsolePrice = (tier: any, maxPlayers: number) => {
    const preferredKey = maxPlayers > 2 ? "price2v2" : "price1v1";
    const fallbackKey = preferredKey === "price2v2" ? "price1v1" : "price2v2";
    return getFirstPositivePrice(tier?.[preferredKey], tier?.[fallbackKey], tier?.price);
};

const getZoneRateForChallenge = (zoneData: any, gameKey: string, maxPlayers: number) => {
    const game = String(gameKey || "").toLowerCase();
    const normalizedGame = game === "fc25" ? "fc26" : game;
    const pricingSources = getZonePricingSourcesForChallenge(zoneData);
    const rates: number[] = [];

    const addRate = (value: unknown) => {
        const parsed = toPositiveNumber(value);
        if (parsed) rates.push(parsed);
    };

    for (const pricing of pricingSources) {
        if (normalizedGame === "cs2" || normalizedGame === "cs16" || normalizedGame === "valorant") {
            addRate(pricing?.pc?.regular?.price);
            addRate(pricing?.pc?.premium?.price);
            addRate(pricing?.pc?.elite?.price);
            continue;
        }

        if (normalizedGame === "fc26" || normalizedGame === "tekken8") {
            const consolePricing = pricing?.console || {};
            addRate(getPreferredConsolePrice(consolePricing?.regular, maxPlayers));
            addRate(getPreferredConsolePrice(consolePricing?.premium, maxPlayers));
            addRate(getPreferredConsolePrice(consolePricing?.elite, maxPlayers));
            addRate(getPreferredConsolePrice(consolePricing?.ps5, maxPlayers));
            addRate(getPreferredConsolePrice(consolePricing?.xbox, maxPlayers));
            continue;
        }

        const sportMap =
            normalizedGame === "indoor_cricket"
                ? (pricing?.indoorCricket || pricing?.indoor_cricket || {})
                : (pricing?.[normalizedGame] || {});
        Object.values(sportMap).forEach((entry: any) => addRate(entry?.price));
    }

    return rates.length ? Math.min(...rates) : 0;
};

const getZoneForChallenge = async (zoneId: string) => {
    try {
        const zone = await convex.query(api.zones.getById, { zoneId: zoneId as Id<"zones"> });
        if (zone) return zone;
    } catch {
        // Fall back to the string-compatible query below.
    }

    const getByIdString = (api.zones as any).getByIdString;
    if (!getByIdString) return null;

    try {
        return await convex.query(getByIdString, { zoneId });
    } catch {
        return null;
    }
};

const computeChallengePricePerPlayer = async (input: {
    zoneId: string;
    gameKey: string;
    seriesType?: string | null;
    maxPlayers: number;
    zoneRatePrice?: number | null;
}) => {
    try {
        const zone = await getZoneForChallenge(input.zoneId);
        if (!zone) return 0;
        const baseRate = toPositiveNumber(input.zoneRatePrice) || getZoneRateForChallenge(zone, input.gameKey, input.maxPlayers);
        if (!baseRate) return 0;
        const hours = getSeriesHours(input.gameKey, input.seriesType);
        return Math.ceil(baseRate * hours);
    } catch {
        return 0;
    }
};

const dedupe = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const toChallengeTitle = (teamA: string, teamB: string) => `${teamA} vs ${teamB}`;

const toDurationMinutes = (gameKey: string, seriesType?: string | null) => {
    const game = String(gameKey || "").toLowerCase();
    const series = String(seriesType || "").toUpperCase();
    if (game === "cs2" || game === "cs16" || game === "valorant") return series === "BO3" ? 180 : series === "BO5" ? 300 : series === "BO10" ? 600 : 60;
    if (game === "fc26" || game === "fc25") return series === "BO3" ? 60 : series === "BO5" ? 120 : series === "BO10" ? 180 : 30;
    if (game === "tekken8") return series === "BO20" ? 120 : series === "BO40" ? 180 : 60;
    if (game === "futsal") return 90;
    if (game === "indoor_cricket") return 120;
    if (game === "padel" || game === "pickleball") return series === "BO5" ? 120 : series === "BO10" ? 180 : 60;
    return 60;
};

// Get team with its members from Convex
const getTeamData = async (teamId: string) => {
    const team = await convex.query(api.teams.getWithMembers, { teamId: teamId as Id<"teams"> });
    if (!team) throw new Error("Team not found");

    const memberUids = dedupe([
        team.captainUid,
        ...team.memberUids,
    ]);

    const usernameByUid: Record<string, string> = {};
    const members = Array.isArray(team.members) ? team.members : [];
    if (team.members) {
        members.forEach((m: any) => {
            if (m.odxerId) {
                usernameByUid[m.odxerId] = m.username || "Player";
            }
        });
    }

    return { team, memberUids, usernameByUid, members };
};

const isTeamFilled = (team: any, members: any[]) => {
    const mainRosterSize = Number(team.mainRosterSize || getTeamMainRosterSize(team.game));
    if (!Number.isFinite(mainRosterSize) || mainRosterSize <= 0) return false;
    return getDefaultLineup(team, members).length >= mainRosterSize;
};

const getDefaultLineup = (team: any, members: any[]) => {
    const mainRosterSize = Number(team.mainRosterSize || getTeamMainRosterSize(team.game));
    const mainMembers = members
        .filter((member: any, index: number) => (member.rosterRole || (index < mainRosterSize ? "main" : "substitute")) === "main")
        .slice(0, mainRosterSize)
        .map((member: any) => String(member.odxerId || member.uid || ""))
        .filter(Boolean);
    return mainMembers.length > 0
        ? mainMembers
        : dedupe([team.captainUid, ...(team.memberUids || [])]).slice(0, mainRosterSize).map(String);
};

// Send a team match challenge
export const sendTeamMatchChallenge = async (input: {
    challengerTeamId: string;
    opponentTeamId: string;
    message?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    pricePerPlayer?: number;
    format?: string;
    seriesType?: string | null;
    proposedVenueByCaptainA: TeamChallengeVenueChoice;
    maxPlayers?: number;
    zoneRateKey?: string | null;
    zoneRateLabel?: string | null;
    zoneRatePrice?: number | null;
    teamAPaymentAmount?: number;
}): Promise<ServerResponse> => {
    try {
        const verificationGate = await ensureVerifiedEmailAccess();
        if (!verificationGate.ok) return verificationGate;

        const me = await getCurrentUserInfo();
        if (!me) return { ok: false, message: "Not authenticated." };

        if (!input.scheduledDate || !input.scheduledTime) {
            return { ok: false, message: "Select day/date/time before sending challenge." };
        }
        if (!isValidVenueChoice(input.proposedVenueByCaptainA)) {
            return { ok: false, message: "Select preferred zone before sending challenge." };
        }
        const scheduledAt = parseScheduledDateTime(input.scheduledDate, input.scheduledTime);
        if (!scheduledAt) {
            return { ok: false, message: "Invalid challenge date/time." };
        }
        if (scheduledAt.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
            return { ok: false, message: "Challenge match must be at least 24 hours from now." };
        }

        const [{ team: teamA, members: teamAMembers }, { team: teamB, members: teamBMembers }] = await Promise.all([
            getTeamData(input.challengerTeamId),
            getTeamData(input.opponentTeamId),
        ]);

        if (teamA.captainUid !== me.convexId) {
            return { ok: false, message: "Only your team captain can send a challenge." };
        }
        if (teamA._id === teamB._id) {
            return { ok: false, message: "Choose another team to challenge." };
        }
        if (String(teamA.game || "").toLowerCase() !== String(teamB.game || "").toLowerCase()) {
            return { ok: false, message: "Both teams must be from the same game." };
        }
        if (!isTeamFilled(teamA, teamAMembers) || !isTeamFilled(teamB, teamBMembers)) {
            return { ok: false, message: "Team challenge can only be sent when both teams are full." };
        }

        const fallbackPlayers = Number(teamA.maxMembers || 0) + Number(teamB.maxMembers || 0);
        const requestedPlayers = Number(input.maxPlayers || 0);
        const computedPlayers = Math.max(2, requestedPlayers > 0 ? requestedPlayers : fallbackPlayers);
        const normalizedGame = String(teamA.game || "").toLowerCase();
        const activePlayers = Number(teamA.mainRosterSize || getTeamMainRosterSize(teamA.game)) + Number(teamB.mainRosterSize || getTeamMainRosterSize(teamB.game));
        const maxPlayers = normalizedGame === "cs2" || normalizedGame === "cs16" || normalizedGame === "valorant" ? 10 : activePlayers || computedPlayers;

        const computedPricePerPlayer = await computeChallengePricePerPlayer({
            zoneId: input.proposedVenueByCaptainA.zoneId,
            gameKey: teamA.game,
            seriesType: input.seriesType,
            maxPlayers,
            zoneRatePrice: input.zoneRatePrice,
        });
        if (computedPricePerPlayer <= 0) {
            return { ok: false, message: "Unable to derive price per player from selected zone and series." };
        }

        // Create the challenge in Convex
        const challengeId = await convex.mutation(api.teamChallenges.createFull, {
            challengerTeamId: teamA._id,
            challengerTeamName: teamA.name,
            opponentTeamId: teamB._id,
            opponentTeamName: teamB.name || "",
            game: teamA.game,
            status: "pending",
            message: input.message?.trim() || "",
            captainAUid: me.convexId,
            captainAName: teamA.captainUsername || me.username,
            captainBUid: teamB.captainUid,
            captainBName: teamB.captainUsername || "Captain",
            gameKey: teamA.game,
            format: input.format || null,
            seriesType: input.seriesType || null,
            maxPlayers,
            scheduledDate: input.scheduledDate,
            scheduledTime: input.scheduledTime,
            scheduledAt: scheduledAt.getTime(),
            pricePerPlayer: computedPricePerPlayer,
            zoneRateKey: input.zoneRateKey || undefined,
            zoneRateLabel: input.zoneRateLabel || undefined,
            zoneRatePrice: toPositiveNumber(input.zoneRatePrice) || undefined,
            teamAPaymentStatus: "paid",
            teamBPaymentStatus: "unpaid",
            teamAPaymentAmount: toPositiveNumber(input.teamAPaymentAmount) || undefined,
            proposedVenueByCaptainA: input.proposedVenueByCaptainA,
            commonAreas: [],
            lineupA: getDefaultLineup(teamA, teamAMembers),
        });

        return { ok: true, challengeId };
    } catch (error: any) {
        Logger.error("teamMatchService", "sendTeamMatchChallenge failed", error);
        return { ok: false, message: error?.message || "Failed to send challenge." };
    }
};

// Accept team match challenge
export const acceptTeamMatchChallenge = async (input: {
    challengeId: string;
    lineupB?: string[];
    teamBPaymentAmount?: number;
}): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserInfo();
        if (!me) return { ok: false, message: "Not authenticated." };

        const challenge = await convex.query(api.teamChallenges.getById, {
            challengeId: input.challengeId as Id<"teamChallenges">,
        });
        if (!challenge) return { ok: false, message: "Challenge not found." };

        if (challenge.status !== "pending") {
            const statusText = String(challenge.status || "resolved").replace(/_/g, " ");
            return { ok: false, message: `Challenge is already ${statusText}.` };
        }

        let lineupB = input.lineupB;
        if (!lineupB || lineupB.length === 0) {
            const { team: opponentTeam, members: opponentMembers } = await getTeamData(String(challenge.opponentTeamId));
            lineupB = getDefaultLineup(opponentTeam, opponentMembers);
        }

        // Accept the challenge
        const response = await convex.mutation(api.teamChallenges.respond, {
            challengeId: input.challengeId as Id<"teamChallenges">,
            accept: true,
            lineupB,
            teamBPaymentStatus: "paid",
            teamBPaymentAmount: toPositiveNumber(input.teamBPaymentAmount) || undefined,
            actorUid: me.convexId,
        });

        // Create chat
        const chatId = response.chatId || String(input.challengeId);
        await convex.mutation(api.teamChallengeChat.sendMessage, {
            chatId,
            text: "Challenge accepted! Let's discuss details.",
        });

        return { ok: true, challengeId: input.challengeId, chatId };
    } catch (error: any) {
        Logger.error("teamMatchService", "acceptTeamMatchChallenge failed", error);
        return { ok: false, message: error?.message || "Failed to accept challenge." };
    }
};

export const payTeamChallengeWithWallet = async (input: {
    amount: number;
    challengeId?: string | null;
    side: "teamA" | "teamB";
    reference?: string;
}): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserInfo();
        if (!me) return { ok: false, message: "Not authenticated." };
        const amount = Math.ceil(Number(input.amount || 0));
        if (!Number.isFinite(amount) || amount <= 0) {
            return { ok: false, message: "Payment amount is missing." };
        }
        await convex.mutation(api.wallet.deductFunds, {
            amount,
            userId: me.convexId,
            source: "team_challenge",
            reference: input.reference || `team_challenge:${input.side}:${input.challengeId || Date.now()}`,
            metadata: {
                flow: "team_challenge",
                challengeId: input.challengeId || null,
                side: input.side,
            },
        });
        return { ok: true, amount };
    } catch (error: any) {
        Logger.error("teamMatchService", "payTeamChallengeWithWallet failed", error);
        return { ok: false, message: error?.message || "Failed to pay from wallet." };
    }
};

// Reject team match challenge
export const rejectTeamMatchChallenge = async (input: {
    challengeId: string;
}): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserInfo();
        if (!me) return { ok: false, message: "Not authenticated." };

        const challenge = await convex.query(api.teamChallenges.getById, {
            challengeId: input.challengeId as Id<"teamChallenges">,
        });
        if (!challenge) return { ok: false, message: "Challenge not found." };

        if (challenge.status !== "pending") {
            const statusText = String(challenge.status || "resolved").replace(/_/g, " ");
            return { ok: false, message: `Challenge is already ${statusText}.` };
        }

        await convex.mutation(api.teamChallenges.respond, {
            challengeId: input.challengeId as Id<"teamChallenges">,
            accept: false,
            actorUid: me.convexId,
        });

        return { ok: true, challengeId: input.challengeId };
    } catch (error: any) {
        Logger.error("teamMatchService", "rejectTeamMatchChallenge failed", error);
        return { ok: false, message: error?.message || "Failed to reject challenge." };
    }
};

// Suggest alternative zone
export const suggestTeamMatchChallengeAlternativeZone = async (input: {
    challengeId: string;
    zoneId: string;
    venueName: string;
    areaLabel?: string | null;
}): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserInfo();
        if (!me) return { ok: false, message: "Not authenticated." };

        const challenge = await convex.query(api.teamChallenges.getById, {
            challengeId: input.challengeId as Id<"teamChallenges">,
        });
        if (!challenge) return { ok: false, message: "Challenge not found." };
        if (challenge.status !== "pending") return { ok: false, message: "Challenge is not pending." };

        // Update challenge message with alternative zone info
        await convex.mutation(api.teamChallenges.update, {
            challengeId: input.challengeId as Id<"teamChallenges">,
            actorUid: me.convexId,
            message: `Alternative venue proposed: ${input.venueName}`,
            alternativeVenueByCaptainB: {
                zoneId: input.zoneId,
                venueName: input.venueName,
                areaLabel: input.areaLabel || null,
            },
        });

        return { ok: true };
    } catch (error: any) {
        Logger.error("teamMatchService", "suggestTeamMatchChallengeAlternativeZone failed", error);
        return { ok: false, message: error?.message || "Failed to suggest alternative zone." };
    }
};

// Respond to team match challenge notification
export const respondToTeamMatchChallenge = async (input: {
    notificationId: string;
    decision: "accept" | "reject";
}): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserInfo();
        if (!me) return { ok: false, message: "Not authenticated." };

        const notif = await convex.query(api.notifications.getById, {
            notificationId: input.notificationId as Id<"notifications">,
        });
        if (!notif) return { ok: false, message: "Challenge notification not found." };
        if (notif.toUid !== me.convexId) return { ok: false, message: "Not authorized." };
        if (notif.status !== "pending") return { ok: false, message: "Challenge already handled." };

        const challengeId = (notif.data as any)?.challengeId;
        if (!challengeId) return { ok: false, message: "Challenge reference missing." };

        if (input.decision === "reject") {
            const rejection = await rejectTeamMatchChallenge({ challengeId });
            if (!rejection.ok) return rejection;
            await convex.mutation(api.notifications.updateStatus, {
                notificationId: input.notificationId as Id<"notifications">,
                status: "rejected",
            });
            return { ok: true, challengeId };
        }

        const accepted = await acceptTeamMatchChallenge({ challengeId });
        if (!accepted.ok) return accepted;
        await convex.mutation(api.notifications.updateStatus, {
            notificationId: input.notificationId as Id<"notifications">,
            status: "accepted",
        });
        return accepted;
    } catch (error: any) {
        Logger.error("teamMatchService", "respondToTeamMatchChallenge failed", error);
        return { ok: false, message: error?.message || "Failed to respond to challenge." };
    }
};

// Propose venue for challenge
export const proposeTeamChallengeVenue = async (input: {
    challengeId: string;
    zoneId: string;
    venueName: string;
    areaLabel?: string | null;
}): Promise<ServerResponse> => {
    try {
        const me = await getCurrentUserInfo();
        if (!me) return { ok: false, message: "Not authenticated." };

        const challenge = await convex.query(api.teamChallenges.getById, {
            challengeId: input.challengeId as Id<"teamChallenges">,
        });
        if (!challenge) return { ok: false, message: "Challenge not found." };
        if (!["accepted", "venue_proposed", "venue_confirmed"].includes(challenge.status)) {
            return { ok: false, message: "Challenge is not in venue proposal state." };
        }

        const result = await convex.mutation(api.teamChallenges.proposeVenue, {
            challengeId: input.challengeId as Id<"teamChallenges">,
            zoneId: input.zoneId as Id<"zones">,
            zoneName: input.venueName,
            areaLabel: input.areaLabel || null,
            scheduledAt: Date.now(),
            actorUid: me.convexId,
        });

        if (result?.confirmedVenue) {
            const latest = await convex.query(api.teamChallenges.getById, {
                challengeId: input.challengeId as Id<"teamChallenges">,
            });
            if (!latest) {
                return { ok: false, message: "Challenge not found after venue confirmation." };
            }
            const [teamAData, teamBData] = await Promise.all([
                getTeamData(String(latest.challengerTeamId)),
                getTeamData(String(latest.opponentTeamId)),
            ]);
            const lineupA = Array.isArray(latest.lineupA) && latest.lineupA.length > 0
                ? latest.lineupA.map(String)
                : getDefaultLineup(teamAData.team, teamAData.members);
            const lineupB = Array.isArray(latest.lineupB) && latest.lineupB.length > 0
                ? latest.lineupB.map(String)
                : getDefaultLineup(teamBData.team, teamBData.members);
            const activePlayerUids = dedupe([...lineupA, ...lineupB]);
            const activePlayers = [
                ...lineupA.map((uid) => ({
                    uid,
                    username: teamAData.usernameByUid[uid] || (uid === String(latest.captainAUid) ? latest.captainAName : "Team A Player") || "Team A Player",
                    joinedAt: Date.now(),
                    role: "Team A",
                })),
                ...lineupB.map((uid) => ({
                    uid,
                    username: teamBData.usernameByUid[uid] || (uid === String(latest.captainBUid) ? latest.captainBName : "Team B Player") || "Team B Player",
                    joinedAt: Date.now(),
                    role: "Team B",
                })),
            ];

            const matchroom = await createMatchroom({
                hostUid: String(latest.captainAUid || me.convexId),
                hostName: latest.captainAName || me.username,
                game: latest.gameKey || latest.game,
                title: toChallengeTitle(latest.challengerTeamName || "Team A", latest.opponentTeamName || "Team B"),
                description: latest.message || "Team challenge matchroom",
                status: "open",
                maxPlayers: Number(latest.maxPlayers || activePlayers.length || 10),
                currentPlayers: activePlayers.length,
                players: activePlayers,
                playerUids: activePlayerUids,
                locationMode: "zone",
                zoneId: result.confirmedVenue.zoneId,
                location: result.confirmedVenue.venueName,
                scheduledDate: latest.scheduledDate,
                scheduledTime: latest.scheduledTime,
                durationMinutes: toDurationMinutes(latest.gameKey || latest.game, latest.seriesType),
                pricing: { perPlayer: Number(latest.pricePerPlayer || 0), currency: "PKR" },
                format: latest.format,
                seriesType: latest.seriesType,
                slotsA: [],
                slotsB: [],
                captainUidA: String(latest.captainAUid),
                captainUidB: String(latest.captainBUid),
                teamMode: "team",
                teamId: String(latest.challengerTeamId),
                teamName: latest.challengerTeamName,
                bookingSource: "challenge",
                isPrivate: true,
                paymentStatus: "unpaid",
                zoneAdminApproved: false,
            } as any);

            if (!matchroom.ok || !matchroom.id) {
                return { ok: false, message: matchroom.message || "Failed to create challenge matchroom." };
            }

            await convex.mutation(api.teamChallenges.update, {
                challengeId: input.challengeId as Id<"teamChallenges">,
                actorUid: me.convexId,
                status: "venue_confirmed",
                confirmedVenue: result.confirmedVenue,
                matchroomId: matchroom.id as Id<"matchrooms">,
            });

            return { ok: true, matchroomId: matchroom.id };
        }

        return { ok: true };
    } catch (error: any) {
        Logger.error("teamMatchService", "proposeTeamChallengeVenue failed", error);
        return { ok: false, message: error?.message || "Failed to propose venue." };
    }
};

// Get challenge by ID
export const getTeamMatchChallengeById = async (challengeId: string): Promise<ServerResponse> => {
    try {
        const challenge = await convex.query(api.teamChallenges.getById, {
            challengeId: challengeId as Id<"teamChallenges">,
        });
        if (!challenge) return { ok: false, message: "Challenge not found." };
        return { ok: true, data: { ...challenge, id: challenge._id } };
    } catch (error: any) {
        Logger.error("teamMatchService", "getTeamMatchChallengeById failed", error);
        return { ok: false, message: error?.message || "Failed to load challenge." };
    }
};

// Subscribe to challenge updates (uses Convex reactivity)
// Note: In Convex, real-time updates are handled via useQuery in React components
// This function returns an unsubscribe no-op for API compatibility
export const subscribeTeamMatchChallenge = (
    challengeId: string,
    onData: (challenge: TeamMatchChallenge | null) => void,
    onError?: (error: any) => void,
) => {
    // For Convex, real-time is handled by useQuery at the component level
    // This provides a one-time fetch for compatibility
    (async () => {
        try {
            const challenge = await convex.query(api.teamChallenges.getById, {
                challengeId: challengeId as Id<"teamChallenges">,
            });
            if (!challenge) {
                onData(null);
                return;
            }
            onData({ ...challenge, id: challenge._id } as any);
        } catch (error: any) {
            if (onError) onError(error);
        }
    })();

    // Return unsubscribe no-op
    return () => {};
};

// Get captained teams
export const getCaptainedTeams = async (uid: string): Promise<ServerResponse> => {
    try {
        const teams = await convex.query(api.teams.getUserTeams, { uid });
        // Filter to teams where user is captain
        const captainedTeams = teams.filter((t: any) => t.memberUids.includes(uid) && t.captainUid === uid);
        const sorted = captainedTeams.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
        return { ok: true, data: sorted.map((t: any) => ({ ...t, id: t._id })) };
    } catch (error: any) {
        Logger.error("teamMatchService", "getCaptainedTeams failed", error);
        return { ok: false, message: error?.message || "Failed to load captain teams." };
    }
};

// Get challenges for captain
export const getChallengesForCaptain = async (uid: string): Promise<ServerResponse> => {
    try {
        const challenges = await convex.query(api.teamChallenges.listForCaptain, {
            captainUid: uid,
        });
        const rows = challenges
            .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
            .map((c: any) => ({ ...c, id: c._id }));
        return { ok: true, data: rows };
    } catch (error: any) {
        Logger.error("teamMatchService", "getChallengesForCaptain failed", error);
        return { ok: false, message: error?.message || "Failed to load challenges." };
    }
};

// Repair (simplified for Convex - most repairs aren't needed with proper schema)
export const repairTeamMatchChallenge = async (_challengeId: string): Promise<ServerResponse> => {
    return { ok: true, repaired: false, rejected: false };
};

export const repairTeamChallengesForCaptain = async (_uid: string): Promise<ServerResponse> => {
    return { ok: true, repairedCount: 0 };
};
