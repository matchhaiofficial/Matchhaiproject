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

export type TeamMatchChallengeStatus =
    | "pending"
    | "accepted"
    | "rejected"
    | "venue_proposed"
    | "venue_confirmed"
    | "admin_pending"
    | "completed";

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
    message?: string;
    status: TeamMatchChallengeStatus;
    commonAreas: string[];
    captainVenueChoices?: Record<string, {
        zoneId: string;
        venueName: string;
        areaLabel?: string | null;
    }>;
    confirmedVenue?: {
        zoneId: string;
        venueName: string;
        areaLabel?: string | null;
    } | null;
    chatId?: string | null;
    matchroomId?: string | null;
    bookingRequestId?: string | null;
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

const normalizeAreas = (areas: unknown): string[] => {
    if (!Array.isArray(areas)) return [];
    return Array.from(new Set(
        areas.map((area) => String(area || "").trim()).filter(Boolean),
    ));
};

const dedupe = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const getTeamMembers = async (teamId: string) => {
    const teamSnap = await getDoc(doc(db, "teams", teamId));
    if (!teamSnap.exists()) {
        throw new Error("Team not found");
    }
    const teamData = { id: teamSnap.id, ...teamSnap.data() } as Team;

    const membersSnap = await getDocs(collection(db, "teams", teamId, "members"));
    const members = membersSnap.docs.map((item: any) => item.data() as any);

    const memberUids = dedupe([
        ...(Array.isArray(teamData.memberUids) ? teamData.memberUids : []),
        ...members.map((item: any) => String(item?.uid || "")).filter(Boolean),
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

const maybeCreateMatchroomForChallenge = async (challengeId: string) => {
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

    const [{ team: teamA }, { team: teamB }] = await Promise.all([
        getTeamMembers(challenge.challengerTeamId),
        getTeamMembers(challenge.opponentTeamId),
    ]);

    const maxPlayers = Number(challenge.maxPlayers || teamA.memberCount || 0) + Number(teamB.memberCount || 0);
    const matchroomInput: Matchroom = {
        hostUid: challenge.captainAUid,
        hostName: challenge.captainAName || "Captain",
        game: challenge.gameKey,
        title: toChallengeTitle(challenge.challengerTeamName, challenge.opponentTeamName),
        description: challenge.message || "Team challenge match",
        status: "open",
        maxPlayers: Math.max(2, maxPlayers || 10),
        currentPlayers: 1,
        players: [{
            uid: challenge.captainAUid,
            username: challenge.captainAName || "Captain",
            joinedAt: new Date(),
            role: "Host",
        }],
        playerUids: [challenge.captainAUid],
        createdAt: new Date(),
        locationMode: "zone",
        zoneId: choiceA.zoneId,
        location: choiceA.venueName || "Zone Venue",
        scheduledDate: challenge.scheduledDate,
        scheduledTime: challenge.scheduledTime,
        durationMinutes: toDurationMinutes(challenge.gameKey, challenge.seriesType),
        pricing: {
            perPlayer: 0,
            currency: "PKR",
        },
        format: challenge.format,
        seriesType: challenge.seriesType || null,
        teamMode: "team",
        teamId: challenge.challengerTeamId,
        isLocked: false,
        zoneAdminApproved: false,
        slotsA: [],
        slotsB: [],
    };

    const matchroomResult = await createMatchroom(matchroomInput);
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
        reservedSlots: Math.max(1, Number(teamA.memberCount || 1)),
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
        status: "admin_pending",
        matchroomId: matchroomResult.id,
        bookingRequestId: requestDoc.id,
        confirmedVenue: choiceA,
        updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, "notifications"), {
        type: "team_match_challenge_update",
        fromUid: challenge.captainAUid,
        fromUsername: challenge.captainAName || "Captain",
        toUid: challenge.captainBUid,
        status: "accepted",
        createdAt: serverTimestamp(),
        title: "Matchroom created",
        message: "Venue confirmed by both captains. Matchroom created and sent to admin.",
        meta: {
            challengeId,
            matchroomId: matchroomResult.id,
            bookingRequestId: requestDoc.id,
        },
    });

    return { ok: true as const, matchroomId: matchroomResult.id, bookingRequestId: requestDoc.id };
};

export const sendTeamMatchChallenge = async (input: {
    challengerTeamId: string;
    opponentTeamId: string;
    message?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    format?: string;
    seriesType?: string | null;
    maxPlayers?: number;
}) => {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) return { ok: false as const, message: "Not authenticated." };

        const [{ team: teamA }, { team: teamB }] = await Promise.all([
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

        const maxPlayers = Number(input.maxPlayers || teamA.maxMembers || 0) + Number(teamB.maxMembers || 0);
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
            maxPlayers: Math.max(2, maxPlayers || 10),
            scheduledDate: input.scheduledDate || null,
            scheduledTime: input.scheduledTime || null,
            message: input.message?.trim() || "",
            status: "pending",
            commonAreas: [],
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
            return { ok: false as const, message: "Challenge already resolved." };
        }

        if (input.decision === "reject") {
            await Promise.all([
                updateDoc(notifRef, { status: "rejected", updatedAt: serverTimestamp() }),
                updateDoc(challengeRef, { status: "rejected", updatedAt: serverTimestamp() }),
            ]);
            await addDoc(collection(db, "notifications"), {
                type: "team_match_challenge_update",
                fromUid: currentUser.uid,
                fromUsername: challenge.captainBName || "Captain",
                toUid: challenge.captainAUid,
                status: "rejected",
                createdAt: serverTimestamp(),
                title: "Challenge declined",
                message: `${challenge.opponentTeamName} declined the challenge.`,
                meta: {
                    challengeId: challenge.id,
                },
            });
            return { ok: true as const };
        }

        const [{ memberUids: memberUidsA }, { memberUids: memberUidsB }] = await Promise.all([
            getTeamMembers(challenge.challengerTeamId),
            getTeamMembers(challenge.opponentTeamId),
        ]);
        const commonAreas = await getCommonPreferredAreas([...memberUidsA, ...memberUidsB]);
        const chatId = await createCaptainsChatroom(challenge);

        await Promise.all([
            updateDoc(notifRef, { status: "accepted", updatedAt: serverTimestamp() }),
            updateDoc(challengeRef, {
                status: "accepted",
                chatId,
                commonAreas,
                updatedAt: serverTimestamp(),
            }),
        ]);

        await addDoc(collection(db, "notifications"), {
            type: "team_match_challenge_update",
            fromUid: currentUser.uid,
            fromUsername: challenge.captainBName || "Captain",
            toUid: challenge.captainAUid,
            status: "accepted",
            createdAt: serverTimestamp(),
            title: "Challenge accepted",
            message: `${challenge.opponentTeamName} accepted. Captains chat is now open.`,
            meta: {
                challengeId: challenge.id,
                chatId,
                commonAreas,
            },
        });

        return { ok: true as const, challengeId: challenge.id, chatId, commonAreas };
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

        const result = await maybeCreateMatchroomForChallenge(input.challengeId);
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

export const getTeamMatchChallengeById = async (challengeId: string) => {
    try {
        const snap = await getDoc(doc(db, "team_match_challenges", challengeId));
        if (!snap.exists()) return { ok: false as const, message: "Challenge not found." };
        return { ok: true as const, data: { id: snap.id, ...snap.data() } as TeamMatchChallenge };
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
            onData({ id: snap.id, ...snap.data() } as TeamMatchChallenge);
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
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
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
        const rows = Array.from(byId.values()).sort(
            (a: TeamMatchChallenge, b: TeamMatchChallenge) => toMillis(b.createdAt) - toMillis(a.createdAt),
        );
        return { ok: true as const, data: rows };
    } catch (error: any) {
        Logger.error("teamMatchService", "getChallengesForCaptain failed", error);
        return { ok: false as const, message: error?.message || "Failed to load challenges." };
    }
};
