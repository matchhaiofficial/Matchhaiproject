import React from "react";
import { Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { AppIcon } from "../../../src/components/AppIcon";
import { COLORS } from "../../../src/theme";
import {
  getBroadcastAreas,
  getPrimaryLocationLabel,
  isBroadcastVenuePending,
} from "../utils/matchroomLocationDisplay";

const toValidDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.seconds === "number") {
    const parsed = new Date(value.seconds * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const parseScheduledDate = (dateStr?: string | null): Date | null => {
  const value = String(dateStr || "").trim();
  if (!value) return null;
  if (value.includes("/")) {
    const [day, month, year] = value.split("/").map(Number);
    const parsed = new Date(year, month - 1, day);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return toValidDate(value);
};

const formatScheduledWindow = (room: any) => {
  const dateStr = room.scheduledDate || "";
  const timeStr = room.scheduledTime || "";

  const explicitStart = toValidDate(room.startTime) || toValidDate(room.scheduledStartAt);
  const start = explicitStart || parseScheduledDate(dateStr);
  if (!start) return timeStr ? timeStr : "Time not set";

  const [hours, mins] = timeStr.split(":").map(Number);
  if (!explicitStart && !Number.isNaN(hours)) {
    start.setHours(hours, mins || 0);
  }

  const format12h = (value: Date) =>
    value.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const startDisplay = explicitStart
    ? format12h(explicitStart)
    : room.scheduledTime
      ? format12h(start)
      : "Time not set";

  let duration = room.durationMinutes;
  if (!duration) {
    const series = room.seriesType;
    if (series === "BO1") duration = 60;
    else if (series === "BO3") duration = room.game === "fc26" ? 60 : 180;
    else if (series === "BO5") duration = room.game === "fc26" ? 120 : 300;
    else if (series === "BO7") duration = 60;
    else if (series === "BO20") duration = 120;
    else if (series === "BO40") duration = 180;
    else if (room.durationHours) duration = room.durationHours * 60;
    else if (room.format?.includes("BO1")) duration = 60;
    else if (room.format?.includes("BO3"))
      duration = room.game === "fc26" ? 60 : 180;
    else if (room.format?.includes("BO5"))
      duration = room.game === "fc26" ? 120 : 300;
    else if (room.format?.includes("BO7")) duration = 60;
    else duration = 60;
  }

  if (room.scheduledTime && duration) {
    const end = new Date(start.getTime() + duration * 60000);
    const endDisplay = format12h(end);
    return `${startDisplay} - ${endDisplay}`;
  }

  return startDisplay;
};

type Props = {
  room: any;
  isLocked: boolean;
  qrValue: string | null;
  matchCode: string | null;
  styles: any;
};

export function MatchroomSummarySection({
  room,
  isLocked,
  qrValue,
  matchCode,
  styles,
}: Props) {
  const isBroadcastPending = isBroadcastVenuePending(room);
  const broadcastAreas = getBroadcastAreas(room);
  const primaryLocation = getPrimaryLocationLabel(room);

  return (
    <>
      {isLocked && qrValue ? (
        <View style={styles.qrCard}>
          <View style={styles.qrHeader}>
            <Text style={styles.qrTitle}>Matchroom QR</Text>
            <Text style={styles.qrSubtitle}>Scan to open this lobby</Text>
          </View>
          <View style={styles.qrBody}>
            <QRCode
              value={qrValue}
              size={140}
              backgroundColor="transparent"
              color={COLORS.text}
            />
            <View style={styles.qrInfo}>
              <Text style={styles.qrCodeLabel}>Match Code</Text>
              <Text style={styles.qrCodeValue}>{matchCode || "—"}</Text>
              <Text style={styles.qrHint}>
                Admin can use this code if QR fails.
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.mainCard}>
        <View style={styles.gameDateRow}>
          <View style={styles.gameBadge}>
            <Text style={styles.gameText}>{room.game}</Text>
          </View>
          <Text style={styles.dateText}>
            {(toValidDate(room.startTime) || toValidDate(room.scheduledStartAt) || parseScheduledDate(room.scheduledDate))
              ?.toLocaleDateString() || "Date not set"}
          </Text>
        </View>
        <Text style={styles.title}>{room.title}</Text>
        <Text style={styles.description}>
          {room.description || "No description provided."}
        </Text>
      </View>

      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <AppIcon
            name="schedule"
            size={20}
            color={COLORS.accent}
            style={styles.infoIcon}
          />
          <View>
            <Text style={styles.infoLabel}>TIME</Text>
            <Text style={styles.infoValue}>{formatScheduledWindow(room)}</Text>
          </View>
        </View>
        <View style={styles.infoItem}>
          <AppIcon
            name="location-on"
            size={20}
            color={COLORS.accent}
            style={styles.infoIcon}
          />
          <View>
            <Text style={styles.infoLabel}>LOCATION</Text>
            <Text style={styles.infoValue}>
              {isBroadcastPending ? "Venue not confirmed yet" : primaryLocation || "Online"}
            </Text>
            {isBroadcastPending ? (
              <>
                <Text style={[styles.infoValue, { color: COLORS.textSecondary, marginTop: 4 }]}>
                  Broadcasting to selected areas
                </Text>
                <Text style={[styles.infoValue, { marginTop: 4 }]}>
                  {broadcastAreas.length > 0 ? broadcastAreas.join(", ") : "No areas selected"}
                </Text>
              </>
            ) : null}
          </View>
        </View>
        <View style={styles.infoItem}>
          <AppIcon
            name="attach-money"
            size={20}
            color={COLORS.successBright}
            style={styles.infoIcon}
          />
          <View>
            <Text style={styles.infoLabel}>PRICE</Text>
            <Text style={[styles.infoValue, { color: COLORS.successBright }]}>
              {room.pricing?.perPlayer || room.pricePerPlayer
                ? `Rs.${room.pricing?.perPlayer || room.pricePerPlayer}`
                : "Free"}
            </Text>
          </View>
        </View>
        <View style={styles.infoItem}>
          <AppIcon
            name="bar-chart"
            size={20}
            color={COLORS.accent}
            style={styles.infoIcon}
          />
          <View>
            <Text style={styles.infoLabel}>SKILL LEVEL</Text>
            <Text style={styles.infoValue}>
              {room.skillLevel || "All Levels"}
            </Text>
          </View>
        </View>
      </View>
    </>
  );
}
