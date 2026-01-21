import { Redirect } from "expo-router";
import React from "react";

/**
 * find-players.tsx - Redirect Component
 * 
 * This page has been deprecated in favor of the Discover module's Players segment.
 * We use a Redirect component to ensure that any navigation to this path
 * (from bookmarks or deep links) correctly lands on the Discover tab.
 */
export default function FindPlayersRedirect() {
    return <Redirect href="/(player)/(tabs)/discover?segment=players" />;
}
