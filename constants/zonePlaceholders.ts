// constants/zonePlaceholders.ts
// Placeholder courts and gaming zones per area; replace with dynamic data later.
export interface AreaZoneListing {
  gamingZones: string[];
  courts: string[];
}

export const AREA_PLACEHOLDERS: Record<string, AreaZoneListing> = {
  "DHA Karachi": {
    gamingZones: ["O2 Esports Lounge", "DHA GameHub"],
    courts: ["DHA Padel Courts", "Creek Club Futsal"],
  },
  Clifton: {
    gamingZones: ["Arena Seaview", "Clifton Esports Cafe"],
    courts: ["Clifton Futsal Arena", "Seaview Padel"],
  },
  "Gulshan-e-Iqbal": {
    gamingZones: ["Gulshan Gaming Lounge", "G2 Esports Cafe"],
    courts: ["NED Futsal Ground", "Gulshan Sports Complex"],
  },
  "Gulistan-e-Johar": {
    gamingZones: ["Johar Gaming Arena", "XP Lounge Johar"],
    courts: ["Johar Futsal Court", "Millennium Sports"],
  },
  Bahadurabad: {
    gamingZones: ["Bahadurabad Esports Lab", "Bahadurabad GamePoint"],
    courts: ["Bahadurabad Futsal", "Bahadurabad Padel"],
  },
  PECHS: {
    gamingZones: ["PECHS Esports Cafe", "PECHS Gaming Studio"],
    courts: ["Hill Park Futsal", "PECHS Sports Arena"],
  },
  "Federal B Area": {
    gamingZones: ["F.B Area Gaming Hub", "Block 10 Esports"],
    courts: ["F.B Area Futsal", "F.B Area Indoor Cricket"],
  },
  Nazimabad: {
    gamingZones: ["Nazimabad Esports Zone", "Nazimabad Gaming Loft"],
    courts: ["Nazimabad Sports Arena", "Nazimabad Futsal"],
  },
  "North Nazimabad": {
    gamingZones: ["North N. Esports", "Block H Gaming"],
    courts: ["North Nazimabad Futsal", "KDA Sports Arena"],
  },
  "North Karachi": {
    gamingZones: ["North Karachi Game Vault", "Sector 11 Esports"],
    courts: ["North Karachi Futsal", "North Karachi Cricket Arena"],
  },
  Korangi: {
    gamingZones: ["Korangi Esports Hub", "Sector 7 Gaming"],
    courts: ["Korangi Sports Complex", "Korangi Futsal Court"],
  },
  Landhi: {
    gamingZones: ["Landhi Gaming Den", "Landhi Esports"],
    courts: ["Landhi Futsal", "Landhi Cricket Nets"],
  },
  Malir: {
    gamingZones: ["Malir Gaming House", "Malir Esports Lounge"],
    courts: ["Malir Cantt Futsal", "Malir Sports Club"],
  },
  "Scheme 33": {
    gamingZones: ["Scheme 33 Esports", "University Road Gaming"],
    courts: ["Scheme 33 Futsal", "Scheme 33 Indoor Cricket"],
  },
  Saddar: {
    gamingZones: ["Saddar Game Arena", "Rainbow Center Esports"],
    courts: ["Saddar Sports Complex", "Empress Market Futsal"],
  },
  Lyari: {
    gamingZones: ["Lyari Gaming Zone", "Lyari Esports Studio"],
    courts: ["Lyari Futsal", "Lyari Football Ground"],
  },
  "Surjani Town": {
    gamingZones: ["Surjani Esports", "Surjani Gaming Lounge"],
    courts: ["Surjani Futsal", "Surjani Sports Arena"],
  },
  "Orangi Town": {
    gamingZones: ["Orangi Gaming Station", "Orangi Esports"],
    courts: ["Orangi Futsal Court", "Orangi Cricket Arena"],
  },
  "Shah Faisal Colony": {
    gamingZones: ["Shah Faisal Gaming", "Colony Esports"],
    courts: ["Shah Faisal Futsal", "Shah Faisal Sports"],
  },
  Garden: {
    gamingZones: ["Garden Gaming Lounge", "Garden Esports"],
    courts: ["Garden Sports Arena", "Garden Futsal"],
  },
  "Defence View": {
    gamingZones: ["Defence View Esports", "Defence View Gaming Room"],
    courts: ["Defence View Futsal", "Defence View Padel"],
  },
  Kharadar: {
    gamingZones: ["Kharadar Gaming Studio", "Kharadar Esports"],
    courts: ["Kharadar Sports", "Kharadar Futsal"],
  },
  "Shahrah-e-Faisal": {
    gamingZones: ["Shahrah Gaming Hub", "Aviation Esports"],
    courts: ["Shahrah Futsal", "Airport Road Padel"],
  },
  "Other (Karachi)": {
    gamingZones: ["Citywide Esports", "Community Gaming Spot"],
    courts: ["Community Futsal", "Local Sports Center"],
  },
};

export const DEFAULT_PLACEHOLDER: AreaZoneListing = {
  gamingZones: ["Partner Esports Lounge", "City Gaming Hub"],
  courts: ["Partner Futsal Court", "Partner Padel Court"],
};
