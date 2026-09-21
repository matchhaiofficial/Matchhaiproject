import { useSegments } from "expo-router";
import { useEffect, useRef } from "react";

import { useAuth } from "../context/AuthContext";
import { captureAnalyticsScreen, identifyAnalyticsUser, resetAnalyticsIdentity } from "../lib/analytics/posthog";

export default function AnalyticsRuntimeBridge() {
  const segments = useSegments();
  const { loading, user } = useAuth();
  const lastRouteRef = useRef<string | null>(null);
  const identifiedUserRef = useRef<string | null>(null);
  const identitySignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const route = `/${segments.join("/")}`;
    if (lastRouteRef.current === route) return;
    lastRouteRef.current = route;
    captureAnalyticsScreen(route);
  }, [segments]);

  useEffect(() => {
    if (loading) return;
    const nextUserId = user?._id ? String(user._id) : null;

    if (nextUserId) {
      const identitySignature = [
        nextUserId,
        user?.accountType || "player",
        user?.accountStatus || "active",
        user?.kycVerificationStatus || "not_started",
      ].join(":");
      if (identitySignatureRef.current !== identitySignature) {
        identifyAnalyticsUser(nextUserId, {
          account_type: user?.accountType || "player",
          status: user?.accountStatus || "active",
          stage: user?.kycVerificationStatus || "not_started",
        });
        identifiedUserRef.current = nextUserId;
        identitySignatureRef.current = identitySignature;
      }
      return;
    }

    if (identifiedUserRef.current) {
      resetAnalyticsIdentity();
      identifiedUserRef.current = null;
      identitySignatureRef.current = null;
    }
  }, [loading, user?._id, user?.accountType, user?.accountStatus, user?.kycVerificationStatus]);

  return null;
}
