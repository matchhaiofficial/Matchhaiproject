# MatchHai PSN Service

A standalone serverless microservice to verify PlayStation Network accounts and fetch game stats (Tekken 8, FC 25/26) for MatchHai.

Built with [psn-api](https://github.com/achievements-app/psn-api) and Vercel Serverless Functions.

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file (or set in Vercel project settings):
   ```
   PSN_NPSSO=your_64_char_npsso_here
   ```

3. **Run Locally**

   **Option A: Using Vercel CLI (Recommended)**
   ```bash
   npm run dev
   ```

   **Option B: Standalone Node Server** (No Vercel CLI needed)
   ```bash
   npm run local-dev
   ```
   This compiles TS and runs a simple local server at `http://localhost:3001`.

## API Endpoint

### `POST /api/psn-verify`

Verifies a PSN Online ID and returns trophy stats for Tekken 8 and FC 25/26.

**Request:**
```json
{
  "psnOnlineId": "Hakoom",
  "wantsTekken": true,
  "wantsFc": true
}
```

**Response (Success):**
```json
{
  "status": "ok",
  "psn": {
    "psnOnlineId": "Hakoom",
    "psnAccountId": "123456789",
    "trophyLevel": "999",
    "trophyTier": 4,
    "totalTrophies": { "bronze": 100, "silver": 50, "gold": 10, "platinum": 1 },
    "tekken8": {
      "present": true,
      "progress": 85,
      "earnedTrophies": { ... },
      "lastPlayedDateTime": "2024-12-01T10:00:00Z"
    },
    "fc": {
      "present": false,
      "progress": null,
      "earnedTrophies": null,
      "lastPlayedDateTime": null
    },
    "psnLastSyncedAt": "2024-12-11T08:00:00Z"
  }
}
```

**Response (Error):**
```json
{
  "status": "error",
  "message": "PSN user not found or not publicly searchable"
}
```

## Deployment

Deploy to Vercel (US/EU Region recommended for PSN reliability):
```bash
vercel deploy
```
