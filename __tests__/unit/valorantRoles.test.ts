// Phase 1A — Valorant role/agent mapping.
import {
  normalizeValorantRole,
  getValorantAgentsForRole,
  formatValorantRoleAgent,
  VALORANT_ROLES,
} from "../../constants/profileOptions";

describe("normalizeValorantRole", () => {
  it("accepts canonical tactical role labels", () => {
    expect(normalizeValorantRole("Controller")).toBe("Controller");
    expect(normalizeValorantRole("Initiator")).toBe("Initiator");
    expect(normalizeValorantRole("Sentinel")).toBe("Sentinel");
  });

  it("accepts role keys (lowercase) and returns the label", () => {
    expect(normalizeValorantRole("controller")).toBe("Controller");
    expect(normalizeValorantRole("sentinel")).toBe("Sentinel");
  });

  it("maps legacy roles to new tactical roles", () => {
    expect(normalizeValorantRole("Entry Fragger")).toBe("Duelist");
    expect(normalizeValorantRole("Controller / Smoker")).toBe("Controller");
    expect(normalizeValorantRole("Sentinel / Anchor")).toBe("Sentinel");
  });

  it("returns null for empty/unknown values", () => {
    expect(normalizeValorantRole("")).toBeNull();
    expect(normalizeValorantRole(null)).toBeNull();
    expect(normalizeValorantRole("Wizard")).toBeNull();
  });
});

describe("getValorantAgentsForRole", () => {
  it("returns the agents for a known role", () => {
    const agents = getValorantAgentsForRole("Controller");
    expect(agents.length).toBeGreaterThan(0);
    expect(agents.map((a) => a.label)).toContain("Omen");
  });

  it("returns an empty list for unknown/empty role", () => {
    expect(getValorantAgentsForRole("Wizard")).toEqual([]);
    expect(getValorantAgentsForRole(null)).toEqual([]);
  });
});

describe("formatValorantRoleAgent", () => {
  it("formats 'Role · Agent' when both present", () => {
    expect(formatValorantRoleAgent("Controller", "Omen")).toBe("Controller · Omen");
  });

  it("returns just the role when no agent", () => {
    expect(formatValorantRoleAgent("Controller", "")).toBe("Controller");
  });

  it("returns just the agent when role is unknown", () => {
    expect(formatValorantRoleAgent("Wizard", "Omen")).toBe("Omen");
  });

  it("returns null when nothing meaningful", () => {
    expect(formatValorantRoleAgent(null, null)).toBeNull();
  });
});

describe("VALORANT_ROLES", () => {
  it("exposes the tactical role labels", () => {
    expect(VALORANT_ROLES).toContain("Controller");
    expect(VALORANT_ROLES).toContain("Initiator");
    expect(VALORANT_ROLES).toContain("Sentinel");
  });
});
