// src/services/reportService.ts
// Re-exports from Convex report service for backwards compatibility
// Original Firebase implementation replaced with Convex backend

export {
    type ComplainData,
    submitMatchroomComplain,
} from "./convex/reportService";
