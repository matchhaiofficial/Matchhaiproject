import { Alert } from "react-native";

import { choose, confirm } from "../../../src/ui/confirm";

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
  void confirm({
    title: "Clear All History",
    message: `Are you sure you want to archive ${count} notification(s)?`,
    cancelText: "Cancel",
    confirmText: "Clear All",
  }).then((confirmed) => {
    if (confirmed) {
      void onConfirm();
    }
  });
}

export function showCounterOfferAccepted({
  locked,
  matchroomId,
  openMatchroom,
}: ShowCounterOfferAcceptedParams) {
  if (matchroomId) {
    void choose({
      title: locked ? "Schedule Locked" : "Time Accepted",
      message: locked
        ? "All captains accepted the proposed time. The matchroom is now locked."
        : "Your selected time was accepted. The venue can proceed with that schedule.",
      cancelText: "OK",
      choices: [{ key: "view_matchroom", text: "View Matchroom" }],
    }).then((action) => {
      if (action === "view_matchroom") {
        openMatchroom(matchroomId);
      }
    });
    return;
  }

  Alert.alert(
    locked ? "Schedule Locked" : "Time Accepted",
    locked
      ? "All captains accepted the proposed time. The matchroom is now locked."
      : "Your selected time was accepted. The venue can proceed with that schedule.",
    [{ text: "OK" }],
  );
}
