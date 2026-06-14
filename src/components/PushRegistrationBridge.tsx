import React, { useEffect } from "react";

import { useAuth } from "../context/AuthContext";
import {
  cancelPendingPushRegistrationSync,
  syncPushRegistration,
} from "../services/pushRegistration";
import Logger from "../utils/logger";

export default function PushRegistrationBridge() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!user?._id) {
      return;
    }

    syncPushRegistration({ userId: user._id })
      .catch((error) => {
        Logger.warn("PushRegistrationBridge", "Push registration sync failed", error);
      });

    return () => {
      cancelPendingPushRegistrationSync();
    };
  }, [loading, user?._id]);

  return null;
}
