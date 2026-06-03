# MatchHai Maestro E2E Flows

End-to-end UI flows for the MatchHai Expo / React Native app, driven by
[Maestro](https://maestro.mobile.dev). These run against a **development or
preview build** pointed at the **staging Convex deployment** —
`https://quick-panda-920.convex.cloud`. Never run them against production.

> All flows live in this directory and run via the existing npm scripts:
> `npm run e2e:maestro` (alias for `maestro test .maestro`), plus
> `npm run e2e:maestro:android` / `npm run e2e:maestro:ios` platform variants.

---

## 1. Install Maestro

Follow the official guide: https://maestro.mobile.dev/getting-started/installing-maestro

- macOS / Linux: `curl -fsSL "https://get.maestro.mobile.dev" | bash`
- Windows: install via WSL2 (recommended) or follow the Windows notes in the
  docs. Maestro needs a JDK and either an Android emulator (with `adb` on PATH)
  or an iOS simulator (macOS only).

Verify: `maestro --version`.

> This repo does not install or run Maestro for you. Install it locally first.

---

## 2. Build the app (development or preview)

Maestro drives a real installed build. Use one of the `eas.json` profiles:

| Profile       | Use for                                         | Convex URL (staging)                       |
| ------------- | ----------------------------------------------- | ------------------------------------------ |
| `development` | Dev client + Metro; fastest iteration           | from your local env / dev client           |
| `preview`     | Standalone internal build; closest to release   | `https://quick-panda-920.convex.cloud` (baked into the profile `env`) |

The `preview` profile already pins the staging Convex URL, site URL, app
scheme (`matchhai`), and super-admin email in `eas.json`. Prefer `preview` for
stable, self-contained E2E runs.

```bash
# Development build (dev client)
eas build --profile development --platform android
eas build --profile development --platform ios

# Preview build (standalone, staging Convex) — recommended for E2E
eas build --profile preview --platform android   # produces an .apk
eas build --profile preview --platform ios
```

Install the resulting artifact on your emulator/simulator (e.g.
`adb install <app>.apk` for Android, drag the `.app` onto the iOS simulator).

App identifiers (from `app.json`):
- Android package: `com.ovaisto.matchhai`
- iOS bundle id:  `com.ovaisto.matchhai`
- URL scheme:     `matchhai`

---

## 3. Run on an emulator / simulator

**Android emulator**
1. Launch an AVD from Android Studio (or `emulator -avd <name>`).
2. Ensure `adb devices` lists it.
3. Install the build, then:
   ```bash
   npm run e2e:maestro:android
   # or a single flow:
   maestro test .maestro/01-login.yaml
   ```

**iOS simulator** (macOS only)
1. Open a simulator (`xcrun simctl boot <device>` or via Xcode).
2. Install the build, then:
   ```bash
   npm run e2e:maestro:ios
   # or a single flow:
   maestro test .maestro/01-login.yaml
   ```

Run the whole suite in order: `npm run e2e:maestro` (uses `config.yaml` order).

Run a subset by tag:
```bash
maestro test --include-tags=smoke .maestro
maestro test --include-tags=payment .maestro
```

---

## 4. Seed the staging data (Phase 7)

The flows expect seeded players, a venue/zone, and games on the test users'
profiles. Seed scripts live in `scripts/`:

- `scripts/seed-karachi-realistic-demo.mjs` — realistic Karachi demo dataset
  (players, zones, etc.). Usage:
  `node scripts/seed-karachi-realistic-demo.mjs "<seedKey>" [xlsxPath]`
- `scripts/seed-demo-data.mjs` — generic demo data seeder.
- `scripts/remove-karachi-realistic-demo.mjs` / `scripts/remove-demo-data.mjs`
  — teardown counterparts.

Seeding requires `EXPO_PUBLIC_CONVEX_URL` (or `CONVEX_URL`) and, for the
Karachi script, a **dev** deployment (`CONVEX_DEPLOYMENT` must start with
`dev:`). For staging E2E, point `EXPO_PUBLIC_CONVEX_URL` at
`https://quick-panda-920.convex.cloud` and follow the Phase 7 seed runbook for
the staging seed key. After seeding, set the seeded credentials in
`.env.e2e` (below).

> The E2E users must (a) exist, (b) be KYC-verified so the Discover tab is
> unlocked, and (c) have the `E2E_GAME_LABEL` game added to their profile so it
> appears in the create grid. Flow `02-select-games` adds the game if missing.

---

## 5. Credentials / env handling

Copy the template and fill in **staging** values:

```bash
cp .maestro/.env.e2e.example .maestro/.env.e2e
```

`.maestro/.env.e2e` is **gitignored** (see `.maestro/.gitignore`) and must
never be committed. No real passwords or secrets belong in the YAML flows —
they reference `${E2E_...}` variables only.

Pass the vars to Maestro one of two ways:

- Per-run flags: `maestro test -e E2E_USER_EMAIL=... -e E2E_USER_PASSWORD=... .maestro`
- Export the file into the environment before running (PowerShell):
  ```powershell
  Get-Content .maestro\.env.e2e | ForEach-Object {
    if ($_ -and -not $_.StartsWith('#')) { $k,$v = $_.Split('=',2); [Environment]::SetEnvironmentVariable($k,$v) }
  }
  npm run e2e:maestro
  ```

Variables (see `.env.e2e.example` for the full annotated list):
`E2E_APP_ID`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_USER2_EMAIL`,
`E2E_USER2_PASSWORD`, `E2E_HOST_EMAIL`, `E2E_HOST_PASSWORD`,
`E2E_MATCHROOM_TITLE`, `E2E_GAME_LABEL`.

---

## 6. Flows

| File                          | Purpose                                                  |
| ----------------------------- | -------------------------------------------------------- |
| `01-login.yaml`               | Login seeded player, assert dashboard.                   |
| `02-select-games.yaml`        | Open profile, add/select a game, save, assert it shows.  |
| `03-create-matchroom.yaml`    | Create a matchroom (game/zone/date/time), assert created.|
| `04-discover-matchroom.yaml`  | Find the created room in Discover, open its detail.      |
| `05-join-request.yaml`        | Second user requests to join, assert request sent.       |
| `06-approve-reject-join.yaml` | Host approves the join request (reject path commented).  |
| `06b-reject-join.yaml`        | Standalone reject path (needs a fresh pending request).  |
| `07-booking-intent.yaml`      | Select a slot and create a booking intent.               |
| `08-mock-payment.yaml`        | **Mock/staging payment only** — confirm payment + status.|
| `09-result-verification.yaml` | Captain submits result; participant verifies/votes.      |

`config.yaml` pins execution order (login first) and tag groups
(`smoke`, `core`, `payment`, `result`).

### ⚠️ Payment safety

`08-mock-payment.yaml` is **staging / mock mode only**. The real Easypaisa
production gateway must **never** be used in E2E, and no real mobile-account
number or real money may be entered. The flow uses a placeholder mock number
and assumes staging Convex has Easypaisa in sandbox/mock mode.

---

## 7. testID reference

Flows prefer `id:` selectors where testIDs exist, and fall back to visible
text otherwise. Status assertions use `|`-separated text alternatives because
post-action copy varies by room state.

**Confirmed present** (added/verified in source):

| testID                                  | Source file                          |
| --------------------------------------- | ------------------------------------ |
| `login-email-input`                     | `app/auth/login.tsx`                 |
| `login-password-input`                  | `app/auth/login.tsx`                 |
| `login-submit-button`                   | `app/auth/login.tsx`                 |
| `matchroom-create-submit`               | `app/matchrooms/create/index.tsx`    |
| `matchroom-request-join-button`         | `app/matchrooms/[id].tsx` (pre-existing) |
| `matchroom-request-join-bottom-button`  | `app/matchrooms/[id].tsx` (pre-existing) |

**TODO — testIDs to add** (flows currently use text fallbacks for these; add
the testID then switch the flow to `id:` for stability):

| TODO testID                                   | Suggested source file                                   |
| --------------------------------------------- | ------------------------------------------------------- |
| `profile-tab` / `discover-tab`                | `app/(player)/(tabs)/_layout.tsx`                       |
| `profile-edit-button`, `profile-save-button`  | `app/(player)/profile/edit.tsx`                         |
| `profile-game-toggle-<gameKey>`               | `app/(player)/profile/game-details.tsx`                 |
| `game-select-<gameKey>`                       | `app/matchrooms/create/components/GameSelector.tsx`     |
| `matchroom-title-input`                       | `app/matchrooms/create/components/BasicFields.tsx`      |
| `matchroom-date-field` / `matchroom-date-confirm` | `app/matchrooms/create/components/BasicFields.tsx`  |
| `matchroom-time-field` / `matchroom-time-confirm` | `app/matchrooms/create/components/BasicFields.tsx`  |
| `zone-picker-open` / `zone-picker-option`     | `app/matchrooms/create/components/ZonePicker.tsx`       |
| `matchroom-card`                              | `app/matchrooms/components/MatchroomCard.tsx`           |
| `discover-search-input`                       | `app/(player)/(tabs)/discover.tsx`                      |
| `join-request-approve-button` / `join-request-reject-button` | `app/matchrooms/[id].tsx`                |
| `matchroom-book-button`                       | `app/matchrooms/[id].tsx`                               |
| `booking-slot-option` / `booking-confirm-button` | `app/matchrooms/book/[id].tsx`                       |
| `payment-pay-now-button`                      | `app/matchrooms/[id].tsx`                               |
| `payment-confirm-button` / `payment-phone-input` | `app/matchrooms/create/index.tsx` (Easypaisa dialog) |
| `result-report-button`                        | `app/matchrooms/[id].tsx`                               |
| `result-team1-option` / `result-team2-option` / `result-submit-button` | `app/matchrooms/result.tsx`    |
| `result-vote-button`                          | `app/matchrooms/[id].tsx`                               |

> Convention: lowercase kebab-case. Read the screen before adding a testID and
> add it only to the element a flow references — avoid over-polluting.
