# Task: Refactor Discovery Tab

## Setup
- [x] Create `src/features/discover` directory structure
- [x] Create `src/features/discover/types.ts` (GameKey, DiscoverSegment)
- [x] Create `src/features/discover/utils/gameKeys.ts` (normalization)

## Component Extraction
- [x] Extract `DiscoverMatchroomList.tsx` from `matchrooms.tsx`
    - [x] Remove local game chips
    - [x] Accept global `selectedGame` and `searchQuery`
    - [x] Implement contextual filters
    - [x] Fix "Failed to backfill structured format" (permission-denied) warnings
    - [x] Identify source in `matchService.ts`
    - [x] Restrict `updateDoc` call to matchroom host only
    - [x] Defensively handle `permission-denied` errors in backfill logic
- [x] Fix Player Role Display
    - [x] Initialize `hostRole` from profile in `create/index.tsx`
    - [x] Correct keys and auto-selection in `RoleAutoFill.tsx`
    - [x] Update `matchService.ts` to persist profile role for host
    - [x] Refine `[id].tsx` to favor profile roles in UI
- [x] Verify and Finalize
    - [x] Perform final JSX structure check in `[id].tsx`
    - [x] Document changes in `walkthrough.md`
- [x] Extract `DiscoverPlayerList.tsx` from `find-players.tsx`
    - [x] Remove local chips
    - [x] Implement global filter logic
- [x] Extract `DiscoverTeamList.tsx` from `teams.tsx`
    - [x] Remove "My Teams" toggle (Discovery only)
    - [x] Implement global filters

## Discover Container
- [x] Create `app/(player)/(tabs)/discover.tsx`
    - [x] Implement Header (Search + Global Chips)
    - [x] Implement Segmented Control (Matchrooms | Players | Teams)
    - [x] Implement State hoisting & Caching logic
    - [x] Implement Lazy Loading of segments
- [x] Create `discover.styles.ts`

## Navigation & Cleanup
- [x] Update `_layout.tsx` (Add Discover, Remove old tabs)
- [x] Create `app/(player)/my-teams.tsx` (Migrate "My Teams" view)
- [x] Verify deep links and navigation flow

# Task: Refine Discover UI & Features

## UI Consistency & filters
- [x] Fix Segmented Control Styling (Make consistent tabs)
- [x] Implement Collapsible Filters in `DiscoverMatchroomList`
- [x] Add Contextual Filters to `DiscoverPlayerList` (Role, Level)
- [x] Add Contextual Filters to `DiscoverTeamList` (Open Slots, etc.)

## Zones Integration
- [ ] Create `DiscoverZoneList.tsx`
- [ ] Integrate Zones into `discover.tsx`

