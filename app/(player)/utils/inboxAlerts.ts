import { Alert } from "react-native";

type ConfirmClearHistoryParams = {
  count: number;
  onConfirm: () => Promise<void> | void;
};

type ShowCounterOfferAcceptedParams = {
  locked?: boolean;
  matchroomId?: string;
  openMatchroom: (matchroomId?: string) => void;
};

export function confirmClearHistory({
  count,
  onConfirm,
}: ConfirmClearHistoryParams) {
  Alert.alert(
    "Clear All History",
    `Are you sure you want to archive ${count} notification(s)?`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear All",
        style: "default",
        onPress: () => {
          void onConfirm();
        },
      },
    ],
  );
}

export function showCounterOfferAccepted({
  locked,
  matchroomId,
  openMatchroom,
}: ShowCounterOfferAcceptedParams) {
  Alert.alert(
    locked ? "Schedule Locked" : "Time Accepted",
    locked
      ? "All captains accepted the proposed time. The matchroom is now locked."
      : "Your selected time was accepted. The venue can proceed with that schedule.",
    matchroomId
      ? [
          { text: "View Matchroom", onPress: () => openMatchroom(matchroomId) },
          { text: "OK" },
        ]
      : [{ text: "OK" }],
  );
}
