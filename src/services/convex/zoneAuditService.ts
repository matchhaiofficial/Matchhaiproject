import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";

export type ZoneAuditModule = "bookings" | "resources" | "pricing" | "migration";

export interface ZoneAuditEvent {
  id: string;
  zoneId: string;
  module: ZoneAuditModule | string;
  action: string;
  actorUid?: string;
  actorLabel?: string;
  targetType: string;
  targetId?: string;
  summary: string;
  details?: Record<string, any>;
  createdAt: number;
}

export async function listZoneAuditEvents(input: {
  zoneId: string;
  module?: ZoneAuditModule | "all";
  action?: string | "all";
  limit?: number;
}): Promise<ZoneAuditEvent[]> {
  const rows = await convex.query(api.zoneAudit.listZoneAuditEvents, {
    zoneId: input.zoneId,
    module: input.module && input.module !== "all" ? input.module : undefined,
    action: input.action && input.action !== "all" ? input.action : undefined,
    limit: input.limit,
  });

  return (rows as any[]).map((row) => ({
    id: String(row.id || row._id || ""),
    zoneId: String(row.zoneId || ""),
    module: row.module,
    action: row.action,
    actorUid: row.actorUid || undefined,
    actorLabel: row.actorLabel || undefined,
    targetType: row.targetType,
    targetId: row.targetId || undefined,
    summary: row.summary,
    details: row.details || undefined,
    createdAt: Number(row.createdAt || 0),
  }));
}
