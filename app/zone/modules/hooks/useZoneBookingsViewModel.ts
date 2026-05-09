import { useMemo } from "react";

import {
  type ZoneBookingQueueItem,
  type ZoneMatchroomListItem,
} from "../../../../src/services/convex/zoneAdminBookingService";

type RequestFilter = "all" | "open" | "accepted";
type GameFilter = "all" | string;
type TimeOfDayFilter = "all" | "day" | "night";

type Params = {
  zone: any;
  queue: ZoneBookingQueueItem[];
  matchrooms: ZoneMatchroomListItem[];
  requestFilter: RequestFilter;
  gameFilter: GameFilter;
  timeOfDayFilter: TimeOfDayFilter;
  searchQuery: string;
  selectedRequestId: string | null;
  monthCursor: Date;
};

const toMillis = (value: any) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
};

export const getRequestMatchroomId = (item?: ZoneBookingQueueItem | null) => {
  if (!item) return null;
  if (item.matchroomId) return item.matchroomId;
  const raw = item.raw || {};
  return raw.matchroomId || raw.matchroom?.id || raw.meta?.matchroomId || null;
};

export const formatDate = (value: any) => {
  const millis = toMillis(value);
  if (!millis) return "N/A";
  return new Date(millis).toLocaleString();
};

export const toDateString = (value: any) => {
  if (!value) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length >= 8) return trimmed;
  }
  const millis = toMillis(value);
  if (!millis) return undefined;
  return new Date(millis).toISOString().slice(0, 10);
};

export const isSameDay = (left?: Date | null, right?: Date | null) =>
  !!left &&
  !!right &&
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export function useZoneBookingsViewModel({
  zone,
  queue,
  matchrooms,
  requestFilter,
  gameFilter,
  timeOfDayFilter,
  searchQuery,
  selectedRequestId,
  monthCursor,
}: Params) {
  const branchAreas = useMemo(() => {
    const allAreas = new Set<string>();
    const rawBranches = Array.isArray(zone?.branches) ? zone.branches : [];
    rawBranches.forEach((branch: any) => {
      if (branch?.areaLabel) {
        allAreas.add(String(branch.areaLabel));
      }
    });
    if (zone?.primaryBranch?.areaLabel) {
      allAreas.add(String(zone.primaryBranch.areaLabel));
    }
    return Array.from(allAreas);
  }, [zone?.branches, zone?.primaryBranch?.areaLabel]);

  const primaryBranch = useMemo(() => {
    const branches = Array.isArray(zone?.branches) ? zone.branches : [];
    const primary = branches.find((item: any) => item?.isPrimary);
    return primary || branches[0] || null;
  }, [zone?.branches]);

  const walkInCount = useMemo(
    () => matchrooms.filter((item) => item.bookingSource === "walkin").length,
    [matchrooms],
  );

  const walkInRooms = useMemo(
    () => matchrooms.filter((item) => item.bookingSource === "walkin"),
    [matchrooms],
  );

  const combinedQueue = queue;

  const filteredQueue = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const toClockHour = (value?: string | null) => {
      const raw = String(value || "").trim();
      const twelveHour = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (twelveHour) {
        let hour = Number(twelveHour[1]) || 0;
        const period = twelveHour[3].toUpperCase();
        if (period === "PM" && hour !== 12) hour += 12;
        if (period === "AM" && hour === 12) hour = 0;
        return hour;
      }
      const twentyFourHour = raw.match(/^(\d{1,2}):(\d{2})$/);
      if (twentyFourHour) return Number(twentyFourHour[1]) || 0;
      return null;
    };

    return combinedQueue.filter((item) => {
      const requestOk = requestFilter === "all" ? true : item.status === requestFilter;
      const gameOk = gameFilter === "all" ? true : item.gameKey === gameFilter;
      const hour = toClockHour(item.preferredTime);
      const timeOk =
        timeOfDayFilter === "all" ||
        hour === null ||
        (timeOfDayFilter === "day" ? hour >= 6 && hour < 18 : hour < 6 || hour >= 18);
      const searchOk =
        normalizedSearch.length === 0 ||
        [
          item.title,
          item.userName,
          item.gameKey,
          item.preferredTime,
          ...(item.preferredAreas || []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      return requestOk && gameOk && timeOk && searchOk;
    });
  }, [combinedQueue, gameFilter, requestFilter, searchQuery, timeOfDayFilter]);

  const selectedRequest = useMemo(
    () => combinedQueue.find((item) => item.id === selectedRequestId) || null,
    [combinedQueue, selectedRequestId],
  );

  const selectedMatchroomId = useMemo(
    () => getRequestMatchroomId(selectedRequest),
    [selectedRequest],
  );

  const minDate = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const firstWeekday = useMemo(
    () => new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay(),
    [monthCursor],
  );

  const daysInMonth = useMemo(
    () => new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate(),
    [monthCursor],
  );

  const monthYearLabel = useMemo(
    () => monthCursor.toLocaleDateString([], { month: "long", year: "numeric" }),
    [monthCursor],
  );

  return {
    branchAreas,
    primaryBranch,
    walkInCount,
    walkInRooms,
    combinedQueue,
    filteredQueue,
    selectedRequest,
    selectedMatchroomId,
    minDate,
    firstWeekday,
    daysInMonth,
    monthYearLabel,
  };
}
