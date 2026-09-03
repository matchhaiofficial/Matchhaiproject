import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";

import { useAuth } from "../src/context/AuthContext";
import MatchhaiLaunchScreen from "../src/features/launch/MatchhaiLaunchScreen";
import { getDefaultSignedInRoute } from "../src/utils/accountRouting";

const LAUNCH_MIN_DURATION_MS = 1000;
const LAUNCH_EXIT_DURATION_MS = 180;

export default function IndexGate() {
  const { user, loading } = useAuth();
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [exitingLaunch, setExitingLaunch] = useState(false);
  const [canRedirect, setCanRedirect] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinimumElapsed(true);
    }, LAUNCH_MIN_DURATION_MS);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading || !minimumElapsed || canRedirect) return;

    setExitingLaunch(true);
    const timer = setTimeout(() => {
      setCanRedirect(true);
    }, LAUNCH_EXIT_DURATION_MS);

    return () => clearTimeout(timer);
  }, [canRedirect, loading, minimumElapsed]);

  if (loading || !canRedirect) {
    return <MatchhaiLaunchScreen exiting={exitingLaunch} />;
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  const target = getDefaultSignedInRoute(user);
  return <Redirect href={target as any} />;
}

