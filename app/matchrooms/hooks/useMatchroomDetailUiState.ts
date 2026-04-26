import { useEffect, useState } from "react";

const shallowArrayEqual = (a: any[], b: any[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((item, index) => item === b[index]);
};

type InvitingSlot = {
  team: "A" | "B";
  slotId: string;
} | null;

type Params = {
  convexFriends: any[];
  loadingConvexFriends: boolean;
};

export function useMatchroomDetailUiState({
  convexFriends,
  loadingConvexFriends,
}: Params) {
  const [showComplainModal, setShowComplainModal] = useState(false);
  const [complainReason, setComplainReason] = useState("");
  const [complainDescription, setComplainDescription] = useState("");
  const [submittingComplain, setSubmittingComplain] = useState(false);

  const COMPLAIN_REASONS = [
    "Toxic Behavior",
    "Cheating/Hacking",
    "AFK/Griefing",
    "Impersonation",
    "Inappropriate Name",
    "Other",
  ];

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [invitingSlot, setInvitingSlot] = useState<InvitingSlot>(null);

  useEffect(() => {
    setFriends((prev) =>
      shallowArrayEqual(prev, convexFriends) ? prev : convexFriends,
    );
    setLoadingFriends((prev) =>
      prev === loadingConvexFriends ? prev : loadingConvexFriends,
    );
  }, [convexFriends, loadingConvexFriends]);

  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [counterExpiryMinutes, setCounterExpiryMinutes] = useState("10");
  const [counterDateValue, setCounterDateValue] = useState<Date>(
    new Date(Date.now() + 2 * 60 * 60 * 1000),
  );
  const [adminProcessing, setAdminProcessing] = useState<
    "accept" | "reject" | "counter" | "cancel" | null
  >(null);

  const [showAdminCancelModal, setShowAdminCancelModal] = useState(false);
  const [adminCancelReason, setAdminCancelReason] = useState("");
  const [adminCancelNote, setAdminCancelNote] = useState("");
  const ADMIN_CANCEL_REASONS = [
    "PC Issue",
    "Electricity Issue",
    "Internet/Network Issue",
    "Venue Overbooked",
    "Maintenance",
    "Other",
  ];

  return {
    showComplainModal,
    setShowComplainModal,
    complainReason,
    setComplainReason,
    complainDescription,
    setComplainDescription,
    submittingComplain,
    setSubmittingComplain,
    COMPLAIN_REASONS,
    showInviteModal,
    setShowInviteModal,
    friends,
    loadingFriends,
    invitingSlot,
    setInvitingSlot,
    showSuggestModal,
    setShowSuggestModal,
    counterPrice,
    setCounterPrice,
    counterMessage,
    setCounterMessage,
    counterExpiryMinutes,
    setCounterExpiryMinutes,
    counterDateValue,
    setCounterDateValue,
    adminProcessing,
    setAdminProcessing,
    showAdminCancelModal,
    setShowAdminCancelModal,
    adminCancelReason,
    setAdminCancelReason,
    adminCancelNote,
    setAdminCancelNote,
    ADMIN_CANCEL_REASONS,
  };
}
