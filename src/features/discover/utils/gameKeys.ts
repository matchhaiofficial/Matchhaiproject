import { GameKey } from "../types";

export function normalizeGameKey(input: string | undefined | null): GameKey | null {
    if (!input) return null;

    const normalized = input.toLowerCase().trim();

    // Direct mapping for simple cases
    if (normalized === 'all') return 'all';
    if (normalized === 'cs2') return 'cs2';
    if (normalized === 'cs16' || normalized === 'cs 1.6' || normalized === 'cs1.6' || normalized === 'counter-strike 1.6' || normalized === 'counter strike 1.6') return 'cs16';
    if (normalized === 'valorant' || normalized === 'valo') return 'valorant';
    if (normalized === 'fc25' || normalized === 'fc26') return 'fc26';
    if (normalized === 'tekken8') return 'tekken8';
    // Physical sports are temporarily disabled.
    // if (normalized === 'futsal') return 'futsal';
    // if (normalized === 'padel') return 'padel';
    // if (normalized === 'pickleball') return 'pickleball';

    // Normalizations
    // if (normalized === 'indoorcricket' || normalized === 'indoor_cricket' || normalized === 'cricket') {
    //     return 'indoor_cricket';
    // }

    // Fallback checks (e.g. if input is just "Tekken")
    if (normalized.includes('tekken')) return 'tekken8';
    if (normalized.includes('valorant') || normalized === 'valo') return 'valorant';
    if (normalized.includes('fifa') || normalized.includes('fc2')) return 'fc26'; // catch fc24/25/26
    if ((normalized.includes('1.6') || normalized.includes('1 6')) && (normalized.includes('cs') || normalized.includes('counter'))) return 'cs16';
    if (normalized.includes('cs') || normalized.includes('counter')) return 'cs2';

    return null;
}
