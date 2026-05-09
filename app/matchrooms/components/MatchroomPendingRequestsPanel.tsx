import React from "react";
import {
  ActivityIndicator,
  Text,
  View,
} from "react-native";
import { AppButton, AppCard } from "../../../src/components/AppPrimitives";
import { COLORS } from "../../../src/theme";

type PendingRequest = {
  id: string;
  fromUsername?: string;
  meta?: {
    role?: string;
    targetTeam?: string;
    requesterRating?: number;
    requesterSkillTier?: string;
    roomAverageRating?: number;
  };
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
      {requests.map((req) => (
        <AppCard
          key={req.id}
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
              disabled={processingRequestId === req.id}
              onPress={() => onRespond(req, "accept")}
            >
              {processingRequestId === req.id ? (
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
              disabled={processingRequestId === req.id}
              onPress={() => onRespond(req, "reject")}
            >
              {processingRequestId === req.id ? (
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
      ))}
    </View>
  );
}
