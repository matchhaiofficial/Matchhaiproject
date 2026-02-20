import { getApiClient } from "../api/client";
export type { ComplainData } from "../repositories/firebase/reportService";
export const submitMatchroomComplain: typeof import("../repositories/firebase/reportService").submitMatchroomComplain = (...args) => getApiClient().reports.submitMatchroomComplain(...args);
