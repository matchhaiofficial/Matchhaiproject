export type TeamRosterRule = {
  mainSize: number;
  maxSubstitutes: number;
};

const FIVE_V_FIVE_RULE: TeamRosterRule = {
  mainSize: 5,
  maxSubstitutes: 2,
};

const DUEL_TEAM_RULE: TeamRosterRule = {
  mainSize: 2,
  maxSubstitutes: 1,
};

export const TEAM_ROSTER_RULES: Record<string, TeamRosterRule> = {
  cs2: FIVE_V_FIVE_RULE,
  cs16: FIVE_V_FIVE_RULE,
  valorant: FIVE_V_FIVE_RULE,
  fc25: DUEL_TEAM_RULE,
  fc26: DUEL_TEAM_RULE,
  tekken8: DUEL_TEAM_RULE,
};

export function getTeamRosterRule(gameKey?: string | null): TeamRosterRule {
  const key = String(gameKey || "").toLowerCase();
  return TEAM_ROSTER_RULES[key] || FIVE_V_FIVE_RULE;
}

export function getTeamMainRosterSize(gameKey?: string | null) {
  return getTeamRosterRule(gameKey).mainSize;
}

export function getTeamMaxSubstitutes(gameKey?: string | null) {
  return getTeamRosterRule(gameKey).maxSubstitutes;
}

export function getTeamTotalRosterCapacity(gameKey?: string | null, substituteSlots = 0) {
  const rule = getTeamRosterRule(gameKey);
  const safeSubstitutes = Math.max(0, Math.min(rule.maxSubstitutes, Math.floor(substituteSlots)));
  return rule.mainSize + safeSubstitutes;
}
