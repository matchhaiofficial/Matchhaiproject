import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from "firebase/firestore";

import { auth, db } from "../config/firebaseConfig";
import { createMatchroom, type Matchroom } from "./matchService";
import { type Team } from "./teamService";
import Logger from "../utils/logger";
import { parseScheduledDateTime } from "../utils/matchroomTime";

export type TeamMatchChallengeStatus =
    | "pending"
    | "accepted"
    | "rejected"
    | "venue_proposed"
    | "venue_confirmed"
    | "admin_pending"
    | "completed";

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
    createdAt?: any;
    updatedAt?: any;
}

const toMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    return 0;
};

const isValidVenueChoice = (choice: any): choice is TeamChallengeVenueChoice => {
    return !!choice &&
        typeof choice.zoneId === "string" &&
        choice.zoneId.trim().length > 0 &&
        typeof choice.venueName === "string" &&
        choice.venueName.trim().length > 0;
};

const hasRequiredChallengeScheduling = (challenge: Partial<TeamMatchChallenge>) => {
    return Boolean(challenge.scheduledDate && challenge.scheduledTime && isValidVenueChoice(challenge.proposedVenueByCaptainA));
};

const markChallengeNotificationsHandledAsAccepted = async (challengeId: string, captainBUid: string) => {
    const notificationId = `team_match_challenge_${challengeId}_${captainBUid}`;
    const notifRef = doc(db, "notifications", notificationId);
    const notifSnap = await getDoc(notifRef);
    if (!notifSnap.exists()) return;
    const data = notifSnap.data() as any;
    if (data?.status === "accepted") return;
    await updateDoc(notifRef, {
        status: "accepted",
        updatedAt: serverTimestamp(),
    });
};

const upsertChallengeAcceptedNotification = async (input: {
    challengeId: string;
    toUid: string;
    fromUid: string;
    fromUsername: string;
    message: string;
    title?: string;
    chatId?: string | null;
    matchroomId?: string | null;
    bookingRequestId?: string | null;
}) => {
    const notifId = `team_match_challenge_update_${input.challengeId}_${input.toUid}`;
    await setDoc(doc(db, "notifications", notifId), {
        type: "team_match_challenge_update",
        fromUid: input.fromUid,
        fromUsername: input.fromUsername || "Captain",
        toUid: input.toUid,
        status: "accepted",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        title: input.title || "Challenge accepted",
        message: input.message,
        meta: {
            challengeId: input.challengeId,
            chatId: input.chatId || null,
            matchroomId: input.matchroomId || null,
            bookingRequestId: input.bookingRequestId || null,
        },
    }, { merge: true });
};

const getSeriesHours = (gameKey: string, seriesType?: string | null) => {
    const game = String(gameKey || "").toLowerCase();
    const series = String(seriesType || "BO1").toUpperCase();
    if (game === "cs2") return series === "BO3" ? 3 : series === "BO5" ? 5 : 1;
    if (game === "fc26" || game === "fc25") return series === "BO3" ? 1 : series === "BO5" ? 2 : 0.5;
    if (game === "tekken8") return series === "BO3" ? 2 : series === "BO5" ? 3 : 1;
    if (game === "padel" || game === "pickleball") return series === "BO3" ? 1 : series === "BO5" ? 2 : 1;
    if (game === "indoor_cricket") return 2;
    if (game === "futsal") return 1;
    return series === "BO3" ? 2 : series === "BO5" ? 3 : 1;
};

const getZoneRateForChallenge = (zoneData: any, gameKey: string) => {
    const pricing: any = zoneData?.pricing || zoneData?.branches?.[0]?.pricing || {};
    const game = String(gameKey || "").toLowerCase();
    if (game === "cs2") {
        const rates = [pricing?.pc?.regular?.price, pricing?.pc?.premium?.price, pricing?.pc?.elite?.price]
            .filter((n: any) => typeof n === "number" && n > 0);
        return rates.length ? Math.min(...rates) : 0;
    }
    if (game === "fc26" || game === "fc25" || game === "tekken8") {
        const rates = [
            pricing?.console?.ps5?.price2v2,
            pricing?.console?.ps5?.price1v1,
            pricing?.console?.xbox?.price2v2,
            pricing?.console?.xbox?.price1v1,
        ].filter((n: any) => typeof n === "number" && n > 0);
        return rates.length ? Math.min(...rates) : 0;
    }
    const sportMap =
        game === "indoor_cricket"
            ? (pricing?.indoorCricket || pricing?.indoor_cricket || {})
            : (pricing?.[game] || {});
    const sportRates = Object.values(sportMap)
        .map((entry: any) => entry?.price)
        .filter((n: any) => typeof n === "number" && n > 0);
    return sportRates.length ? Math.min(...sportRates) : 0;
};

const computeChallengePricePerPlayer = async (input: {
    zoneId: string;
    gameKey: string;
    seriesType?: string | null;
    maxPlayers: number;
}) => {
    const zoneSnap = await getDoc(doc(db, "zones", input.zoneId));
    if (!zoneSnap.exists()) return 0;
    const baseRate = getZoneRateForChallenge(zoneSnap.data(), input.gameKey);
    if (!baseRate) return 0;
    const hours = getSeriesHours(input.gameKey, input.seriesType);
    const totalCost = baseRate * hours;
    return input.maxPlayers > 0 ? Math.ceil(totalCost / input.maxPlayers) : 0;
};

const normalizeAreas = (areas: unknown): string[] => {
    if (!Array.isArray(areas)) return [];
    return Array.from(new Set(
        areas.map((area) => String(area || "").trim()).filter(Boolean),
    ));
};

const dedupe = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const isTeamFilled = (team: Team, memberUids: string[]) => {
    const maxMembers = Number(team.maxMembers || 0);
    if (!Number.isFinite(maxMembers) || maxMembers <= 0) return false;
    const currentCount = memberUids.length;
    return currentCount >= maxMembers;
};

const getTeamMembers = async (teamId: string) => {
    const teamSnap = await getDoc(doc(db, "teams", teamId));
    if (!teamSnap.exists()) {
        throw new Error("Team not found");
    }
    const teamData = { id: teamSnap.id, ...teamSnap.data() } as Team;

    const membersSnap = await getDocs(collection(db, "teams", teamId, "members"));
    const members = membersSnap.docs.map((item: any) => item.data() as any);

    // Prefer members subcollection when available (source of truth), fallback to team doc.
    const sourceUids = members.length > 0
        ? members.map((item: any) => String(item?.uid || "")).filter(Boolean)
        : (Array.isArray(teamData.memberUids) ? teamData.memberUids : []);
    const memberUids = dedupe([
        teamData.captainUid,
        ...sourceUids,
    ]);

    const usernameByUid: Record<string, string> = {};
    members.forEach((item: any) => {
        if (item?.uid) {
            usernameByUid[String(item.uid)] = item.username || "Player";
        }
    });

    return {
        team: teamData,
        memberUids,
        usernameByUid,
    };
};

const getCommonPreferredAreas = async (uids: string[]) => {
    const uniqueUids = dedupe(uids);
    if (uniqueUids.length === 0) return [];

    const snapshots = await Promise.all(uniqueUids.map((uid) => getDoc(doc(db, "users", uid))));
    const allAreas = snapshots
        .filter((snap) => snap.exists())
        .map((snap) => normalizeAreas(snap.data()?.areasPreferred));

    if (allAreas.length === 0) return [];
    let intersection = new Set(allAreas[0]);
    allAreas.slice(1).forEach((areas) => {
        intersection = new Set(areas.filter((area) => intersection.has(area)));
    });
    return Array.from(intersection);
};

const createCaptainsChatroom = async (challenge: TeamMatchChallenge) => {
    const chatRef = doc(db, "team_match_chats", challenge.id);
    await setDoc(chatRef, {
        challengeId: challenge.id,
        participantUids: dedupe([challenge.captainAUid, challenge.captainBUid]),
        rolesByUid: {
            [challenge.captainAUid]: "captain_a",
            [challenge.captainBUid]: "captain_b",
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: null,
        lastReadBy: {},
    }, { merge: true });
    return challenge.id;
};

const toChallengeTitle = (teamA: string, teamB: string) => `${teamA} vs ${teamB}`;

const toDurationMinutes = (gameKey: string, seriesType?: string | null) => {
    const game = String(gameKey || "").toLowerCase();
    const series = String(seriesType || "").toUpperCase();
    if (game === "cs2") return series === "BO3" ? 180 : series === "BO5" ? 300 : series === "BO10" ? 600 : 60;
    if (game === "fc26" || game === "fc25") return series === "BO3" ? 60 : series === "BO5" ? 120 : series === "BO10" ? 180 : 30;
    if (game === "tekken8") return series === "BO20" ? 120 : series === "BO40" ? 180 : 60;
    if (game === "futsal") return 90;
    if (game === "indoor_cricket") return 120;
    if (game === "padel" || game === "pickleball") return series === "BO5" ? 120 : series === "BO10" ? 180 : 60;
    return 60;
};

const maybeCreateMatchroomForChallenge = async (
    challengeId: string,
    actor?: { uid: string; username?: string | null },
) => {
    const challengeRef = doc(db, "team_match_challenges", challengeId);
    const challengeSnap = await getDoc(challengeRef);
    if (!challengeSnap.exists()) return { ok: false as const, message: "Challenge not found." };
    const challenge = { id: challengeSnap.id, ...challengeSnap.data() } as TeamMatchChallenge;

    if (challenge.matchroomId) return { ok: true as const, matchroomId: challenge.matchroomId };
    const choices = challenge.captainVenueChoices || {};
    const choiceA = choices[challenge.captainAUid];
    const choiceB = choices[challenge.captainBUid];
    if (!choiceA || !choiceB || choiceA.zoneId !== choiceB.zoneId) {
        return { ok: false as const, message: "Captains have not confirmed the same venue yet." };
    }

    const [{ team: teamA, memberUids: memberUidsA, usernameByUid: usernameByUidA }, { team: teamB }] = await Promise.all([
        getTeamMembers(challenge.challengerTeamId),
        getTeamMembers(challenge.opponentTeamId),
    ]);

    const normalizedGame = String(challenge.gameKey || "").toLowerCase();
    const challengePlayers = Number(challenge.maxPlayers || 0);
    const fallbackPlayers = Number(teamA.maxMembers || 0) + Number(teamB.maxMembers || 0);
    const computedPlayers = Math.max(2, challengePlayers > 0 ? challengePlayers : fallbackPlayers);
    const maxPlayers = normalizedGame === "cs2" ? 10 : computedPlayers;
    const teamSize = Math.max(1, Math.ceil(maxPlayers / 2));

    const teamAUids = dedupe([challenge.captainAUid, ...memberUidsA.filter((uid) => uid !== challenge.captainAUid)]).slice(0, teamSize);
    const players = teamAUids.map((uid) => ({
        uid,
        username:
            (uid === challenge.captainAUid ? challenge.captainAName : null) ||
            usernameByUidA[uid] ||
            "Player",
        joinedAt: new Date(),
        role:
            uid === challenge.captainAUid
                ? "Captain A"
                : "Player",
    }));
    const prefilledByUid = new Map(players.map((p) => [p.uid, p]));

    const slotsA = Array.from({ length: teamSize }, (_, index) => {
        const uid = teamAUids[index];
        const player = uid ? prefilledByUid.get(uid) : null;
        if (!uid || !player) {
            return {
                slotId: `A${index + 1}`,
                status: "open" as const,
                role: "Player",
            };
        }
        return {
            slotId: `A${index + 1}`,
            uid,
            user: {
                uid,
                username: player.username,
            },
            status: "confirmed" as const,
            role: player.role,
        };
    });
    const slotsB = Array.from({ length: teamSize }, (_, index) => {
        return {
            slotId: `B${index + 1}`,
            status: "open" as const,
            role: "Player",
        };
    });

    const matchroomInput: Matchroom = {
        hostUid: challenge.captainAUid,
        hostName: challenge.captainAName || "Captain",
        game: challenge.gameKey,
        title: toChallengeTitle(challenge.challengerTeamName, challenge.opponentTeamName),
        description: challenge.message || "Team challenge match",
        status: "open",
        maxPlayers: Math.max(2, teamSize * 2),
        currentPlayers: players.length,
        players,
        playerUids: players.map((player) => player.uid),
        createdAt: new Date(),
        locationMode: "zone",
        zoneId: choiceA.zoneId,
        location: choiceA.venueName || "Zone Venue",
        scheduledDate: challenge.scheduledDate,
        scheduledTime: challenge.scheduledTime,
        durationMinutes: toDurationMinutes(challenge.gameKey, challenge.seriesType),
        pricing: {
            perPlayer: Number(challenge.pricePerPlayer || 0),
            currency: "PKR",
        },
        format: challenge.format,
        seriesType: challenge.seriesType || null,
        teamMode: "team",
        teamId: challenge.challengerTeamId,
        isLocked: false,
        zoneAdminApproved: false,
        slotsA,
        slotsB,
        captainUidA: challenge.captainAUid,
        captainUidB: challenge.captainBUid,
    };

    const matchroomResult = await createMatchroom({
        ...matchroomInput,
        skipBookingRequest: true,
    });
    if (!matchroomResult.ok) {
        return { ok: false as const, message: matchroomResult.message || "Failed to create matchroom." };
    }

    const preferredAreas = challenge.commonAreas?.length
        ? challenge.commonAreas
        : (choiceA.areaLabel ? [choiceA.areaLabel] : []);

    const requestDoc = await addDoc(collection(db, "booking_requests"), {
        userId: challenge.captainAUid,
        userName: challenge.captainAName || "Captain",
        gameKey: challenge.gameKey,
        title: toChallengeTitle(challenge.challengerTeamName, challenge.opponentTeamName),
        description: challenge.message || "Team challenge pending venue admin approval",
        maxPlayers: Math.max(2, maxPlayers || 10),
        teamMode: "team",
        teamId: challenge.challengerTeamId,
        reservedSlots: Math.max(1, players.length),
        preferredDate: challenge.scheduledDate || null,
        preferredTime: challenge.scheduledTime || null,
        flexibilityWindow: "Exact time",
        preferredAreas,
        budgetPerPlayer: 0,
        currency: "PKR",
        locationMode: "zone",
        zoneId: choiceA.zoneId,
        status: "open",
        paymentStatus: "unpaid",
        lifecycleStatus: "team_challenge_admin_pending",
        matchroomId: matchroomResult.id,
        challengeId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    await updateDoc(challengeRef, {
        status: "accepted",
        adminReviewStatus: "pending",
        matchroomId: matchroomResult.id,
        bookingRequestId: requestDoc.id,
        confirmedVenue: choiceA,
        updatedAt: serverTimestamp(),
    });

    const actorUid = actor?.uid || challenge.captainAUid;
    const actorName = actor?.username || (actorUid === challenge.captainBUid ? challenge.captainBName : challenge.captainAName) || "Captain";
    const notifyToUid = actorUid === challenge.captainAUid ? challenge.captainBUid : challenge.captainAUid;
    await upsertChallengeAcceptedNotification({
        challengeId,
        toUid: challenge.captainAUid,
        fromUid: actorUid,
        fromUsername: actorName,
        title: "Matchroom created",
        message: "Team match confirmed. Matchroom created and sent to admin.",
        matchroomId: matchroomResult.id,
        bookingRequestId: requestDoc.id,
    });
    await upsertChallengeAcceptedNotification({
        challengeId,
        toUid: challenge.captainBUid,
        fromUid: actorUid,
        fromUsername: actorName,
        title: "Matchroom created",
        message: "Team match confirmed. Matchroom created and sent to admin.",
        matchroomId: matchroomResult.id,
        bookingRequestId: requestDoc.id,
    });

    return { ok: true as const, matchroomId: matchroomResult.id, bookingRequestId: requestDoc.id };
};

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
}) => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return { ok: false as const, message: "Not authenticated." };
        if (!input.scheduledDate || !input.scheduledTime) {
            return { ok: false as const, message: "Select day/date/time before sending challenge." };
        }
        if (!isValidVenueChoice(input.proposedVenueByCaptainA)) {
            return { ok: false as const, message: "Select preferred zone before sending challenge." };
        }
        const scheduledAt = parseScheduledDateTime(input.scheduledDate, input.scheduledTime);
        if (!scheduledAt) {
            return { ok: false as const, message: "Invalid challenge date/time." };
        }
        if (scheduledAt.getTime() - Date.now() < 24 * 60 * 60 * 1000) {
            return { ok: false as const, message: "Challenge match must be at least 24 hours from now." };
        }

        const [{ team: teamA, memberUids: teamAMemberUids }, { team: teamB, memberUids: teamBMemberUids }] = await Promise.all([
            getTeamMembers(input.challengerTeamId),
            getTeamMembers(input.opponentTeamId),
        ]);

        if (teamA.captainUid !== currentUser.uid) {
            return { ok: false as const, message: "Only your team captain can send a challenge." };
        }
        if (teamA.id === teamB.id) {
            return { ok: false as const, message: "Choose another team to challenge." };
        }
        if (String(teamA.game || "").toLowerCase() !== String(teamB.game || "").toLowerCase()) {
            return { ok: false as const, message: "Both teams must be from the same game." };
        }
        if (!isTeamFilled(teamA, teamAMemberUids) || !isTeamFilled(teamB, teamBMemberUids)) {
            return { ok: false as const, message: "Team challenge can only be sent when both teams are full." };
        }

        const fallbackPlayers = Number(teamA.maxMembers || 0) + Number(teamB.maxMembers || 0);
        const requestedPlayers = Number(input.maxPlayers || 0);
        const computedPlayers = Math.max(2, requestedPlayers > 0 ? requestedPlayers : fallbackPlayers);
        const maxPlayers = String(teamA.game || "").toLowerCase() === "cs2" ? 10 : computedPlayers;
        const computedPricePerPlayer = await computeChallengePricePerPlayer({
            zoneId: input.proposedVenueByCaptainA.zoneId,
            gameKey: teamA.game,
            seriesType: input.seriesType,
            maxPlayers,
        });
        if (computedPricePerPlayer <= 0) {
            return { ok: false as const, message: "Unable to derive price per player from selected zone and series." };
        }

        const created = await addDoc(collection(db, "team_match_challenges"), {
            challengerTeamId: teamA.id,
            challengerTeamName: teamA.name,
            opponentTeamId: teamB.id,
            opponentTeamName: teamB.name,
            captainAUid: teamA.captainUid,
            captainAName: teamA.captainUsername || currentUser.displayName || "Captain",
            captainBUid: teamB.captainUid,
            captainBName: teamB.captainUsername || "Captain",
            gameKey: teamA.game,
            format: input.format || null,
            seriesType: input.seriesType || null,
            maxPlayers,
            scheduledDate: input.scheduledDate || null,
            scheduledTime: input.scheduledTime || null,
            pricePerPlayer: computedPricePerPlayer,
            message: input.message?.trim() || "",
            status: "pending",
            commonAreas: [],
            proposedVenueByCaptainA: input.proposedVenueByCaptainA,
            alternativeVenueByCaptainB: null,
            captainVenueChoices: {},
            confirmedVenue: null,
            chatId: null,
            matchroomId: null,
            bookingRequestId: null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        const notifId = `team_match_challenge_${created.id}_${teamB.captainUid}`;
        await setDoc(doc(db, "notifications", notifId), {
            type: "team_match_challenge",
            fromUid: currentUser.uid,
            fromUsername: teamA.captainUsername || currentUser.displayName || "Captain",
            toUid: teamB.captainUid,
            status: "pending",
            createdAt: serverTimestamp(),
            title: "New team challenge",
            message: `${teamA.name} challenged ${teamB.name}`,
            meta: {
                challengeId: created.id,
                challengerTeamId: teamA.id,
                challengerTeamName: teamA.name,
                opponentTeamId: teamB.id,
                opponentTeamName: teamB.name,
                gameKey: teamA.game,
                scheduledDate: input.scheduledDate || null,
                scheduledTime: input.scheduledTime || null,
                pricePerPlayer: computedPricePerPlayer,
                seriesType: input.seriesType || null,
                proposedVenueByCaptainA: input.proposedVenueByCaptainA,
            },
        }, { merge: true });

        return { ok: true as const, challengeId: created.id };
    } catch (error: any) {
        Logger.error("teamMatchService", "sendTeamMatchChallenge failed", error);
        if (error?.code === "permission-denied") {
            return {
                ok: false as const,
                message: "Permission denied for team challenge write. Deploy latest Firestore rules and retry.",
            };
        }
        return { ok: false as const, message: error?.message || "Failed to send challenge." };
    }
};

const acceptChallengeCore = async (
    challenge: TeamMatchChallenge,
    acceptingUid: string,
) => {
    const [{ memberUids: memberUidsA }, { memberUids: memberUidsB }] = await Promise.all([
        getTeamMembers(challenge.challengerTeamId),
        getTeamMembers(challenge.opponentTeamId),
    ]);
    const commonAreas = await getCommonPreferredAreas([...memberUidsA, ...memberUidsB]);
    const chatId = await createCaptainsChatroom(challenge);
    const proposed = challenge.proposedVenueByCaptainA || null;
    const alternative = challenge.alternativeVenueByCaptainB || null;
    const agreedVenue = alternative || proposed;
    const nextChoices = agreedVenue
        ? {
            ...(challenge.captainVenueChoices || {}),
            [challenge.captainAUid]: agreedVenue,
            [challenge.captainBUid]: agreedVenue,
        }
        : (challenge.captainVenueChoices || {});

    await updateDoc(doc(db, "team_match_challenges", challenge.id), {
        status: "accepted",
        chatId,
        commonAreas,
        captainVenueChoices: nextChoices,
        updatedAt: serverTimestamp(),
    });

    const notifyToUid = acceptingUid === challenge.captainAUid ? challenge.captainBUid : challenge.captainAUid;
    const fromUsername = acceptingUid === challenge.captainAUid ? challenge.captainAName : challenge.captainBName;
    const result = agreedVenue
        ? await maybeCreateMatchroomForChallenge(challenge.id, { uid: acceptingUid, username: fromUsername })
        : { ok: true as const };
    await upsertChallengeAcceptedNotification({
        challengeId: challenge.id,
        toUid: challenge.captainAUid,
        fromUid: acceptingUid,
        fromUsername: fromUsername || "Captain",
        title: "Challenge accepted",
        message: `${challenge.challengerTeamName} vs ${challenge.opponentTeamName} accepted. Captains chat is now open.`,
        chatId,
        matchroomId: (result as any)?.matchroomId || null,
        bookingRequestId: (result as any)?.bookingRequestId || null,
    });
    await upsertChallengeAcceptedNotification({
        challengeId: challenge.id,
        toUid: challenge.captainBUid,
        fromUid: acceptingUid,
        fromUsername: fromUsername || "Captain",
        title: "Challenge accepted",
        message: `${challenge.challengerTeamName} vs ${challenge.opponentTeamName} accepted. Captains chat is now open.`,
        chatId,
        matchroomId: (result as any)?.matchroomId || null,
        bookingRequestId: (result as any)?.bookingRequestId || null,
    });
    await markChallengeNotificationsHandledAsAccepted(challenge.id, challenge.captainBUid);

    return {
        ok: true as const,
        challengeId: challenge.id,
        chatId,
        commonAreas,
        matchroomId: (result as any)?.matchroomId || null,
        bookingRequestId: (result as any)?.bookingRequestId || null,
    };
};

export const acceptTeamMatchChallenge = async (input: {
    challengeId: string;
}) => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return { ok: false as const, message: "Not authenticated." };

        const challengeRef = doc(db, "team_match_challenges", input.challengeId);
        const challengeSnap = await getDoc(challengeRef);
        if (!challengeSnap.exists()) {
            return { ok: false as const, message: "Challenge not found." };
        }
        const challenge = { id: challengeSnap.id, ...challengeSnap.data() } as TeamMatchChallenge;
        if (challenge.status !== "pending") {
            const statusText = String(challenge.status || "resolved").replace(/_/g, " ");
            return { ok: false as const, message: `Challenge is already ${statusText}.` };
        }

        const hasAlternative = !!challenge.alternativeVenueByCaptainB?.zoneId;
        const expectedAccepter = hasAlternative ? challenge.captainAUid : challenge.captainBUid;
        if (currentUser.uid !== expectedAccepter) {
            return {
                ok: false as const,
                message: hasAlternative
                    ? "Only challenger captain can accept the proposed alternative zone."
                    : "Only challenged captain can accept this challenge.",
            };
        }

        return await acceptChallengeCore(challenge, currentUser.uid);
    } catch (error: any) {
        Logger.error("teamMatchService", "acceptTeamMatchChallenge failed", error);
        if (error?.code === "permission-denied") {
            return {
                ok: false as const,
                message: "Permission denied for challenge acceptance. Deploy latest Firestore rules and retry.",
            };
        }
        return { ok: false as const, message: error?.message || "Failed to accept challenge." };
    }
};

export const rejectTeamMatchChallenge = async (input: {
    challengeId: string;
}) => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return { ok: false as const, message: "Not authenticated." };

        const challengeRef = doc(db, "team_match_challenges", input.challengeId);
        const challengeSnap = await getDoc(challengeRef);
        if (!challengeSnap.exists()) {
            return { ok: false as const, message: "Challenge not found." };
        }
        const challenge = { id: challengeSnap.id, ...challengeSnap.data() } as TeamMatchChallenge;
        if (challenge.status !== "pending") {
            const statusText = String(challenge.status || "resolved").replace(/_/g, " ");
            return { ok: false as const, message: `Challenge is already ${statusText}.` };
        }
        if (![challenge.captainAUid, challenge.captainBUid].includes(currentUser.uid)) {
            return { ok: false as const, message: "Only captains can reject challenge." };
        }

        await updateDoc(challengeRef, { status: "rejected", updatedAt: serverTimestamp() });
        const notifyToUid = currentUser.uid === challenge.captainAUid ? challenge.captainBUid : challenge.captainAUid;
        const fromUsername = currentUser.uid === challenge.captainAUid ? challenge.captainAName : challenge.captainBName;
        await addDoc(collection(db, "notifications"), {
            type: "team_match_challenge_update",
            fromUid: currentUser.uid,
            fromUsername: fromUsername || "Captain",
            toUid: notifyToUid,
            status: "accepted",
            createdAt: serverTimestamp(),
            title: "Challenge declined",
            message: `${challenge.challengerTeamName} vs ${challenge.opponentTeamName} was declined.`,
            meta: { challengeId: challenge.id },
        });
        await markChallengeNotificationsHandledAsAccepted(challenge.id, challenge.captainBUid);
        return { ok: true as const, challengeId: challenge.id };
    } catch (error: any) {
        Logger.error("teamMatchService", "rejectTeamMatchChallenge failed", error);
        if (error?.code === "permission-denied") {
            return {
                ok: false as const,
                message: "Permission denied for challenge rejection. Deploy latest Firestore rules and retry.",
            };
        }
        return { ok: false as const, message: error?.message || "Failed to reject challenge." };
    }
};

export const suggestTeamMatchChallengeAlternativeZone = async (input: {
    challengeId: string;
    zoneId: string;
    venueName: string;
    areaLabel?: string | null;
}) => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return { ok: false as const, message: "Not authenticated." };

        const challengeRef = doc(db, "team_match_challenges", input.challengeId);
        const challengeSnap = await getDoc(challengeRef);
        if (!challengeSnap.exists()) {
            return { ok: false as const, message: "Challenge not found." };
        }
        const challenge = { id: challengeSnap.id, ...challengeSnap.data() } as TeamMatchChallenge;
        if (challenge.status !== "pending") {
            return { ok: false as const, message: "Challenge is not pending." };
        }
        if (challenge.captainBUid !== currentUser.uid) {
            return { ok: false as const, message: "Only challenged captain can suggest an alternative zone." };
        }

        const alternativeVenueByCaptainB: TeamChallengeVenueChoice = {
            zoneId: input.zoneId,
            venueName: input.venueName,
            areaLabel: input.areaLabel || null,
        };

        await updateDoc(challengeRef, {
            alternativeVenueByCaptainB,
            updatedAt: serverTimestamp(),
        });
        await addDoc(collection(db, "notifications"), {
            type: "team_match_challenge_update",
            fromUid: currentUser.uid,
            fromUsername: challenge.captainBName || "Captain",
            toUid: challenge.captainAUid,
            status: "pending",
            createdAt: serverTimestamp(),
            title: "Alternative zone proposed",
            message: `${challenge.opponentTeamName} proposed an alternative venue.`,
            meta: {
                challengeId: challenge.id,
                alternativeVenueByCaptainB,
            },
        });
        return { ok: true as const };
    } catch (error: any) {
        Logger.error("teamMatchService", "suggestTeamMatchChallengeAlternativeZone failed", error);
        if (error?.code === "permission-denied") {
            return {
                ok: false as const,
                message: "Permission denied for alternative venue proposal. Deploy latest Firestore rules and retry.",
            };
        }
        return { ok: false as const, message: error?.message || "Failed to suggest alternative zone." };
    }
};

export const respondToTeamMatchChallenge = async (input: {
    notificationId: string;
    decision: "accept" | "reject";
}) => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return { ok: false as const, message: "Not authenticated." };

        const notifRef = doc(db, "notifications", input.notificationId);
        const notifSnap = await getDoc(notifRef);
        if (!notifSnap.exists()) {
            return { ok: false as const, message: "Challenge notification not found." };
        }
        const notif = notifSnap.data() as any;
        if (notif.toUid !== currentUser.uid) {
            return { ok: false as const, message: "Not authorized." };
        }
        if (notif.status !== "pending") {
            return { ok: false as const, message: "Challenge already handled." };
        }
        const challengeId = notif?.meta?.challengeId;
        if (!challengeId) {
            return { ok: false as const, message: "Challenge reference missing." };
        }

        const challengeRef = doc(db, "team_match_challenges", challengeId);
        const challengeSnap = await getDoc(challengeRef);
        if (!challengeSnap.exists()) {
            return { ok: false as const, message: "Challenge not found." };
        }
        const challenge = { id: challengeSnap.id, ...challengeSnap.data() } as TeamMatchChallenge;
        if (challenge.captainBUid !== currentUser.uid) {
            return { ok: false as const, message: "Only challenged captain can respond." };
        }
        if (challenge.status !== "pending") {
            const statusText = String(challenge.status || "resolved").replace(/_/g, " ");
            return { ok: false as const, message: `Challenge is already ${statusText}.` };
        }

        if (input.decision === "reject") {
            const rejection = await rejectTeamMatchChallenge({ challengeId: challenge.id });
            if (!rejection.ok) return rejection;
            await updateDoc(notifRef, { status: "accepted", updatedAt: serverTimestamp() });
            return { ok: true as const, challengeId: challenge.id };
        }

        const accepted = await acceptTeamMatchChallenge({ challengeId: challenge.id });
        if (!accepted.ok) return accepted;
        await Promise.all([
            updateDoc(notifRef, { status: "accepted", updatedAt: serverTimestamp() }),
            updateDoc(challengeRef, { updatedAt: serverTimestamp() }),
        ]);
        return accepted;
    } catch (error: any) {
        Logger.error("teamMatchService", "respondToTeamMatchChallenge failed", error);
        if (error?.code === "permission-denied") {
            return {
                ok: false as const,
                message: "Permission denied for team challenge update. Deploy latest Firestore rules and retry.",
            };
        }
        return { ok: false as const, message: error?.message || "Failed to respond to challenge." };
    }
};

export const proposeTeamChallengeVenue = async (input: {
    challengeId: string;
    zoneId: string;
    venueName: string;
    areaLabel?: string | null;
}) => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return { ok: false as const, message: "Not authenticated." };

        const challengeRef = doc(db, "team_match_challenges", input.challengeId);
        const challengeSnap = await getDoc(challengeRef);
        if (!challengeSnap.exists()) {
            return { ok: false as const, message: "Challenge not found." };
        }
        const challenge = { id: challengeSnap.id, ...challengeSnap.data() } as TeamMatchChallenge;
        if (![challenge.captainAUid, challenge.captainBUid].includes(currentUser.uid)) {
            return { ok: false as const, message: "Only captains can propose venue." };
        }
        if (!["accepted", "venue_proposed", "venue_confirmed"].includes(challenge.status)) {
            return { ok: false as const, message: "Challenge is not in venue proposal state." };
        }

        const existing = challenge.captainVenueChoices || {};
        const nextChoices = {
            ...existing,
            [currentUser.uid]: {
                zoneId: input.zoneId,
                venueName: input.venueName,
                areaLabel: input.areaLabel || null,
            },
        };

        await updateDoc(challengeRef, {
            captainVenueChoices: nextChoices,
            status: "venue_proposed",
            updatedAt: serverTimestamp(),
        });

        const result = await maybeCreateMatchroomForChallenge(input.challengeId, {
            uid: currentUser.uid,
            username: currentUser.displayName || null,
        });
        return result;
    } catch (error: any) {
        Logger.error("teamMatchService", "proposeTeamChallengeVenue failed", error);
        if (error?.code === "permission-denied") {
            return {
                ok: false as const,
                message: "Permission denied for venue proposal. Deploy latest Firestore rules and retry.",
            };
        }
        return { ok: false as const, message: error?.message || "Failed to propose venue." };
    }
};

export const repairTeamMatchChallenge = async (challengeId: string) => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return { ok: false as const, message: "Not authenticated." };

        const challengeRef = doc(db, "team_match_challenges", challengeId);
        const challengeSnap = await getDoc(challengeRef);
        if (!challengeSnap.exists()) return { ok: false as const, message: "Challenge not found." };
        const challenge = { id: challengeSnap.id, ...challengeSnap.data() } as TeamMatchChallenge;

        if (![challenge.captainAUid, challenge.captainBUid].includes(currentUser.uid)) {
            return { ok: false as const, message: "Not authorized to repair this challenge." };
        }

        const patch: Record<string, any> = {};
        let repairedMatchroom = false;
        const normalizedGame = String(challenge.gameKey || "").toLowerCase();
        const normalizedChallengePlayers = normalizedGame === "cs2"
            ? 10
            : Math.max(2, Number(challenge.maxPlayers || 0));
        if (normalizedGame === "cs2" && Number(challenge.maxPlayers || 0) !== 10) {
            patch.maxPlayers = 10;
        }
        if (!isValidVenueChoice(challenge.proposedVenueByCaptainA)) {
            const fallback = challenge.captainVenueChoices?.[challenge.captainAUid] || challenge.confirmedVenue || null;
            if (isValidVenueChoice(fallback)) {
                patch.proposedVenueByCaptainA = fallback;
            }
        }

        if ((!challenge.scheduledDate || !challenge.scheduledTime) && challenge.matchroomId) {
            const matchSnap = await getDoc(doc(db, "matchrooms", challenge.matchroomId));
            if (matchSnap.exists()) {
                const match = matchSnap.data() as any;
                if (!challenge.scheduledDate && match?.scheduledDate) patch.scheduledDate = match.scheduledDate;
                if (!challenge.scheduledTime && match?.scheduledTime) patch.scheduledTime = match.scheduledTime;
            }
        }
        if ((!challenge.pricePerPlayer || Number(challenge.pricePerPlayer) <= 0) && isValidVenueChoice(challenge.proposedVenueByCaptainA)) {
            const candidatePlayers = normalizedChallengePlayers;
            const computed = await computeChallengePricePerPlayer({
                zoneId: challenge.proposedVenueByCaptainA.zoneId,
                gameKey: challenge.gameKey,
                seriesType: challenge.seriesType,
                maxPlayers: candidatePlayers,
            });
            if (computed > 0) patch.pricePerPlayer = computed;
        }

        if (challenge.matchroomId && String(challenge.status || "").trim().toLowerCase() === "pending") {
            const matchRef = doc(db, "matchrooms", challenge.matchroomId);
            const matchSnap = await getDoc(matchRef);
            if (matchSnap.exists()) {
                const match = matchSnap.data() as any;
                const teamSize = Math.max(1, Math.ceil(normalizedChallengePlayers / 2));
                const { memberUids: memberUidsA, usernameByUid: usernameByUidA } = await getTeamMembers(challenge.challengerTeamId);
                const teamAUids = dedupe([challenge.captainAUid, ...memberUidsA.filter((uid) => uid !== challenge.captainAUid)]).slice(0, teamSize);
                const repairedPlayers = teamAUids.map((uid) => ({
                    uid,
                    username: (uid === challenge.captainAUid ? challenge.captainAName : null) || usernameByUidA[uid] || "Player",
                    joinedAt: new Date(),
                    role: uid === challenge.captainAUid ? "Captain A" : "Player",
                }));
                const repairedSlotsA = Array.from({ length: teamSize }, (_, index) => {
                    const uid = teamAUids[index];
                    const player = uid ? repairedPlayers.find((entry) => entry.uid === uid) : null;
                    if (!uid || !player) {
                        return { slotId: `A${index + 1}`, status: "open", role: "Player" };
                    }
                    return {
                        slotId: `A${index + 1}`,
                        uid,
                        user: { uid, username: player.username },
                        status: "confirmed",
                        role: player.role,
                    };
                });
                const repairedSlotsB = Array.from({ length: teamSize }, (_, index) => ({
                    slotId: `B${index + 1}`,
                    status: "open",
                    role: "Player",
                }));

                const hasWrongSize =
                    Number(match?.maxPlayers || 0) !== teamSize * 2 ||
                    !Array.isArray(match?.slotsA) ||
                    !Array.isArray(match?.slotsB) ||
                    match.slotsA.length !== teamSize ||
                    match.slotsB.length !== teamSize;
                const teamBHasFilledSlots = Array.isArray(match?.slotsB)
                    ? match.slotsB.some((slot: any) =>
                        Boolean(slot?.uid || slot?.user?.uid || String(slot?.status || "").toLowerCase() === "confirmed"))
                    : false;

                if (hasWrongSize || teamBHasFilledSlots) {
                    await updateDoc(matchRef, {
                        maxPlayers: teamSize * 2,
                        currentPlayers: repairedPlayers.length,
                        players: repairedPlayers,
                        playerUids: repairedPlayers.map((entry) => entry.uid),
                        slotsA: repairedSlotsA,
                        slotsB: repairedSlotsB,
                        updatedAt: serverTimestamp(),
                    });
                    repairedMatchroom = true;
                }
            }
        }

        if (Object.keys(patch).length > 0) {
            patch.updatedAt = serverTimestamp();
            await updateDoc(challengeRef, patch);
        }

        const refreshedSnap = await getDoc(challengeRef);
        if (!refreshedSnap.exists()) return { ok: false as const, message: "Challenge not found after repair." };
        const refreshed = { id: refreshedSnap.id, ...refreshedSnap.data() } as TeamMatchChallenge;

        if (refreshed.status === "pending" && !hasRequiredChallengeScheduling(refreshed)) {
            await updateDoc(challengeRef, { status: "rejected", updatedAt: serverTimestamp() });
            return { ok: true as const, repaired: true, rejected: true };
        }

        return { ok: true as const, repaired: Object.keys(patch).length > 0 || repairedMatchroom, rejected: false };
    } catch (error: any) {
        Logger.error("teamMatchService", "repairTeamMatchChallenge failed", error);
        return { ok: false as const, message: error?.message || "Failed to repair challenge." };
    }
};

export const repairTeamChallengesForCaptain = async (uid: string) => {
    try {
        const rows = await getChallengesForCaptain(uid);
        if (!rows.ok || !rows.data) return { ok: false as const, message: rows.message || "Failed to load challenges." };

        let repairedCount = 0;
        for (const item of rows.data) {
            const result = await repairTeamMatchChallenge(item.id);
            if (result.ok && ((result as any).repaired || (result as any).rejected)) {
                repairedCount += 1;
            }
        }
        return { ok: true as const, repairedCount };
    } catch (error: any) {
        Logger.error("teamMatchService", "repairTeamChallengesForCaptain failed", error);
        return { ok: false as const, message: error?.message || "Failed to repair challenges." };
    }
};

export const getTeamMatchChallengeById = async (challengeId: string) => {
    try {
        const snap = await getDoc(doc(db, "team_match_challenges", challengeId));
        if (!snap.exists()) return { ok: false as const, message: "Challenge not found." };
        const data = { id: snap.id, ...snap.data() } as TeamMatchChallenge;
        return { ok: true as const, data };
    } catch (error: any) {
        Logger.error("teamMatchService", "getTeamMatchChallengeById failed", error);
        return { ok: false as const, message: error?.message || "Failed to load challenge." };
    }
};

export const subscribeTeamMatchChallenge = (
    challengeId: string,
    onData: (challenge: TeamMatchChallenge | null) => void,
    onError?: (error: any) => void,
) => {
    return onSnapshot(
        doc(db, "team_match_challenges", challengeId),
        (snap: any) => {
            if (!snap.exists()) {
                onData(null);
                return;
            }
            const data = { id: snap.id, ...snap.data() } as TeamMatchChallenge;
            onData(data);
        },
        (error: any) => {
            if (onError) onError(error);
        },
    );
};

export const getCaptainedTeams = async (uid: string) => {
    try {
        const q = query(collection(db, "teams"), where("captainUid", "==", uid));
        const snapshot = await getDocs(q);
        const rows = snapshot.docs
            .map((item: any) => ({ id: item.id, ...item.data() } as Team))
            .sort((a: Team, b: Team) => toMillis(b.createdAt) - toMillis(a.createdAt));
        return { ok: true as const, data: rows };
    } catch (error: any) {
        Logger.error("teamMatchService", "getCaptainedTeams failed", error);
        return { ok: false as const, message: error?.message || "Failed to load captain teams." };
    }
};

export const getChallengesForCaptain = async (uid: string) => {
    try {
        const [asA, asB] = await Promise.all([
            getDocs(query(collection(db, "team_match_challenges"), where("captainAUid", "==", uid))),
            getDocs(query(collection(db, "team_match_challenges"), where("captainBUid", "==", uid))),
        ]);
        const byId = new Map<string, TeamMatchChallenge>();
        asA.docs.forEach((item: any) => byId.set(item.id, { id: item.id, ...item.data() } as TeamMatchChallenge));
        asB.docs.forEach((item: any) => byId.set(item.id, { id: item.id, ...item.data() } as TeamMatchChallenge));
        const rows = Array.from(byId.values())
            .filter((item: TeamMatchChallenge) => item.status !== "rejected")
            .sort(
            (a: TeamMatchChallenge, b: TeamMatchChallenge) => toMillis(b.createdAt) - toMillis(a.createdAt),
        );
        return { ok: true as const, data: rows };
    } catch (error: any) {
        Logger.error("teamMatchService", "getChallengesForCaptain failed", error);
        return { ok: false as const, message: error?.message || "Failed to load challenges." };
    }
};
