# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MatchHai is a sports venue booking platform using a "reverse bidding" model where players broadcast match intent and zone admins compete to fulfill requests. Supports CS2, Tekken, Futsal, and Cricket across iOS, Android, and web.

## Development Commands

### Main App (Expo React Native)
```bash
npm install          # Install dependencies
npm start            # Start Expo dev server
npm run android      # Run on Android
npm run ios          # Run on iOS
npm run web          # Run on web
```

### Firebase Cloud Functions (in /functions)
```bash
npm run build        # Compile TypeScript
npm run serve        # Run emulator locally
npm run deploy       # Deploy to Firebase
npm run logs         # View function logs
```

### Backend API Server (in /matchhai-backend)
```bash
npm run dev          # Dev with Nodemon (port 4000)
npm start            # Production start
```

### Firebase Emulators
```bash
firebase emulators:start  # Auth:9099, Firestore:8080, Functions:5001
```

## Architecture

### Tech Stack
- **Frontend**: Expo 54, React Native 0.81, React 19, TypeScript
- **Router**: Expo Router 6 (file-based routing in `/app`)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **State**: Zustand stores + AuthContext
- **Backend**: Firebase (Auth, Firestore, Storage, Cloud Functions)
- **API Bridge**: Express.js server for Steam/FACEIT/PSN integrations

### Directory Structure
```
/app                    # Expo Router file-based routes
├── auth/               # Login, signup screens
├── (player)/(tabs)/    # Player dashboard (grouped route)
├── zone/(tabs)/        # Zone admin dashboard
├── matchrooms/         # Match CRUD and booking flow
├── teams/              # Team management
└── super-admin/        # Platform admin controls

/src                    # Source code
├── services/           # Business logic (auth, booking, match, team, user, zone)
├── components/         # Reusable UI components
├── config/             # Firebase and API configuration
├── context/            # AuthContext for auth state
├── store/              # Zustand stores (onboarding)
├── hooks/              # Custom hooks
└── theme.ts            # Colors, typography, spacing

/functions              # Firebase Cloud Functions (TypeScript)
/matchhai-backend       # Express.js API server (Steam, FACEIT, PSN, Zones)
```

### User Roles & Routing
- **Player**: `/(player)/(tabs)` - Match discovery, booking, teams
- **Zone Admin**: `/zone/(tabs)` - Manage venues, handle booking requests, pricing
- **Super Admin**: `/super-admin` - Platform-wide controls

### Key Services (in /src/services/)
- `matchService.ts` - Match creation, state transitions, results
- `bookingService.ts` - Reverse bidding booking flow
- `userService.ts` - Profiles, onboarding, verification
- `zoneService.ts` - Venue/branch management
- `skillRatingService.ts` - ELO-style skill calculations

## Git Workflow

Branch naming: `<name>/<task-description>` (e.g., `junaid/api-fix`)

Protected branch: `main` - Uses local git hooks for OWNER/JUNIOR mode protection. See `github_workflow_guide.md` for details.

Standard flow:
1. Create feature branch from `main`
2. Push changes and open PR
3. Owner merges with `--no-ff`
