import { useMemo } from "react";

import {
  type ZoneBookingQueueItem,
  type ZoneMatchroomListItem,
} from "../../../../src/services/convex/zoneAdminBookingService";
import { toLocalDateString } from "../../../../src/utils/scheduleTime";

type GameFilter = "all" | string;
type TimeOfDayFilter = "all" | "day" | "night";
type DateRangeFilter = "all" | "today" | "next7";
type RequestTypeFilter = "all" | "direct" | "broadcast";
type RequestStatusFilter = "all" | "open" | "pending_payment";

type Params = {
  zone: any;
  queue: ZoneBookingQueueItem[];
  matchrooms: ZoneMatchroomListItem[];
  gameFilter: GameFilter;
  timeOfDayFilter: TimeOfDayFilter;
  dateRangeFilter: DateRangeFilter;
  branchFilter: string;
  requestTypeFilter: RequestTypeFilter;
  requestStatusFilter: RequestStatusFilter;
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

export const toScheduleMillis = (value: any) => {
  if (!value) return 0;
  const direct = toMillis(value);
  if (direct) return direct;
  if (typeof value === "string") {
    const trimmed = value.trim();
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnly) {
      return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])).getTime();
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const matchesScheduleRange = (millis: number, range: DateRangeFilter) => {
  if (range === "all") return true;
  if (!millis) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  if (range === "today") return millis >= startMs && millis < startMs + 24 * 60 * 60 * 1000;
  return millis >= startMs && millis < startMs + 7 * 24 * 60 * 60 * 1000;
};

const normalizeBranchToken = (value?: string | null) =>
  String(value || "").trim().toLowerCase();

const getRequestBranchId = (item: ZoneBookingQueueItem) => {
  const raw = item.raw || {};
  return String(
    item.allocatedBranchId ||
      raw.branchId ||
      raw.selectedBranchId ||
      raw.targetBranchId ||
      raw.confirmedBranchId ||
      "",
  ).trim();
};

// Branch matching for requests is heuristic: open/broadcast requests usually have no confirmed
// branch, only an area. We match by allocatedBranchId first, then fall back to area; unknown or
// unmatchable requests are NOT hidden (they pass) so admins never lose sight of them.
const matchesRequestBranch = (
  item: ZoneBookingQueueItem,
  branchFilter: string,
  branches: any[],
) => {
  if (branchFilter === "all") return true;
  const allocated = getRequestBranchId(item);
  if (allocated) return allocated === branchFilter;
  const targetBranch = branches.find((branch) => String(branch?.id) === branchFilter);
  const branchArea = normalizeBranchToken(targetBranch?.areaLabel);
  if (!branchArea) return true;
  const raw = item.raw || {};
  const requestAreas = [
    item.targetAreaLabel,
    raw.targetAreaLabel,
    raw.branchAreaLabel,
    raw.areaLabel,
    ...(item.preferredAreas || []),
  ]
    .filter(Boolean)
    .map(normalizeBranchToken);
  if (requestAreas.length === 0) return true;
  return requestAreas.includes(branchArea);
};

const matchesRequestType = (item: ZoneBookingQueueItem, typeFilter: RequestTypeFilter) => {
  if (typeFilter === "all") return true;
  const kind = normalizeBranchToken(item.requestKind);
  const mode = normalizeBranchToken(item.locationMode);
  const isBroadcast = kind.includes("broadcast") || mode === "broadcast";
  return typeFilter === "broadcast" ? isBroadcast : !isBroadcast;
};

const matchesRequestStatus = (item: ZoneBookingQueueItem, statusFilter: RequestStatusFilter) => {
  if (statusFilter === "all") return true;
  return normalizeBranchToken(item.status) === statusFilter;
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
  // Use the local calendar day, not the UTC day, so a stored midnight instant
  // doesn't roll back a day in positive-offset timezones (e.g. PKT, UTC+5).
  return toLocalDateString(new Date(millis));
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
  gameFilter,
  timeOfDayFilter,
  dateRangeFilter,
  branchFilter,
  requestTypeFilter,
  requestStatusFilter,
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
    const branches = Array.isArray(zone?.branches) ? zone.branches : [];
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
      const gameOk = gameFilter === "all" ? true : item.gameKey === gameFilter;
      const hour = toClockHour(item.preferredTime);
      const timeOk =
        timeOfDayFilter === "all" ||
        hour === null ||
        (timeOfDayFilter === "day" ? hour >= 6 && hour < 18 : hour < 6 || hour >= 18);
      const dateOk = matchesScheduleRange(toScheduleMillis(item.preferredDate), dateRangeFilter);
      const branchOk = matchesRequestBranch(item, branchFilter, branches);
      const typeOk = matchesRequestType(item, requestTypeFilter);
      const statusOk = matchesRequestStatus(item, requestStatusFilter);
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
      return gameOk && timeOk && dateOk && branchOk && typeOk && statusOk && searchOk;
    });
  }, [
    combinedQueue,
    gameFilter,
    timeOfDayFilter,
    dateRangeFilter,
    branchFilter,
    requestTypeFilter,
    requestStatusFilter,
    searchQuery,
    zone?.branches,
  ]);

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
