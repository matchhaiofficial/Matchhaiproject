import { convex } from "../../lib/convex";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { currentUser } from "./authService";
import Logger from "../../utils/logger";
import { getUserFacingErrorMessage } from "../../utils/userFacingErrors";

export type ReportStatus = "pending" | "reviewed" | "resolved";
export type ReportType =
  | "matchroom_complaint"
  | "user_report"
  | "zone_complaint"
  | "friend_chat_message_report"
  | "matchroom_chat_message_report"
  | "team_challenge_chat_message_report"
  | "team_report";

export interface AppReport {
  id: string;
  _id: string;
  reporterUid?: string;
  type: ReportType;
  status: ReportStatus;
  matchroomId?: string;
  matchroomTitle?: string | null;
  reportedUserId?: string;
  reportedUserName?: string | null;
  zoneId?: string;
  zoneName?: string | null;
  branchId?: string | null;
  branchLabel?: string | null;
  chatroomId?: string | null;
  chatMessageId?: string | null;
  teamChallengeChatId?: string | null;
  teamChallengeChatMessageId?: string | null;
  source?: string | null;
  targetType?: string | null;
  targetReference?: string | null;
  messagePreview?: string | null;
  game?: string;
  reason: string;
  description?: string;
  reviewedByUid?: string;
  reviewedAt?: number;
  reviewerNote?: string;
  resolvedByUid?: string;
  resolvedAt?: number;
  resolutionSummary?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MatchroomComplaintInput {
  matchroomId: string;
  reason: string;
  description?: string;
}

export interface UserReportInput {
  reportedUserId: string;
  reason: string;
  description?: string;
}

export interface ZoneComplaintInput {
  zoneId: string;
  branchId?: string;
  branchLabel?: string;
  reason: string;
  description?: string;
}

export interface FriendChatMessageReportInput {
  chatroomId: string;
  chatMessageId: string;
  reason: string;
  description?: string;
}

export interface MatchroomChatMessageReportInput {
  chatroomId?: string;
  chatMessageId: string;
  reason: string;
  description?: string;
}

export interface TeamChallengeChatMessageReportInput {
  chatId: string;
  messageId: string;
  reason: string;
  description?: string;
}

type Result<T> = { ok: true; data: T; message?: string } | { ok: false; message: string };

const toAppReport = (value: any): AppReport => ({
  id: value._id,
  _id: value._id,
  reporterUid: value.reporterUid,
  type: value.type,
  status: value.status,
  matchroomId: value.matchroomId,
  matchroomTitle: value.matchroomTitle,
  reportedUserId: value.reportedUserId,
  reportedUserName: value.reportedUserName,
  zoneId: value.zoneId,
  zoneName: value.zoneName,
  branchId: value.branchId,
  branchLabel: value.branchLabel,
  chatroomId: value.chatroomId,
  chatMessageId: value.chatMessageId,
  teamChallengeChatId: value.teamChallengeChatId,
  teamChallengeChatMessageId: value.teamChallengeChatMessageId,
  source: value.source,
  targetType: value.targetType,
  targetReference: value.targetReference,
  messagePreview: value.messagePreview,
  game: value.game,
  reason: value.reason,
  description: value.description,
  reviewedByUid: value.reviewedByUid,
  reviewedAt: value.reviewedAt,
  reviewerNote: value.reviewerNote,
  resolvedByUid: value.resolvedByUid,
  resolvedAt: value.resolvedAt,
  resolutionSummary: value.resolutionSummary,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
});

async function getReporterUid() {
  const authUser = await currentUser();
  if (!authUser?.id) {
    return undefined;
  }

  const convexUser = await convex.query(api.users.getByAuthId, { authId: authUser.id });
  return convexUser?._id;
}

async function getMyReportRows() {
  const reporterUid = await getReporterUid();
  if (!reporterUid) {
    return [];
  }

  const rows = await convex.query(api.reports.listByReporter, { reporterUid });
  return rows || [];
}

export async function submitMatchroomComplaint(
  input: MatchroomComplaintInput,
): Promise<Result<{ reportId: string; created: boolean }>> {
  try {
    const reporterUid = await getReporterUid();
    const result: any = await convex.mutation(api.reports.createMatchroomComplaint, {
      matchroomId: input.matchroomId as Id<"matchrooms">,
      reason: input.reason,
      description: input.description,
      reporterUid,
    });

    return {
      ok: true,
      data: {
        reportId: result.reportId,
        created: Boolean(result.created),
      },
      message: result.message,
    };
  } catch (error: any) {
    Logger.error("reportService", "submitMatchroomComplaint failed", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to submit report.") };
  }
}

export async function submitUserReport(
  input: UserReportInput,
): Promise<Result<{ reportId: string; created: boolean }>> {
  try {
    const reporterUid = await getReporterUid();
    const result: any = await convex.mutation(api.reports.createUserReport, {
      reportedUserId: input.reportedUserId as Id<"users">,
      reason: input.reason,
      description: input.description,
      reporterUid,
    });

    return {
      ok: true,
      data: {
        reportId: result.reportId,
        created: Boolean(result.created),
      },
      message: result.message,
    };
  } catch (error: any) {
    Logger.error("reportService", "submitUserReport failed", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to submit report.") };
  }
}

export async function submitZoneComplaint(
  input: ZoneComplaintInput,
): Promise<Result<{ reportId: string; created: boolean }>> {
  try {
    const reporterUid = await getReporterUid();
    const result: any = await convex.mutation(api.reports.createZoneComplaint, {
      zoneId: input.zoneId as Id<"zones">,
      branchId: input.branchId,
      branchLabel: input.branchLabel,
      reason: input.reason,
      description: input.description,
      reporterUid,
    });

    return {
      ok: true,
      data: {
        reportId: result.reportId,
        created: Boolean(result.created),
      },
      message: result.message,
    };
  } catch (error: any) {
    Logger.error("reportService", "submitZoneComplaint failed", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to submit report.") };
  }
}

export async function submitFriendChatMessageReport(
  input: FriendChatMessageReportInput,
): Promise<Result<{ reportId: string; created: boolean }>> {
  try {
    const reporterUid = await getReporterUid();
    const result: any = await convex.mutation((api as any).reports.createFriendChatMessageReport, {
      chatroomId: input.chatroomId as Id<"chatrooms">,
      chatMessageId: input.chatMessageId as Id<"chatMessages">,
      reason: input.reason,
      description: input.description,
      reporterUid,
    });

    return { ok: true, data: { reportId: result.reportId, created: Boolean(result.created) }, message: result.message };
  } catch (error: any) {
    Logger.error("reportService", "submitFriendChatMessageReport failed", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to submit report.") };
  }
}

export async function submitMatchroomChatMessageReport(
  input: MatchroomChatMessageReportInput,
): Promise<Result<{ reportId: string; created: boolean }>> {
  try {
    const reporterUid = await getReporterUid();
    const result: any = await convex.mutation((api as any).reports.createMatchroomChatMessageReport, {
      chatroomId: input.chatroomId as Id<"chatrooms"> | undefined,
      chatMessageId: input.chatMessageId as Id<"chatMessages">,
      reason: input.reason,
      description: input.description,
      reporterUid,
    });

    return { ok: true, data: { reportId: result.reportId, created: Boolean(result.created) }, message: result.message };
  } catch (error: any) {
    Logger.error("reportService", "submitMatchroomChatMessageReport failed", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to submit report.") };
  }
}

export async function submitTeamChallengeChatMessageReport(
  input: TeamChallengeChatMessageReportInput,
): Promise<Result<{ reportId: string; created: boolean }>> {
  try {
    const reporterUid = await getReporterUid();
    const result: any = await convex.mutation((api as any).reports.createTeamChallengeChatMessageReport, {
      chatId: input.chatId,
      messageId: input.messageId as Id<"teamChallengeChatMessages">,
      reason: input.reason,
      description: input.description,
      reporterUid,
    });

    return { ok: true, data: { reportId: result.reportId, created: Boolean(result.created) }, message: result.message };
  } catch (error: any) {
    Logger.error("reportService", "submitTeamChallengeChatMessageReport failed", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to submit report.") };
  }
}

export async function getMyReports(status?: ReportStatus): Promise<Result<AppReport[]>> {
  try {
    const rows = await getMyReportRows();
    const filtered = status
      ? rows.filter((row: any) => row?.status === status)
      : rows;

    return { ok: true, data: filtered.map(toAppReport) };
  } catch (error: any) {
    Logger.error("reportService", "getMyReports failed", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to load reports.") };
  }
}

export async function getMyReportById(reportId: string): Promise<Result<AppReport>> {
  try {
    const rows = await getMyReportRows();
    const row = rows.find((item: any) => String(item?._id) === String(reportId));
    if (!row) {
      return { ok: false, message: "Report not found." };
    }

    return { ok: true, data: toAppReport(row) };
  } catch (error: any) {
    Logger.error("reportService", "getMyReportById failed", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to load report.") };
  }
}

export async function getZoneReports(status?: ReportStatus): Promise<Result<AppReport[]>> {
  try {
    const rows = await convex.query(api.reports.listForMyZone, { status });
    return { ok: true, data: (rows || []).map(toAppReport) };
  } catch (error: any) {
    Logger.error("reportService", "getZoneReports failed", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to load zone reports.") };
  }
}

export async function getZoneReportById(reportId: string): Promise<Result<AppReport>> {
  try {
    const row = await convex.query(api.reports.getForMyZoneById, {
      reportId: reportId as Id<"reports">,
    });
    return { ok: true, data: toAppReport(row) };
  } catch (error: any) {
    Logger.error("reportService", "getZoneReportById failed", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to load zone report.") };
  }
}

export async function markZoneReportReviewed(
  reportId: string,
  reviewerNote: string
): Promise<Result<void>> {
  try {
    const result: any = await convex.mutation(api.reports.markZoneReportReviewed, {
      reportId: reportId as Id<"reports">,
      reviewerNote,
    });
    return { ok: true, data: undefined, message: result?.message };
  } catch (error: any) {
    Logger.error("reportService", "markZoneReportReviewed failed", error);
    return { ok: false, message: getUserFacingErrorMessage(error, "Failed to update report.") };
  }
}

export type ComplainData = MatchroomComplaintInput;

export const submitMatchroomComplain = submitMatchroomComplaint;
