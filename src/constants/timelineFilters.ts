// src/constants/timelineFilters.ts
// Single source of truth for timeline filter options

export type TimelineFilterKey = 'any' | 'today' | 'next_3_days' | 'next_1_week';

export const TIMELINE_FILTERS: { key: TimelineFilterKey; label: string }[] = [
    { key: 'any', label: 'Any' },
    { key: 'today', label: 'Today' },
    { key: 'next_3_days', label: 'Next 2–3 days' },
    { key: 'next_1_week', label: 'Next 1 week' },
];

// Helper to get label from key
export function getTimelineLabel(key: TimelineFilterKey): string {
    return TIMELINE_FILTERS.find(f => f.key === key)?.label || 'Any';
}
