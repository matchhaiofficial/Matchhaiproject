import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import AppHeader from "../../src/components/AppHeader";
import { AppButton, AppCard } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import { Perf, type PerfEventV1 } from "../../src/utils/perfInstrumentation";
import { COLORS } from "../../src/theme";

function formatEvent(event: PerfEventV1) {
  return JSON.stringify(event, null, 2);
}

export default function PerfDebugScreen() {
  const [events, setEvents] = useState<PerfEventV1[]>([]);

  useEffect(() => {
    if (!__DEV__) {
      router.replace("/");
      return;
    }

    void Perf.ensureLoaded().then(() => {
      setEvents(Perf.getEvents());
    });

    const interval = setInterval(() => {
      setEvents(Perf.getEvents());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  if (!__DEV__) {
    return null;
  }

  const visibleEvents = [...events].reverse().slice(0, 100);

  return (
    <Screen scroll style={{ flex: 1 }} routeKey="/debug/perf" contentStyle={{ paddingBottom: 32 }}>
      <AppHeader title="Perf Debug" onBack={() => router.back()} inlineTitle />

      <AppCard style={{ marginBottom: 16 }}>
        <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: "700" }}>Recent events</Text>
        <Text style={{ color: COLORS.textSecondary, marginTop: 6 }}>
          {events.length} events buffered locally. Last 100 shown here.
        </Text>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          <AppButton
            variant="secondary"
            style={{ flex: 1 }}
            onPress={async () => {
              await Clipboard.setStringAsync(Perf.exportJson());
            }}
          >
            Copy JSON
          </AppButton>
          <AppButton
            variant="danger"
            style={{ flex: 1 }}
            onPress={async () => {
              await Perf.clear();
              setEvents([]);
            }}
          >
            Clear
          </AppButton>
        </View>
      </AppCard>

      <ScrollView showsVerticalScrollIndicator={false}>
        {visibleEvents.map((event) => (
          <AppCard key={`${event.ts}-${event.sid || event.name}`} style={{ marginBottom: 12 }}>
            <Text style={{ color: COLORS.accent, fontWeight: "700" }}>{event.name}</Text>
            <Text style={{ color: COLORS.textSecondary, marginTop: 4 }}>
              {new Date(event.ts).toLocaleTimeString()} | {event.type}
            </Text>
            <Text
              style={{
                color: COLORS.text,
                marginTop: 10,
                fontFamily: "monospace",
                fontSize: 12,
                lineHeight: 18,
              }}
            >
              {formatEvent(event)}
            </Text>
          </AppCard>
        ))}
      </ScrollView>
    </Screen>
  );
}
