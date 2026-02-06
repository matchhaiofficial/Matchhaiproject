# Phase 8 QA Matrix (Android + iOS)

## Environment
- Test on both platforms with same Firebase project and latest rules.
- Use clean app start (`npx expo start -c`) and authenticated test users.
- Optional touch tracing:
  - PowerShell: `$env:EXPO_PUBLIC_TOUCH_DEBUG='1'; npx expo start -c`
  - Reset: `Remove-Item Env:EXPO_PUBLIC_TOUCH_DEBUG`

## Roles
- Player
- Captain
- Zone Owner

## Critical Paths
1. **Discover / Matchrooms**
   - Open tabs, switch segments, apply filters, open details.
   - Verify FAB clickability (`discover_fab_*`, `matchrooms_fab_create` logs).
2. **Create Matchroom**
   - Fill required fields and submit.
   - Verify CTA logs (`create_matchroom_submit` pressIn/press).
3. **Lobby Details**
   - Request join, cancel request, leave, start/report/vote flows.
   - Verify header actions: chat/share/delete/leave.
4. **Chatroom**
   - Send normal text + quick chips.
   - Validate message order/anchor, bubble alignment, seen state, participant gating.
   - Verify send logs (`chat_send_button`).
5. **Inbox**
   - Accept/reject friend/team/match requests.
   - Swipe-to-delete in history and clear all history.
6. **Profile**
   - Save profile edit and game details.
   - External profile page actions: add friend / accept / decline / sync.
7. **Teams**
   - Create team, invite flow, join/leave team, captain actions.

## Expected Outcomes
- No dead taps on footer CTAs, FABs, or primary action buttons.
- No platform-specific overlap blocking taps near bottom safe area.
- Keyboard does not swallow primary CTA taps.
- Permission-gated actions show correct visibility and behavior.
- No runtime errors, hook order errors, or Firestore permission regressions.

## Report Format
- Platform:
- Role:
- Scenario:
- Result: Pass / Fail
- Log tag (if failed):
- Screenshot / recording:
- Repro steps:
