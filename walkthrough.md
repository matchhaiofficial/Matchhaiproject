# Reverse Bidding Walkthrough

I have implemented the "Reverse Bidding" ecosystem where Users request matches and Zone Admins bid to host them.

## 1. User Flow: Finding a Match
1.  **Home Screen**: Click **"Find a Match"** (new flow) instead of "Browse Lobbies".
2.  **Request Screen** (`/find-match`):
    *   Select Game (e.g., CS2).
    *   Select Time (e.g., Now).
    *   Select Area (e.g., Gulshan).
    *   **Submit**: This broadcasts a `BookingRequest` to the system.
3.  **Offers Screen** (`/find-match/offers`):
    *   The user is redirected here to wait for offers.
    *   Real-time list of offers from zones appears here.
    *   **Accept**: Clicking accept confirms the booking.

## 2. Zone Admin Flow: Receiving Requests
1.  **Dashboard** (`/zone/(tabs)`):
    *   New section: **"Incoming Requests 🔔"**.
    *   Admins see requests matching their supported games.
    *   Example: "Player X wants CS2 at 10 PM in Gulshan".
2.  **Send Offer**:
    *   Admin clicks "Send Offer".
    *   System sends a `BookingOffer` with a price (currently hardcoded to 4500 PKR for MVP).
    *   The offer appears instantly on the User's screen.

## 3. Files Created/Modified
*   `app/home/index.tsx`: Updated navigation.
*   `app/find-match/index.tsx`: New Request Screen.
*   `app/find-match/offers.tsx`: New Offers Screen.
*   `app/zone/(tabs)/index.tsx`: Updated Dashboard with Feed.
*   `src/services/zoneService.ts`: Added Request/Offer logic.
*   `src/services/matchService.ts`: Added User-side logic.

## 4. How to Test
1.  **As User**: Go to Home -> Find a Match -> Submit Request.
2.  **As Admin**: Log in as Zone Owner -> Dashboard -> See Request -> Send Offer.
3.  **As User**: See Offer appear -> Accept.
