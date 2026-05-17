# App Knowledge Base (Paste Source Doc Here)

# Matchhai Chatbot Knowledge Base Dataset

Purpose: support chatbot / RAG knowledge base for Matchhai.

## How the chatbot should use this dataset

- Prefer user-friendly explanations over code/file names.
- Ground answers in implemented behavior only.
- Do not promise manual fixes, refunds, payment confirmations, KYC approval, or moderation outcomes unless a backend/admin tool confirms it.
- Never ask for OTPs, PINs, passwords, private tokens, raw Easypaisa provider payloads, or other sensitive secrets.
- Use role-aware answers: player, zone admin, super admin, support agent, or developer.
- When unsure, explain the likely reasons and suggest safe next steps or escalation.
- For internal/developer users, route/file/table names can be mentioned. For normal users, avoid exposing implementation details.

## Dataset chunk format

Each section below can be used as a RAG chunk. Recommended metadata fields are: `id`, `title`, `audience`, `tags`, and `content`.

---

## kb-001 — Matchhai product identity

**Audience:** all  
**Tags:** overview, brand, product

Matchhai is a matchmaking, booking, and community platform for esports and selected sports. Its purpose is to help users find players, create or join matchrooms, book venues/zones, manage teams, chat with participants, track payments, and resolve booking/support issues inside one app.

The current product has three main surfaces: Player app, Zone Admin / venue operations app, and Super Admin control plane. The player app focuses on discovery, matchroom creation/joining, profile/game setup, wallet, inbox, schedule, teams, reports, and support. Zone admins manage venue/branch operations, bookings, pricing, resources, notifications, reports/support, insights, settings, audit, and AI support. Super admins handle moderation, payments, support tickets, audit logs, identity verifications, venue requests, reports, and matchroom oversight.

Use the brand name exactly as: Matchhai. Do not write MatchHai unless quoting a filename or legacy code identifier.


---

## kb-002 — Primary app roles and routing

**Audience:** all  
**Tags:** roles, routing, accounts

Matchhai supports three operational roles:

1. Player: normal user who discovers players/teams/zones, creates and joins matchrooms, pays through wallet/Easypaisa, chats, manages teams, views schedule, submits reports, and uses support.
2. Zone Admin: venue/zone owner or operator who manages branches, bookings, resources, pricing, notifications, support queues, AI support, insights, settings, audit, and migration tools.
3. Super Admin: internal Matchhai operator who manages platform-wide moderation, venue approvals, reports, support tickets, payment/reconciliation views, KYC/identity verifications, matchrooms, audit logs, and Easypaisa debug/operations where enabled.

Signed-out users go to login. Signed-in routing depends on account type and role: super-admin users go to super admin, zone accounts go to zone admin, and everyone else goes to the player tabs.


---

## kb-003 — Authentication and login policy

**Audience:** players,zone_admins  
**Tags:** auth, login, email, phone

Users can log in using email or Pakistani mobile number. During login, the user selects whether they are logging in as a player or a zone account. Login succeeds only when the selected mode matches the user profile type.

Phone login works by normalizing the phone number, finding the linked user record, and signing in with the underlying email. Password reset is email-based through Better Auth when available. Email verification is not required for login, but some actions may still be blocked by identity verification / KYC.

Current limitation: phone OTP is not fully wired as production SMS; the phone plugin currently logs OTP to the server console in development/placeholder form.


---

## kb-004 — Identity verification and KYC gate

**Audience:** players,zone_admins  
**Tags:** kyc, didit, verification, gates

High-value actions and surfaces are protected by KYC / identity verification, using Didit. The verification-required screen is now a KYC identity gate, not just an email verification screen.

KYC controls access to surfaces such as Discover, matchroom creation, and other high-value actions. The app checks KYC status on the client and also enforces it on the server for protected mutations. The player Discover tab can be hidden when KYC access is not allowed. The zone Branches tab can be hidden until the zone user is fully verified.

KYC status is handled through shared client and server helpers. Didit sessions are started from the app, and webhook updates come through the Convex HTTP route for Didit KYC webhooks.

When answering users: explain that login may still work, but some actions require identity verification first. Do not promise manual bypasses.


---

## kb-005 — Player registration flow

**Audience:** players  
**Tags:** registration, onboarding, player

Player onboarding uses four screens. It collects identity details, username, email, Pakistani phone number, password, city, age range, preferred areas, enabled games, game/role preferences, and optional platform links such as Steam, FACEIT, EA, Xbox, and PSN-related data.

The registration UI uses the modern internal Matchhai screen shell. Required labels use a red asterisk. City and age-range use modal/sheet picker style. Navigation between steps uses explicit route replacement instead of loose browser/back history.

Validation includes username/email/phone availability checks and password strength. Onboarding state is persisted between steps. Step 2 requires Karachi areas and at least one esports or sports interest. Step 3 platform linking is optional and can be skipped. Step 4 is a cleaner review/finalization screen. Signup creates or recovers the Better Auth user, creates the Convex profile if needed, and finalizes onboarding data.


---

## kb-006 — Zone registration flow

**Audience:** zone_admins  
**Tags:** registration, zone, venue

Zone onboarding collects business type, owner details, venue identity, contact email, Pakistani phone number, branch inventory, branch pricing, branch list, location data, and per-branch setup.

The zone onboarding flow uses the same modern screen shell and spacing as the player flow. Continue buttons are disabled until required fields are valid. Step 1 requires business type, owner, brand, valid email, valid Pakistani phone, and password. Step 2 requires at least one branch. Step 3 requires at least one inventory type with valid counts/prices. Step 4 requires both confirmations.

Final submission creates the auth account, creates the zone with pending-review status, and routes the zone admin into the zone dashboard. The venue remains under moderation until super admin approval.


---

## kb-007 — Supported games and discovery taxonomy

**Audience:** players  
**Tags:** games, discover, filters

Matchhai supports discovery and matchroom filters across CS2, CS 1.6, Valorant, FC26, Tekken 8, Futsal, indoor cricket, Padel, and Pickleball.

Discover has four segments: matchrooms, players, teams, and zones/venues. Filters are opened from a filter button and shown in a full-height drawer. Filter chips wrap in rows instead of horizontal scrolling. Active filter count is calculated per active segment.

Matchroom filters include game, area, timeline, availability, price range, skill level, and game-specific filters such as FACEIT level, role, series, format, positions, overs, or platform. Player filters include game, online availability, area, competitive intent, skill/role, and platform for console games. Team filters include game, recruiting status, area, team size, and competitive intent. Zone filters include venue type, proximity, area, price range, game/platform for gaming zones, and sport for sports courts.


---

## kb-008 — Player home dashboard

**Audience:** players  
**Tags:** home, dashboard

The player home dashboard shows profile summary, notification count, quick actions, recommended matchrooms, upcoming matchrooms, teams snapshot, nearby zones, wallet/request stats, resend verification options where relevant, and logout.

Recommended rooms are recent rooms that are not hosted by the user and not already joined, optionally filtered by the user's enabled games. Upcoming rooms are deduped from rooms hosted by the user and rooms joined by the user, filtered for not-expired rooms, and sorted by start time. Nearby zones are currently lightweight active-zone suggestions, not true geolocation search.

Local match reminders are scheduled through Expo local notifications, typically 15 minutes before start time.


---

## kb-009 — Profile and game details

**Audience:** players  
**Tags:** profile, games, skills

The player profile contains the profile card, connected platform cards, active and inactive game cards, skills, team summaries, and shortcuts into edit profile, game details, teams, matchrooms, and team creation.

Edit profile supports updating username, phone, email, password, bio, city, preferred areas, privacy settings, and platform links. Steam and FACEIT URLs can be validated, and PSN profile verification is supported.

The game details editor lets a user enable or update a game, set game-specific metadata such as roles, formations, positions, characters, and self-assessment, then write the resulting skill score into the user's skill scores.


---

## kb-010 — Friends, public profiles, and blocking

**Audience:** players  
**Tags:** social, friends, dm

Players can view public profiles, send friend requests, accept or reject friend requests, remove friends, block users, and unblock users.

Direct-message chat access requires an existing friendship and is blocked if either user has blocked the other. DM chatrooms are deduped by a sorted user-pair key. Deleting a DM message for yourself is supported through a soft delete. Full deletion is disabled for matchroom chat.


---

## kb-011 — Inbox and notifications

**Audience:** all  
**Tags:** inbox, notifications, push

The inbox handles workflow notifications such as friend requests, team join requests, match join requests, team invites, booking approvals, seat invitations, counter-offers, challenge notifications, payment results, report updates, and moderation/status messages.

Users can accept/decline supported request types, open linked entities, mark notifications as read, mark all as read, clear history, and delete notifications.

Server-created notifications use canonical notification records with dedupe keys, expiry behavior, push eligibility, push state, and deep-link routes. Push devices are stored per installation. Push payloads include route/href data so tapping a notification can open the correct screen.

Local match reminders are client-managed and deduped separately from server push notifications.


---

## kb-012 — Wallet model

**Audience:** players,support  
**Tags:** wallet, ledger, payments

The wallet lets players view balance, add funds, and inspect booking/payment history. Wallet history merges internal wallet ledger rows and gateway lifecycle payment rows.

The internal wallet ledger is stored in walletTransactions. Gateway lifecycle rows are stored in paymentTransactions. Easypaisa gateway rows are linked into wallet history by references like easypaisa:<orderRefNum>. Wallet add-funds supports idempotency when a reference is provided. Wallet deduction is strict: if funds are insufficient, the transaction fails and the UI tells the user to add funds.

Wallet payments are enabled. Card payments may exist in the UI shape but are feature-flagged or unavailable. Easypaisa is the current external gateway.


---

## kb-013 — Easypaisa payment flow

**Audience:** players,support,super_admins  
**Tags:** easypaisa, payments, checkout

Easypaisa is the currently wired external payment gateway. It supports wallet top-ups and booking-intent payments. Checkout is started through the app and Convex backend, using payment kind values such as wallet_topup or booking_intent.

Easypaisa flows support MA with OTC fallback in client flows. HTTP routes are registered under /payments/easypaisa/*, including checkout, token, finalize, and IPN routes. Provider behavior is environment-driven, including default flow and hosted fallback toggles.

Booking payments can return to the app through a deep link such as matchhai://matchrooms/book/status/<intentId>. Payment states include pending, paid, failed, and expired. Super admin has payment/reconciliation and Easypaisa operational/debug surfaces where enabled.


---

## kb-014 — Matchroom creation basics

**Audience:** players  
**Tags:** matchrooms, create

Matchroom creation supports configurable game, title, description, format, date, time, duration, location mode, zone selection or broadcast areas, team mode, reserved slots, and game-specific fields like maps, formations, characters, overs, series, and positions.

Pre-submit gates include KYC/identity verification, enabled game in profile, valid skill score or completed questionnaire, required zone or broadcast-area selection, valid team assignment where needed, and server-enforced scheduling constraints for direct zone bookings.

Creation outcomes include direct matchroom creation, zone-admin-mediated booking requests, and venue walk-in matchrooms. Matchrooms can have matchCode for lookup/deduplication and demo seeding.


---

## kb-015 — Matchroom join rules

**Audience:** players,support  
**Tags:** matchrooms, join, skill

To join a matchroom, the user must be authenticated, pass KYC/identity verification, join before the room expires, and the room must not be locked or full. The user must not already be in the room, must not have a duplicate pending request, must not have a conflicting active time clash, must have the game enabled in profile, and must have the required skill setup for that game.

Join gating is game-aware. Skill-band joining uses a fixed delta of 10 rating points. If a user is outside the room's skill band, the flow can route into captain approval through notifications and a join decision mutation.

Possible outcomes are direct join, captain approval request, or booking-intent/payment path.


---

## kb-016 — Matchroom detail actions

**Audience:** players,support  
**Tags:** matchrooms, lobby, captain

The matchroom detail screen supports sending join requests, cancelling join requests, accepting or rejecting incoming requests, leaving, deleting when allowed, starting match, opening chat, sharing, reporting/complaining, transferring captain, inviting friends into slots, kicking players, admin force-cancel, and handling linked booking or counter-offer actions.

Captain-only or host-only actions should not be described as available to every participant. When a user asks why they cannot perform an action, check whether they are captain/host, whether the matchroom is full/locked/expired, whether KYC is complete, and whether payment or venue confirmation is pending.


---

## kb-017 — Direct zone booking flow

**Audience:** players,zone_admins,support  
**Tags:** booking, zone, direct

In direct zone mode, the player selects a specific venue/zone during matchroom creation. The existing direct zone-admin flow remains request-based. The zone admin receives a booking request and can accept, reject, or counter-offer through the bookings module.

Direct-zone booking behavior remains separate from broadcast fanout. Direct requests continue to use the pre-existing booking request path and should not be described as broadcasting to multiple zones.


---

## kb-018 — Broadcast-area matchroom flow

**Audience:** players,zone_admins,support  
**Tags:** booking, broadcast, matchrooms, zones

Broadcast mode lets a player create a matchroom without selecting a confirmed venue upfront. Instead, the player selects target geographic areas. Only areas with active eligible zones for the selected game are selectable. Preferred profile areas can prefill the broadcast area selection when they match availability.

The matchroom is created with locationMode = broadcast and broadcastRequestStatus = waiting_for_fill. No fake venue is assigned at creation time. Before venue confirmation, cards and lobby details show the selected broadcast areas and indicate that the venue is not confirmed yet.

When the room becomes full, the server triggers fanout to eligible zone admins in the selected areas. Fanout changes the room state to waiting_for_zones and starts a 2-hour response window. Zone admins use the same accept/reject/counter-offer workflow as direct bookings.

The first valid zone acceptance wins and confirms the venue. Sibling pending requests and offers are closed. All players receive a venue-confirmed notification. If no zone confirms in time, the matchroom is cancelled, refunds are written, and players are notified.


---

## kb-019 — Broadcast counter-offers

**Audience:** players,zone_admins,support  
**Tags:** counter_offer, broadcast, captains

Broadcast-origin counter-offers reuse the zoneOffers model and the same modal/action path as direct requests. The important difference is recipient routing: only the resolved captains for the matchroom are notified about broadcast counter-offers, not all participants.

Broadcast counter-offers have a 30-minute response window, separate from the 2-hour zone-admin acceptance window. For team-vs-team rooms, both captain A and captain B must be resolvable and both must accept the counter-offer before the venue is confirmed. If any required captain rejects, that counter-offer path closes and the matchroom continues only if another request/offer is still available.

If required captains cannot be resolved, the counter-offer is not created and the request is marked as waiting for captains.


---

## kb-020 — Broadcast refunds

**Audience:** players,support,super_admins  
**Tags:** refunds, broadcast, wallet

If a broadcast matchroom fails because no zone accepts in time, no eligible zones are found, or all viable offer paths close, the system finalizes the broadcast failure. It marks the state terminal, cancels the matchroom, closes or expires sibling requests/offers, triggers idempotent refunds, and notifies players.

Refunds use wallet-ledger reconciliation. The original debit remains visible, and a separate refund transaction is written. Broadcast refund references use the format broadcast_refund:<matchroomId>:<originalTransactionId>. Duplicate refunds are prevented through reference-level idempotency checks.

Support agents should explain that refunds are ledger-backed and may appear as a separate wallet transaction instead of making the original debit disappear.


---

## kb-021 — Booking intent and seat payment

**Audience:** players,support  
**Tags:** booking_intent, seat, payment

The booking screen lets a user choose side, choose a team for prefilling, select slot positions, create a booking intent, then move into payment or status.

The booking payment screen fetches the intent and wallet balance. Users can pay with wallet or start Easypaisa checkout for booking intents. Card payment is explicitly unavailable. Successful wallet payment confirms the booking through the matchroom payment mutation.

Backend booking payments support both wallet deduction and externally referenced payment. Wallet path creates a withdrawal with a matchroom slot reference. External path creates a wallet transaction of type booking_payment with provider metadata, currently Easypaisa.


---

## kb-022 — Match result and voting

**Audience:** players,support  
**Tags:** results, votes, disputes

The match result screen lets the captain submit the winner. If a dispute flow opens, participants can vote winner or unknown. The product also supports match communication and complaints/reporting around matchrooms.

When answering result questions, do not promise automatic game-server result verification unless it is specifically implemented for that game/flow. Use the current captain submission and participant voting/dispute flow as the source of truth.


---

## kb-023 — Chat capabilities

**Audience:** players  
**Tags:** chat, messages, voice, attachments

Matchhai chat includes matchroom chats, team challenge chats, and friend direct messages. Chat supports text, voice recording/playback, image attachments, file attachments, replies, reactions, typing indicators, presence, read marking, and pinned messages.

Text messages can be edited only within a 15-minute server-enforced window. Voice messages cannot be edited. Matchroom chat pinning can be done by participants, with a cap of 5 pinned messages. Challenge chat pinning is captain-only, also capped at 5 pinned messages.

Chat attachment uploads use Convex storage. Push-only chat notifications can be sent without creating inbox rows.


---

## kb-024 — Teams

**Audience:** players  
**Tags:** teams, captain, members

Players can create teams by choosing game, team name, tag, and max size, and can optionally invite eligible same-game friends. My Teams lists the user's teams and links to team detail or team creation.

Team detail supports non-members requesting to join, members leaving, and captains reviewing join requests, accepting/rejecting requests, renaming the team, uploading/changing logo, inviting friends, removing members, transferring captain, deleting the team, and launching challenge creation.

Team actions may be gated by KYC/identity verification and role/captain permissions.


---

## kb-025 — Team challenges

**Audience:** players  
**Tags:** teams, challenges

Team challenges let captains select a challenger team, load an opponent, ensure both teams are full, choose date/time and preferred zone, send a challenge notification, accept or reject the challenge, propose venue, and create a private challenge matchroom when both captains align.

Captain chat unlocks after acceptance and a valid challenge state. Challenge notifications route captains to the relevant challenge screen.


---

## kb-026 — Zone admin dashboard and modules

**Audience:** zone_admins  
**Tags:** zone_admin, dashboard

The zone admin app includes dashboard home, branches, profile, bookings, resources, pricing, notifications, support, AI support, insights, settings, audit, and migration tools.

The zone home shows operational context for the venue. Branches manage venue branch data. Bookings manage direct and broadcast-origin requests. Resources manage allocatable inventory. Pricing manages venue/game/resource rates. Notifications handle zone-facing updates. Support handles reports and direct entry into AI support. Insights provide operational filtering, especially around wallet_topup and booking_intent transaction kinds. Settings handle zone configuration. Audit records operational events.


---

## kb-027 — Zone bookings module

**Audience:** zone_admins,support  
**Tags:** zone_admin, bookings, counter_offer

The zone bookings module is the zone admin's operational queue for direct booking requests and broadcast-origin fanout requests. Zone admins can accept, reject, or counter-offer where the request state allows.

Broadcast-origin requests carry requestKind, response expiry, target area label, and selected broadcast areas. The allocation sheet shows broadcast-area context and deadlines. First-accept-wins enforcement is backend-driven, so if another zone already accepted, later accepts fail even if the UI looks stale.

Zone admins should respond inside the visible response window. Broadcast fanout request window is 2 hours; broadcast counter-offers have 30 minutes for captain response.


---

## kb-028 — Zone resources and pricing

**Audience:** zone_admins,support  
**Tags:** zone_admin, resources, pricing

Zone resources represent allocatable venue inventory such as gaming PCs, consoles, courts, rooms, or other operational assets depending on venue type and branch setup. Pricing rules define how users are charged for available games/sports, venue types, branches, and resources.

Support answers should distinguish between a booking problem and a pricing/resource configuration problem. If users see wrong pricing or availability, likely causes include branch setup, active resource count, pricing rule configuration, game support, or zone status.


---

## kb-029 — Zone support and AI support

**Audience:** zone_admins,support  
**Tags:** support, ai_support, zone_admin

Zone admins have a support module for zone-scoped report queues, report drilldown, reviewer notes, marking reports reviewed, and a direct entry point into AI support.

AI support for zone admins uses the shared SupportChatScreen scoped to Zone Admin. Conversations and messages are Convex-backed, not client-only. Tool execution runs through a Convex HTTP endpoint for support agent tools. The safety posture blocks sensitive inputs such as OTPs, PINs, passwords, tokens, and provider payloads. Support tool execution is allowlisted and rate-limited server-side.

Final report resolution remains an admin/moderation action, not purely zone-side.


---

## kb-030 — Super admin surfaces

**Audience:** super_admins  
**Tags:** super_admin, moderation, operations

The super admin control plane includes dashboard/overview, payments, reports, profile, support tickets and per-ticket drilldown, support chat, audit logs, identity verifications, matchroom list and drilldown, venue request detail, report detail, and Easypaisa operations/debug where enabled.

Super admins moderate venue requests, reports, users/roles, identity verification operations, matchrooms, support tickets, and payment/reconciliation workflows. Super admin actions may update zones, user roles, report statuses, support tickets, and audit logs.

Super admin payment views are operational/reconciliation surfaces, not a player-facing checkout.


---

## kb-031 — Reports lifecycle

**Audience:** players,zone_admins,super_admins,support  
**Tags:** reports, moderation

Matchhai supports matchroom complaints, user reports, and zone complaints. Duplicate suppression exists. Players can view their own reports and inspect report status timeline. Zone admins can view venue-scoped reports and mark reviewed/add notes. Super admins globally moderate report statuses and final resolution.

Report-related notifications can be sent to reporters, zone owners, and super admins depending on the report type and status. Zone owner access does not mean the zone can fully resolve moderation cases; final resolution remains super-admin/moderation controlled.


---

## kb-032 — Support chatbot behavior

**Audience:** support,developers  
**Tags:** chatbot, support, rag, safety

The Matchhai support chatbot should answer using product knowledge, user role, and safe account context. It should explain flows, troubleshoot common issues, guide users to the right screen, and create/escalate support tickets when needed.

The chatbot must not ask users to share OTPs, PINs, passwords, tokens, Easypaisa raw provider payloads, private keys, or sensitive identity documents in chat. It should reject or redact sensitive inputs and route users toward secure in-app verification/payment/support flows.

For account-specific issues, the chatbot should ask for non-sensitive context such as the screen name, matchroom name/code, approximate time, payment status shown in app, or ticket/report id if visible. It should not claim to have completed payment/refund/manual moderation unless the backend tool actually confirms it.


---

## kb-033 — Support ticket model

**Audience:** support,super_admins,developers  
**Tags:** support_tickets, convex

Support is backed by Convex tables such as supportTickets, supportConversations, supportMessages, supportTicketNotes, supportAgentAuditLogs, and supportAgentRateLimits.

Support tickets and conversations are used by player support, zone AI support, and super-admin support surfaces. Support agent tool calls are routed through an allowlisted, rate-limited backend path. Ticket list and drilldown are available to super admins.

A chatbot can propose ticket creation when the issue needs human review, moderation, payment reconciliation, refund investigation, KYC review, or zone-admin follow-up.


---

## kb-034 — User-facing support escalation rules

**Audience:** support,chatbot  
**Tags:** escalation, safety

Escalate to human/support ticket when: payment is deducted but not reflected; refund does not appear after cancellation; KYC status seems stuck; a zone admin cannot see an expected booking request; a matchroom was incorrectly cancelled; an abusive user/report needs moderation; a user cannot access a paid booking; Easypaisa status differs from wallet status; or there are repeated app errors.

Ask for safe context only: user role, screen, matchroom title/code if visible, transaction/reference shown in app, approximate date/time, and screenshots if safe. Never request OTP, PIN, password, private tokens, full card data, CNIC images in chat, or raw payment provider payloads.

When escalation is created, explain that Matchhai support will review the issue and avoid promising a specific outcome unless confirmed by backend/admin policy.


---

## kb-035 — Current limitations and production readiness

**Audience:** developers,founders,support  
**Tags:** limitations, qa, production

The canonical audit is code-verified but static. It does not prove full device QA, end-to-end production validation, or load testing for 5,000 concurrent active users.

Important readiness areas include push notification QA, Easypaisa/payment QA, refund QA, KYC/Didit QA, production environment variables, Convex deployment readiness, Apple/TestFlight/EAS deployment readiness, load/performance testing, and final moderation UX cleanup.

When the chatbot answers users, it should not expose internal readiness gaps as product promises. For internal/admin users, it can mention known QA requirements if asked.


---

## kb-036 — Safe wording for unavailable features

**Audience:** chatbot  
**Tags:** responses, limitations

When a feature is not available, use clear wording:

- Card payments: Card payment is currently unavailable. Please use Wallet or Easypaisa if shown in your app.
- Venue not confirmed: Your matchroom is broadcasting to selected areas. The venue will be confirmed when an eligible zone accepts, or the matchroom may be cancelled/refunded if no zone confirms within the response window.
- Refund pending: Refunds appear as separate wallet transactions. Please check wallet history for a refund entry linked to the cancelled broadcast matchroom.
- KYC blocked: Your account can log in, but this action requires identity verification first.
- Zone approval pending: Your venue account was created, but it remains under moderation until approved by Matchhai.


---

## kb-037 — Common player FAQs

**Audience:** players,chatbot  
**Tags:** faq, players

Q: Why can I log in but not use Discover or create a matchroom?
A: Some high-value actions require identity verification/KYC. Complete the verification flow first.

Q: Why is my broadcast matchroom showing no venue?
A: Broadcast matchrooms start without a confirmed venue. After the room fills, the system sends requests to eligible zones in selected areas. The first valid zone acceptance confirms the venue.

Q: What happens if no zone accepts my broadcast matchroom?
A: The matchroom is cancelled and wallet-ledger refunds are created. The refund appears as a separate wallet transaction.

Q: Why can’t I pay by card?
A: Card payment is currently unavailable/feature-flagged. Use wallet or Easypaisa if shown.

Q: Why can’t I join a room?
A: Possible reasons include missing KYC, room full/locked/expired, game not enabled in profile, missing skill setup, duplicate pending request, time clash, or skill-band/captain approval requirement.


---

## kb-038 — Common zone admin FAQs

**Audience:** zone_admins,chatbot  
**Tags:** faq, zone_admin

Q: Why can’t I access all zone features after registration?
A: New venues are created with pending-review status and remain under moderation until approved. Some surfaces may also require identity verification.

Q: Where do I handle booking requests?
A: Use the zone bookings module. It contains direct zone requests and broadcast-origin fanout requests.

Q: What is the deadline for broadcast requests?
A: Broadcast fanout requests have a 2-hour response window. Broadcast counter-offers have a 30-minute captain response window.

Q: Why did my accept fail?
A: Broadcast bookings use first-accept-wins enforcement on the backend. Another zone may already have accepted and confirmed the venue.

Q: Can I fully resolve reports?
A: Zone admins can review zone-scoped reports and add notes, but final moderation resolution remains with admin/moderation.


---

## kb-039 — Common super admin FAQs

**Audience:** super_admins,chatbot  
**Tags:** faq, super_admin

Q: Where do I check payment operations?
A: Use the super admin payments tab and Easypaisa operational/debug surface where enabled.

Q: Where do support tickets live?
A: Super admin has support ticket list and per-ticket drilldown backed by Convex support ticket/conversation tables.

Q: Where do I review identity verification?
A: Use the identity verifications surface for Didit/KYC operational review.

Q: What can super admins moderate?
A: Venue requests, reports, users/roles, matchrooms, identity verifications, support tickets, and related audit logs.


---

## kb-040 — Developer handoff notes for chatbot RAG

**Audience:** developers  
**Tags:** rag, implementation, dataset

Recommended retrieval approach: chunk this knowledge base by topic and role. Attach metadata fields such as audience, tags, source_section, and sensitivity. For user-facing support, prefer chunks tagged players, zone_admins, support, wallet, booking, kyc, or faq. For admin-facing support, include super_admins and developers chunks only when the authenticated role allows it.

The chatbot should rank role-specific chunks first. For example, a zone admin asking about bookings should retrieve zone bookings and broadcast flow chunks before general matchroom chunks. A player asking about refund should retrieve broadcast refunds, wallet model, payment flow, and common player FAQs.

Keep raw audit routes/file paths out of normal user replies unless the conversation is with a developer/admin. Convert internal implementation details into user-friendly instructions.


---

