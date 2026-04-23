import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "../src/context/AuthContext";
import { COLORS } from "../src/theme";
import { getDefaultSignedInRoute } from "../src/utils/accountRouting";

export default function IndexGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.backgroundDark, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={COLORS.accent} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/auth/login" />;
  }

  const target = getDefaultSignedInRoute(user);
  return <Redirect href={target as any} />;
}

