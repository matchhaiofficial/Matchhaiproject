// src/constants/profileOptions.ts

export const DEFAULT_CITY = "Karachi";

export const CITY_OPTIONS = [DEFAULT_CITY] as const;

// --- Karachi Areas ---
export const KARACHI_AREAS = [
  "Federal B. Area",
  "Dastagir",
  "Gulshan-e-Iqbal",
  "Gulistan-e-Johar",
  "Bahadurabad",
  "Tariq Road",
  "P.E.C.H.S Block 2",
  "Defence Housing Authority Karachi",
  "Clifton Karachi",
  "North Nazimabad",
  "North Karachi",
  "Nazimabad",
  "Karsaz",
] as const;

export type KarachiArea = (typeof KARACHI_AREAS)[number];

const AREA_ALIAS_MAP: Record<string, KarachiArea> = {
  "bahadurabad": "Bahadurabad",
  "clifton": "Clifton Karachi",
  "clifton karachi": "Clifton Karachi",
  "dastagir": "Dastagir",
  "defence": "Defence Housing Authority Karachi",
  "defence housing authority": "Defence Housing Authority Karachi",
  "defence housing authority karachi": "Defence Housing Authority Karachi",
  "defense": "Defence Housing Authority Karachi",
  "defense housing authority": "Defence Housing Authority Karachi",
  "dha": "Defence Housing Authority Karachi",
  "dha karachi": "Defence Housing Authority Karachi",
  "f b area": "Federal B. Area",
  "federal b area": "Federal B. Area",
  "federal b area karachi": "Federal B. Area",
  "fb area": "Federal B. Area",
  "gulistan e johar": "Gulistan-e-Johar",
  "gulistan johar": "Gulistan-e-Johar",
  "gulistan-e-johar": "Gulistan-e-Johar",
  "gulshan e iqbal": "Gulshan-e-Iqbal",
  "gulshan iqbal": "Gulshan-e-Iqbal",
  "gulshan-e-iqbal": "Gulshan-e-Iqbal",
  "johar": "Gulistan-e-Johar",
  "karsaz": "Karsaz",
  "nazimabad": "Nazimabad",
  "north karachi": "North Karachi",
  "north nazimabad": "North Nazimabad",
  "p e c h s": "P.E.C.H.S Block 2",
  "p e c h s block 2": "P.E.C.H.S Block 2",
  "pechs": "P.E.C.H.S Block 2",
  "pechs block 2": "P.E.C.H.S Block 2",
  "tariq road": "Tariq Road",
};

const normalizeAreaKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[.\-]/g, " ")
    .replace(/\s+/g, " ");

export const normalizeKarachiAreaLabel = (value?: string | null): string => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const exact = KARACHI_AREAS.find((area) => area === trimmed);
  if (exact) return exact;

  const normalizedKey = normalizeAreaKey(trimmed);
  return AREA_ALIAS_MAP[normalizedKey] || trimmed;
};

export const normalizeKarachiAreaList = (
  values?: readonly (string | null | undefined)[] | null,
): string[] => {
  const seen = new Set<string>();
  const next: string[] = [];

  (values || []).forEach((value) => {
    const normalized = normalizeKarachiAreaLabel(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    next.push(normalized);
  });

  return next;
};

// --- User Demographics ---
export const AGE_RANGES = [
  "13-17",
  "18-24",
  "25-34",
  "35+"
] as const;

export const PLAY_TIME_OPTIONS = [
  "Weekday evenings (7-11 PM)",
  "Weekend daytime",
  "Late night (11 PM-3 AM)"
] as const;

// --- Game options ---
export const GAME_OPTIONS = [
  { key: "cs2", label: "Counter-Strike 2" },
  { key: "cs16", label: "CS 1.6" },
  { key: "valorant", label: "Valorant" },
  { key: "fc26", label: "FC 26" },
  { key: "tekken8", label: "Tekken 8" },
] as const;

// --- CS2 roles ---
export const CS2_ROLES = [
  "Entry Fragger",
  "Support",
  "AW Per",
  "In-Game Leader (IGL)",
  "Lurker",
] as const;

export const VALORANT_ROLES = [
  "Entry Fragger",
  "Secondary Entry / Trader",
  "Initiator / Support",
  "Controller / Smoker",
  "Sentinel / Anchor",
] as const;

// --- FC 26 formations (codes only, UI stays clean) ---
export const FC_FORMATIONS = [
  "3-1-4-2",
  "3-4-1-2",
  "3-4-2-1",
  "3-4-3",
  "3-4-3 Flat",
  "3-5-2",
  "4-1-2-1-2",
  "4-1-2-1-2 (2)",
  "4-1-2-1-2 Narrow",
  "4-1-2-1-2 Wide",
  "4-1-3-2",
  "4-1-4-1",
  "4-2-1-3",
  "4-2-2-2",
  "4-2-3-1",
  "4-2-3-1 (2)",
  "4-2-3-1 Narrow",
  "4-2-3-1 Wide",
  "4-2-4",
  "4-3-1-2",
  "4-3-2-1",
  "4-3-3",
  "4-3-3 (2)",
  "4-3-3 (3)",
  "4-3-3 (4)",
  "4-3-3 Attack",
  "4-3-3 Defend",
  "4-3-3 Flat",
  "4-3-3 Holding",
  "4-4-1-1 (2)",
  "4-4-1-1 Midfield",
  "4-4-2",
  "4-4-2 (2)",
  "4-4-2 Flat",
  "4-4-2 Holding",
  "4-5-1",
  "4-5-1 (2)",
  "4-5-1 Attack",
  "4-5-1 Flat",
  "5-2-1-2",
  "5-2-3",
  "5-3-2",
  "5-3-2 Holding",
  "5-4-1",
  "5-4-1 Flat",
] as const;

// --- FC 26 leagues + teams ---
export const FC_LEAGUES = [
  {
    id: "premier_league",
    name: "Premier League",
    teams: [
      "Arsenal",
      "Aston Villa",
      "Barnsley",
      "Birmingham City",
      "Blackburn Rovers",
      "Blackpool",
      "Bolton Wanderers",
      "Bournemouth",
      "Bradford City",
      "Brentford",
      "Brighton and Hove Albion",
      "Burnley",
      "Cardiff City",
      "Charlton Athletic",
      "Chelsea",
      "Coventry City",
      "Crystal Palace",
      "Derby County",
      "Everton",
      "Fulham",
      "Huddersfield Town",
      "Hull City",
      "Ipswich Town",
      "Leeds United",
      "Leicester City",
      "Liverpool",
      "Luton Town",
      "Manchester City",
      "Manchester United",
      "Middlesbrough",
      "Newcastle United",
      "Norwich City",
      "Nottingham Forest",
      "Oldham Athletic",
      "Portsmouth",
      "Queens Park Rangers",
      "Reading",
      "Sheffield United",
      "Sheffield Wednesday",
      "Southampton",
      "Stoke City",
      "Sunderland",
      "Swansea City",
      "Swindon Town",
      "Tottenham Hotspur",
      "Watford",
      "West Bromwich Albion",
      "West Ham United",
      "Wigan Athletic",
      "Wimbledon",
      "Wolverhampton Wanderers",
    ],
  },
  {
    id: "laliga",
    name: "LaLiga",
    teams: [
      "Alavés",
      "Athletic",
      "Atlético Madrid",
      "Barcelona",
      "Betis",
      "Celta Vigo",
      "Elche",
      "Espanyol",
      "Getafe",
      "Girona",
      "Levante",
      "Mallorca",
      "Osasuna",
      "Oviedo",
      "Rayo Vallecano",
      "Real Madrid",
      "Real Sociedad",
      "Sevilla",
      "Valencia",
      "Villarreal",
    ],
  },
  {
    id: "serie_a",
    name: "Serie A",
    teams: [
      "Bologna",
      "Fiorentina",
      "Juventus",
      "Milan",
      "Napoli",
      "Roma",
      "Torino",
      "Inter",
      "Lazio",
      "Lecce",
      "Udinese",
      "Verona",
      "Atalanta",
      "Cagliari",
      "Genoa",
      "Como",
      "Parma",
      "Sassuolo",
      "Cremonese",
      "Empoli",
      "Monza",
    ],
  },
  {
    id: "bundesliga",
    name: "Bundesliga",
    teams: [
      "Bayern Munich",
      "Eintracht Frankfurt",
      "FC Koln",
      "Borussia Dortmund",
      "FC St. Pauli",
      "VfL Wolfsburg",
      "FC Augsburg",
      "VfB Stuttgart",
      "TSG Hoffenheim",
      "Union Berlin",
      "RB Leipzig",
      "Bayer 04 Leverkusen",
      "Mainz",
      "Borussia Mönchengladbach",
      "Hamburger SV",
      "Werder Bremen",
      "Heidenheim",
      "SC Freiburg",
    ],
  },
  {
    id: "ligue_1",
    name: "Ligue 1",
    teams: [
      "Lyon",
      "Marseille",
      "Monaco",
      "Nantes",
      "Nice",
      "PSG",
      "Strasbourg",
      "Auxerre",
      "Lens",
      "Lille",
      "Rennes",
      "Toulouse",
      "Le Havre",
      "Angers",
      "Metz",
      "Lorient",
      "Saint-Etienne",
      "Bordeaux",
    ],
  },
] as const;

// --- Tekken 8 characters ---
export const TEKKEN_CHARACTERS = [
  "Kasuya Mishima",
  "Jin Kazama",
  "Jun Kazama",
  "Paul Phoenix",
  "Marshall Law",
  "King",
  "Lars Alexandersson",
  "Ling Xiaoyu",
  "Jack-8",
  "Nina Williams",
  "Asuka Kazama",
  "Leroy Smith",
  "Hwoarang",
  "Lili",
  "Bryan Fury",
  "Claudio Serafino",
  "Azucena",
  "Raven",
  "Leo Kliesen",
  "Steve Fox",
  "Kuma",
  "Yoshimitsu",
  "Shaheen",
  "Dragunov",
  "Feng Wei",
  "Panda",
  "Devil Jin",
  "Zafina",
  "Alisa Bosconovitch",
  "Lee Chaolan",
  "Victor Chevalier",
  "Reina",
  "Eddy Gordo",
  "Lidia Sobieska",
] as const;

// Physical sports are temporarily disabled across the app.
export const SPORT_OPTIONS: ReadonlyArray<{
  key: "futsal" | "indoor_cricket" | "padel" | "pickleball";
  label: string;
}> = [
  // { key: "futsal", label: "Futsal" },
  // { key: "indoor_cricket", label: "Indoor Cricket" },
  // { key: "padel", label: "Padel" },
  // { key: "pickleball", label: "Pickleball" },
] as const;

export const FUTSAL_POSITIONS = [
  "Goalkeeper",
  "Defender",
  "Midfielder",
  "Winger",
  "Striker",
] as const;

export const INDOOR_CRICKET_ROLES = [
  "Batsman",
  "Bowler",
  "All-rounder",
] as const;

export const INDOOR_CRICKET_BOWLING_STYLES = [
  "Fast bowler",
  "Medium pace",
  "Spinner",
] as const;

export const INDOOR_CRICKET_BATTING_STYLES = [
  "Aggressive",
  "Anchor",
] as const;

export const INDOOR_CRICKET_BATTING_ORDER = [
  "Opener",
  "1st - 3rd Down",
  "4th - 6th Down",
  "7th - 8th Down",
] as const;

export const INDOOR_CRICKET_BOWLING_ORDER = [
  "1st Over",
  "2nd - 3rd Over",
  "4th - 5th Over",
] as const;

export const INDOOR_CRICKET_COMPOSITIONS = [
  {
    name: 'Balanced',
    description: 'Standard balanced team',
    positions: { 'Batsman': 3, 'Bowler': 3, 'All-rounder': 2 }
  },
  {
    name: 'Batting Heavy',
    description: 'Extra batting power',
    positions: { 'Batsman': 4, 'Bowler': 2, 'All-rounder': 2 }
  },
  {
    name: 'Bowling Heavy',
    description: 'Strong bowling attack',
    positions: { 'Batsman': 2, 'Bowler': 4, 'All-rounder': 2 }
  },
] as const;


export const PADEL_ROLES = [
  "Aggressive / Front",
  "Defensive / Back",
  "Both",
] as const;

export const PICKLEBALL_ROLES = [
  "Aggressive / Front",
  "Defensive / Back",
  "Both",
] as const;

// --- Zone registration constants ---

// Console platforms
export const CONSOLE_PLATFORMS = [
  { value: "", label: "Select console type" },
  { value: "ps5", label: "PS5" },
  { value: "ps4", label: "PS4" },
  { value: "xbox-series", label: "Xbox Series X|S" },
  { value: "xbox-one", label: "Xbox One" },
  { value: "mixed", label: "Mixed (PS + Xbox)" },
  { value: "other", label: "Other / arcade" },
] as const;

// Futsal court types
export const FUTSAL_COURT_TYPES = [
  { value: "", label: "Select court type" },
  { value: "belgian-turf", label: "Belgian turf" },
  { value: "rubber-turf", label: "Rubber / PVC turf" },
  { value: "hard-court", label: "Hard court (indoor)" },
  { value: "other", label: "Other" },
] as const;

// Indoor cricket surfaces
export const INDOOR_CRICKET_SURFACES = [
  { value: "", label: "Select surface" },
  { value: "belgian-turf", label: "Belgian turf" },
  { value: "blue-multipurpose", label: "Blue multipurpose turf" },
  { value: "cement-matting", label: "Cement wicket + matting" },
  { value: "other", label: "Other" },
] as const;

// Padel court surfaces
export const PADEL_SURFACES = [
  { value: "", label: "Select surface" },
  { value: "blue-turf", label: "Blue padel turf" },
  { value: "red-turf", label: "Red padel turf" },
  { value: "green-turf", label: "Green turf" },
  { value: "indoor", label: "Indoor padel court" },
  { value: "other", label: "Other" },
] as const;

// Pickleball surfaces
export const PICKLEBALL_SURFACES = [
  { value: "", label: "Select surface" },
  { value: "acrylic-hard", label: "Acrylic hard court" },
  { value: "concrete-acrylic", label: "Concrete + acrylic" },
  { value: "asphalt-acrylic", label: "Asphalt + acrylic" },
  { value: "indoor-wood", label: "Indoor wooden court" },
  { value: "multi-sport", label: "Multi-sport court" },
  { value: "other", label: "Other" },
] as const;

// PC Types
export const PC_TYPES = [
  { value: "regular", label: "Regular" },
  { value: "premium", label: "Premium" },
  { value: "elite", label: "Elite" },
] as const;
