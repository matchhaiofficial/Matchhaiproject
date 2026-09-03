// Phase 8 — route-tree coverage tracker. Each it.todo marks a screen whose full
// RNTL smoke test is deferred (heavy provider/Convex tree). See
// docs/PAGE_COVERAGE.md for the mapping to existing unit/UI/E2E/security coverage
// and the recipe to convert a todo into a real mounted-screen smoke test.

describe("player surfaces (smoke deferred)", () => {
  it.todo("Home dashboard renders quick actions and at-a-glance panel");
  it.todo("Inbox lists notifications and renders empty state");
  it.todo("Friends screen renders and filters");
  it.todo("Friend chat renders message thread");
  it.todo("My Teams renders team cards (deleted users excluded from invite list)");
  it.todo("Schedule screen renders upcoming items");
  it.todo("Wallet screen shows balance / reserved / unpaid helper copy");
  it.todo("Own profile renders selected games");
  it.todo("Public profile shows only public-safe fields");
});

describe("matchroom surfaces (smoke deferred)", () => {
  it.todo("Matchroom detail renders roster and join/leave controls by lock state");
  it.todo("Booking screen renders slot selection and disabled state when locked");
  it.todo("Booking status screen shows pending/approved/confirmed/rejected copy");
  it.todo("Payment screen shows confirmed state and no stale 'do this later'");
  it.todo("Result modal: captain sees submit controls, non-captain read-only");
});

describe("team surfaces (smoke deferred)", () => {
  it.todo("Team details: captain badge vs member badge");
  it.todo("Team chat button visible to members");
  it.todo("Team challenge create / list render");
});

describe("zone admin surfaces (smoke deferred)", () => {
  it.todo("Zone admin dashboard renders");
  it.todo("Zone admin bookings (requests/walkins/history) render");
  it.todo("Zone admin wallet and pricing render");
});

describe("super admin surfaces (smoke deferred)", () => {
  it.todo("Super admin users / zones render and gate non-admins");
  it.todo("Super admin payments / withdrawals render");
  it.todo("Super admin reports / support render");
});

describe("auth surfaces (smoke deferred)", () => {
  it.todo("Login: disabled submit on invalid fields, validation error, safe auth error");
  it.todo("Registration steps: required fields, next/prev navigation, selected games");
  it.todo("Forgot/reset/change password render and validate");
});
