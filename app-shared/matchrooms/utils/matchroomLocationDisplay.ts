const normalizeAreaList = (values: unknown[]) =>
  Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );

export function getBroadcastAreas(room: any): string[] {
  return normalizeAreaList(room?.broadcastAreas || []);
}

export function isBroadcastVenuePending(room: any): boolean {
  return (
    room?.locationMode === "broadcast" &&
    room?.broadcastRequestStatus !== "zone_confirmed" &&
    !room?.confirmedZoneId &&
    !room?.confirmedBranchId &&
    !room?.zoneId
  ) || (
    room?.locationMode === "broadcast" &&
    room?.broadcastRequestStatus !== "zone_confirmed" &&
    !room?.venueConfirmedAt &&
    !room?.zoneAdminApproved
  );
}

export function getBroadcastAreaSummary(room: any, maxVisible = 2): string | null {
  const areas = getBroadcastAreas(room);
  if (!areas.length) return null;
  const visible = areas.slice(0, maxVisible);
  const remaining = Math.max(0, areas.length - visible.length);
  return remaining > 0 ? `${visible.join(", ")} +${remaining}` : visible.join(", ");
}

export function getPrimaryLocationLabel(room: any): string {
  if (room?.location && !isBroadcastVenuePending(room)) {
    return String(room.location);
  }
  if (!isBroadcastVenuePending(room) && room?.branchName) {
    return String(room.branchName);
  }
  if (!isBroadcastVenuePending(room) && room?.zoneName) {
    return String(room.zoneName);
  }
  return getBroadcastAreaSummary(room) || room?.location || "Venue pending";
}
