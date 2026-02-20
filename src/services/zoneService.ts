import { getApiClient } from "../api/client";
export type { EffectiveRateResult, Zone, ZoneRegistrationSteps } from "../repositories/firebase/zoneService";
export const addBranch: typeof import("../repositories/firebase/zoneService").addBranch = (...args) => getApiClient().zones.addBranch(...args);
export const deriveZoneRate: typeof import("../repositories/firebase/zoneService").deriveZoneRate = (...args) => getApiClient().zones.deriveZoneRate(...args);
export const getActiveZones: typeof import("../repositories/firebase/zoneService").getActiveZones = (...args) => getApiClient().zones.getActiveZones(...args);
export const saveZoneRegistration: typeof import("../repositories/firebase/zoneService").saveZoneRegistration = (...args) => getApiClient().zones.saveZoneRegistration(...args);
export const updateZone: typeof import("../repositories/firebase/zoneService").updateZone = (...args) => getApiClient().zones.updateZone(...args);
