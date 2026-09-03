import { getTeamMainRosterSize } from "../constants/teamRosterRules";

type TeamLike = {
  game?: string | null;
  mainRosterSize?: number | null;
  maxMembers?: number | null;
  memberCount?: number | null;
  memberUids?: unknown[] | null;
  members?: any[] | null;
};

export function getTeamMainDisplayCapacity(team?: TeamLike | null) {
  if (!team) return 0;
  const configuredMainSize = Number(team.mainRosterSize || 0);
  if (Number.isFinite(configuredMainSize) && configuredMainSize > 0) {
    return configuredMainSize;
  }
  return getTeamMainRosterSize(team.game);
}

export function getTeamMainDisplayCount(team?: TeamLike | null) {
  if (!team) return 0;
  const mainCapacity = getTeamMainDisplayCapacity(team);
  const members = Array.isArray(team.members) ? team.members : null;

  if (members?.length) {
    const mainCount = members.filter((member, index) => {
      const fallbackRole = index < mainCapacity ? "main" : "substitute";
      return (member?.rosterRole || fallbackRole) === "main";
    }).length;
    return Math.min(mainCount, mainCapacity);
  }

  const rawCount = Array.isArray(team.memberUids)
    ? team.memberUids.length
    : Number(team.memberCount || 0);
  return Math.min(Math.max(0, rawCount), mainCapacity);
}

export function getTeamMainDisplayRoster(team?: TeamLike | null) {
  const maxMembers = getTeamMainDisplayCapacity(team);
  const currentMembers = getTeamMainDisplayCount(team);
  return {
    currentMembers,
    maxMembers,
    fillPercent:
      maxMembers > 0
        ? Math.min(100, Math.round((currentMembers / maxMembers) * 100))
        : 0,
  };
}
