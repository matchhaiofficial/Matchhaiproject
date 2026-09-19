import React from "react";
import {
  ActivityIndicator,
  Text,
  View,
} from "react-native";
import { AppButton, AppCard } from "../../../src/components/AppPrimitives";
import { COLORS } from "../../../src/theme";

type PendingRequest = {
  id?: string;
  _id?: string;
  fromUid?: string;
  matchroomId?: string;
  notificationId?: string;
  fromUsername?: string;
  meta?: {
    role?: string;
    targetTeam?: string;
    requesterRating?: number;
    requesterSkillTier?: string;
    roomAverageRating?: number;
  };
};

const getNotificationId = (req: PendingRequest): string | null => {
  const direct = req._id || req.notificationId || req.id;
  return direct ? String(direct) : null;
};

const getRequestKey = (req: PendingRequest, index: number): string => {
  const direct = getNotificationId(req);
  if (direct) return direct;
  if (req.matchroomId && req.fromUid) return `${req.matchroomId}:${req.fromUid}`;
  if (req.fromUid) return `uid:${req.fromUid}`;
  return `pending-request-${index}`;
};

type Props = {
  requests: PendingRequest[];
  processingRequestId: string | null;
  onRespond: (request: PendingRequest, decision: "accept" | "reject") => void;
};

export function MatchroomPendingRequestsPanel({
  requests,
  processingRequestId,
  onRespond,
}: Props) {
  if (!requests.length) return null;

  return (
    <View>
      {requests.map((req, index) => {
        const notifId = getNotificationId(req);
        const acceptKey = notifId ? `${notifId}:accept` : null;
        const rejectKey = notifId ? `${notifId}:reject` : null;
        const isAccepting = !!acceptKey && processingRequestId === acceptKey;
        const isRejecting = !!rejectKey && processingRequestId === rejectKey;
        const rowBusy = isAccepting || isRejecting;
        return (
        <AppCard
          key={getRequestKey(req, index)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            marginBottom: 8,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: COLORS.accent,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
            }}
          >
            <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 14 }}>
              {(req.fromUsername || "P").charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: COLORS.text,
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              {req.fromUsername || "Player"}
            </Text>
            <Text
              style={{
                color: COLORS.textSecondary,
                fontSize: 12,
                marginTop: 2,
              }}
            >
              Role: {req.meta?.role || "Player"} • Team:{" "}
              {req.meta?.targetTeam || "Any"}
            </Text>
            <Text
              style={{
                color: COLORS.accent,
                fontSize: 12,
                marginTop: 2,
                fontWeight: "600",
              }}
            >
              Level: {req.meta?.requesterSkillTier || "Unranked"}
              {typeof req.meta?.requesterRating === "number"
                ? ` (${Math.round(req.meta.requesterRating)})`
                : ""}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <AppButton
              variant="success"
              size="sm"
              disabled={rowBusy}
              onPress={() => onRespond(req, "accept")}
            >
              {isAccepting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text
                  style={{
                    color: "#FFF",
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  Accept
                </Text>
              )}
            </AppButton>
            <AppButton
              variant="danger"
              size="sm"
              disabled={rowBusy}
              onPress={() => onRespond(req, "reject")}
            >
              {isRejecting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text
                  style={{
                    color: "#FFF",
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  Reject
                </Text>
              )}
            </AppButton>
          </View>
        </AppCard>
        );
      })}
    </View>
  );
}
