export type TrophyCounts = {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
};

export type PsnGameStats = {
    present: boolean;
    progress: number | null;
    earnedTrophies: TrophyCounts | null;
    lastPlayedDateTime: string | null; // ISO string
    playDuration?: string | null; // e.g. "PT10H"
    formatPlayDuration?: string | null; // e.g. "10 hours"
};

export type PsnVerificationResult = {
    psnOnlineId: string;
    psnAccountId: string;
    avatarUrl?: string; // PSN Avatar
    profileUrl?: string; // psnprofiles.com link

    trophyLevel: string;
    trophyTier: string;
    totalTrophies: TrophyCounts;

    tekken8: PsnGameStats;
    fc: PsnGameStats;

    psnLastSyncedAt: string;
};

export type PsnVerifyRequest = {
    psnOnlineId: string;
    wantsTekken?: boolean;
    wantsFc?: boolean;
};
