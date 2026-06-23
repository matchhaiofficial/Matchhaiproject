import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useMemo } from "react";

import { api } from "../../convex/_generated/api";
import { useAuth } from "../context/AuthContext";
import { isAuthenticatedProfileReady } from "../utils/authReadiness";
import { isKycAccessAllowed, isKycReviewActive } from "../utils/verificationGate";

export function useEffectiveKycStatus() {
    const { user, authUser, loading: authLoading, refreshUser } = useAuth();
    const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();

    const protectedQueryReady = isAuthenticatedProfileReady({
        authLoading,
        convexAuthLoading,
        isAuthenticated,
        authUserId: authUser?.id,
        profileAuthId: user?.authId,
        profileUserId: user?._id,
    });

    const currentKyc = useQuery(
        api.kyc.getCurrentUserKyc,
        protectedQueryReady ? {} : "skip",
    );

    const status = currentKyc?.status || user?.kycVerificationStatus || null;
    const accessAllowed = isKycAccessAllowed(status);
    const reviewActive = isKycReviewActive(status);

    useEffect(() => {
        if (currentKyc?.status !== "verified") return;
        if (user?.kycVerificationStatus === "verified") return;
        void refreshUser();
    }, [currentKyc?.status, refreshUser, user?.kycVerificationStatus]);

    return useMemo(
        () => ({
            currentKyc,
            status,
            accessAllowed,
            reviewActive,
            protectedQueryReady,
            isLoading: protectedQueryReady && currentKyc === undefined,
        }),
        [accessAllowed, currentKyc, protectedQueryReady, reviewActive, status],
    );
}
