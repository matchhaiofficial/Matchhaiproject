import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppCard } from "./AppPrimitives";
import { COLORS, FONTS, SPACING } from "../theme";

type TimelineItem = {
  key: string;
  label: string;
  date?: number | null;
  actor?: string | null;
  active?: boolean;
};

type ReportTimelineProps = {
  items: TimelineItem[];
  title?: string;
  emptyText?: string;
};

function formatDate(value?: number | null) {
  if (!value) return "Waiting";
  return new Date(value).toLocaleString();
}

export default function ReportTimeline({
  items,
  title = "Timeline",
  emptyText = "No status updates yet.",
}: ReportTimelineProps) {
  const visibleItems = items.filter((item) => item.active);

  return (
    <AppCard>
      <Text style={styles.title}>{title}</Text>

      {visibleItems.length === 0 ? (
        <Text style={styles.emptyText}>{emptyText}</Text>
      ) : (
        <View style={styles.timeline}>
          {visibleItems.map((item, index) => {
            const isLast = index === visibleItems.length - 1;
            return (
              <View key={item.key} style={styles.itemRow}>
                <View style={styles.railWrap}>
                  <View style={styles.dot} />
                  {!isLast ? <View style={styles.rail} /> : null}
                </View>
                <View style={styles.itemContent}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <Text style={styles.itemMeta}>{formatDate(item.date)}</Text>
                  {item.actor ? <Text style={styles.itemMeta}>By: {item.actor}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  title: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: 16,
  },
  emptyText: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
    fontFamily: FONTS.martelRegular,
    fontSize: 13,
    lineHeight: 20,
  },
  timeline: {
    marginTop: SPACING.md,
    gap: SPACING.md,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: SPACING.md,
  },
  railWrap: {
    width: 18,
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
    marginTop: 4,
  },
  rail: {
    width: 2,
    flex: 1,
    marginTop: SPACING.xs,
    backgroundColor: COLORS.overlayMedium,
  },
  itemContent: {
    flex: 1,
    paddingBottom: 2,
  },
  itemLabel: {
    color: COLORS.text,
    fontFamily: FONTS.interSemiBold,
    fontSize: 14,
  },
  itemMeta: {
    marginTop: 2,
    color: COLORS.textSecondary,
    fontFamily: FONTS.martelRegular,
    fontSize: 12,
  },
});
