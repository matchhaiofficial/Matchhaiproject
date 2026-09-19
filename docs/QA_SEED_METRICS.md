# QA Seed Metrics

Verified snapshot of Convex QA deployment `striped-dog-623` on 2026-09-14.
The control pack was deployed and seeded only in QA; production was untouched.

## Population

| Metric | Verified value |
| --- | ---: |
| Users | 335 |
| Players / zone admins / super admins | 270 / 64 / 1 |
| Realistic / control / older untagged users | 310 / 4 / 21 |
| KYC-verified profiles | 312 |
| Player wallets at Rs 5,000 | 270 |
| Total seeded player wallet value | Rs 1,350,000 |
| Realistic profiles per game | 50 each: CS2, CS 1.6, Valorant, FC, Tekken |
| Zones / branches | 64 / 107 |
| Branches with operating hours | 106 of 107 |
| Resources / represented capacity | 3,260 / 3,909 |
| Controlled teams / memberships | 6 / 18 |
| Matchrooms / notifications | 0 / 0 |
| Pending / overdue scheduled functions | 0 / 0 |
| Function calls today / this month | 1,385 / 1,385 |
| Database I/O today / this month | 0.02034 GB / 0.02034 GB |

There are no team challenges, reports, blocks, chats, booking requests, booking
intents, payment transactions, or wallet transactions. These records should be
created through the app during manual testing so the real user journey is tested.

## Controlled Scenarios

- `demo.superadmin@matchhai.demo` is now canonical: both `accountType` and
  `role` are `super_admin`, and it is hidden from public player/zone surfaces.
- Johar Esports Lounge is the positive zone fixture: its admin is KYC/OTP
  verified, both branches operate 09:00–23:00, and resources are available.
- North Nazimabad Gaming Arena is the deliberate negative zone fixture: its
  admin is KYC/OTP verified, but its one branch has no operating hours. Use it
  to test the setup warning and operating-hours editor.
- Two exact full rosters exist for each of CS2 (5v5), Tekken 8 (2-player
  rosters), and FC26 (2-player rosters). Members do not overlap between
  controlled teams.
- Fahad is the deliberate player KYC/OTP-negative fixture while retaining an
  Rs 5,000 wallet, proving that wallet balance does not bypass verification.
- Controlled players have deterministic QA avatar URLs so chat identity and
  avatar rendering can be exercised.

All 12 recommended manual identities were authenticated against the QA Better
Auth endpoint after seeding and returned HTTP 200. Each test session was signed
out afterward. The common QA password is documented outside the repository.

## Cleanup Performed

The preparation removed only legacy seeded scenario noise: eight seed-created
matchrooms, their 157 nearby-match notifications, eight teams, and 46 team-member
rows. No user, zone, branch, resource, payment, report, or production record was
deleted. Existing lifecycle tasks were cancelled; the post-seed scheduler check
found no pending work.

The post-seed usage harness reported no alerts. Its safety tripwires remain
15,000 daily function calls and 1 GB daily Database I/O.

## Seed Guarantees

The QA preparation is key-gated and disabled again after use. Future Karachi
realistic branches are created with default operating hours, while a bounded
repair updated all 101 existing realistic branches. The control pack creates no
matchroom, challenge, notification, cron, or scheduled lifecycle job. Re-running
it updates the six named teams rather than duplicating them.
