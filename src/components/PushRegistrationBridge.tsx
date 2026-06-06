import React, { useEffect } from "react";

import { useAuth } from "../context/AuthContext";
import { syncPushRegistration } from "../services/pushRegistration";
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
  }, [loading, user?._id]);

  return null;
}
