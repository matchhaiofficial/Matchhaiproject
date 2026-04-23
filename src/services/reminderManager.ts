import { reconcileMatchroomReminders, buildMatchroomReminderKey, type ReminderPlan } from "./localNotifications";
import { getRoomStartDate } from "../utils/timeFilters";

export function buildUpcomingMatchReminderPlans(input: {
  userId?: string | null;
  upcomingRooms?: any[];
  minutesBefore?: number;
}): ReminderPlan[] {
  const userId = String(input.userId || "").trim();
  if (!userId) return [];

  const minutesBefore = Math.max(0, Math.min(120, input.minutesBefore ?? 15));
  const plans = (input.upcomingRooms || [])
    .map((room): ReminderPlan | null => {
      const roomId = String(room?.id || room?._id || "").trim();
      if (!roomId) return null;
      const startAt = getRoomStartDate(room);
      if (!startAt) return null;
      const startAtMs = startAt.getTime();
      const triggerAtMs = startAtMs - minutesBefore * 60 * 1000;
      const reminderKey = buildMatchroomReminderKey({
        userId,
        roomId,
        startAtMs,
        minutesBefore,
      });

      return {
        reminderKey,
        roomId,
        title: String(room?.title || "Matchroom reminder"),
        triggerAtMs,
        minutesBefore,
        href: `/matchrooms/${roomId}`,
      };
    })
    .filter((plan): plan is ReminderPlan => plan !== null);

  return plans;
}

export async function reconcileUpcomingMatchReminders(input: {
  userId?: string | null;
  upcomingRooms?: any[];
  minutesBefore?: number;
}) {
  const plans = buildUpcomingMatchReminderPlans(input);
  return reconcileMatchroomReminders(plans);
}
