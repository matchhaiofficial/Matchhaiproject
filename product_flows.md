# MatchHai Product Flows

## 1. Core Concept: The "Reverse Bidding" Ecosystem
MatchHai flips the traditional booking model. Instead of just browsing for open slots, users broadcast their intent ("I want to play CS2 at 10 PM in North Nazimabad"), and Zone Admins compete to fulfill that request. This ensures maximum utilization for zones and convenience for users.

---

## 2. Zone Admin Flow (The Service Provider)

The Zone Admin is the backbone of the ecosystem. Their interface focuses on **Yield Management** (filling slots) and **Operations** (running matches).

### A. Onboarding & Setup
1.  **Registration**: Business Name, Location (GPS + Address), Facilities (e.g., "10 High-End PCs", "1 Futsal Court").
2.  **Verification**: Upload business proof.
3.  **Configuration**:
    *   **Rates**: Set price per hour/match.
    *   **Schedule**: Define operating hours.
    *   **Games Supported**: Toggle CS2, Tekken, Futsal, etc.

### B. Dashboard (The Command Center)
*   **Live Pulse**: Real-time view of current activity.
    *   "Court A: Active (Match ending in 15m)"
    *   "PC Row 1: Active (CS2 Match)"
*   **Incoming Requests (The "Bykea" Feed)**:
    *   **Trigger**: A user nearby requests a slot.
    *   **Notification**: "New Request: CS2 5v5 @ 10 PM (3km away)".
    *   **Action**:
        *   **Accept/Offer**: Admin clicks to send an offer. Can add a custom note (e.g., "Discounted to 4000 PKR").
        *   **Ignore**: Swipe away.
*   **Booking Calendar**:
    *   Visual timeline of confirmed bookings.
    *   Ability to manually block slots (for walk-ins or maintenance).

### C. Match Management
1.  **Check-In**:
    *   User arrives and shows QR Code.
    *   Admin scans QR to "Unlock" the match.
2.  **Live Monitoring**:
    *   See who is in the lobby.
    *   Receive alerts for disputes.
3.  **Result Submission**:
    *   At match end, Admin inputs/verifies the score (e.g., "Team A won 16-14").
    *   This acts as the "Truth" for the ranking system.

### D. Analytics & Wallet
*   **Earnings**: Daily/Weekly revenue breakdown.
*   **Performance**: Occupancy rate, top games.

---

## 3. User Flow (The Player)

The User flow is designed for speed and "finding a squad".

### A. Home Screen (The Hub)
*   **Quick Actions**:
    *   **"Find a Match" (Reverse Bid)**: The primary call-to-action.
    *   **"Book Specific Zone"**: Traditional browse mode.
*   **My Feed**:
    *   Upcoming matches.
    *   Live nearby lobbies looking for players (e.g., "Need 1 for Futsal").

### B. "Find a Match" (Reverse Bidding Flow)
1.  **Intent**: User selects **Game** (e.g., CS2) + **Time** (e.g., 10 PM).
2.  **Location**:
    *   *Option A*: "Current Location" (Radius slider).
    *   *Option B*: "Specific Areas" (Select multiple: Gulshan, Johar, PECHS).
3.  **Broadcast**: User hits "Find Zones".
    *   *System State*: "Waiting for offers..." (Pulse animation).
4.  **Selection**:
    *   Offers pop up in real-time:
        *   "NukeTown (Gulshan) - 4500 PKR - Available"
        *   "Velocity (Johar) - 4200 PKR - Available"
    *   User compares Price, Distance, and Rating.
5.  **Booking**:
    *   User selects an offer.
    *   Pays deposit (or full amount).
    *   **Matchroom Created**.

### C. Matchroom (The Lobby)
Once a zone is booked (via Reverse Bid or Direct Booking), the **Matchroom** is the central gathering place.
1.  **Lobby State**:
    *   **Host**: The user who booked.
    *   **Slots**: Empty slots waiting for players.
2.  **Filling the Squad**:
    *   **Invite**: Send link to friends.
    *   **Open to Public**: Allow nearby solo players to join.
    *   **Role Selection** (if applicable):
        *   *Futsal*: Pick GK/DEF/FWD.
        *   *Cricket*: Pick Batting Order.
3.  **Locked State** (24h before):
    *   Rosters finalized.
    *   "Ready for Match" status.

### D. Match Day
1.  **Arrive**: Go to the Zone.
2.  **Check-In**: Show QR code to Admin.
3.  **Play**: Enjoy the game.
4.  **Result**: Captains submit score (verified by Admin).

---

## 4. Technical Implications
*   **Notifications**: Heavy reliance on real-time push notifications for Admins (Requests) and Users (Offers).
*   **Geolocation**: Spatial queries to find Zones within the user's preferred radius/areas.
*   **Concurrency**: Handling multiple Admins bidding on the same user request (first come vs list selection).
