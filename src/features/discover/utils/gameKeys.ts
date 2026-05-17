import { GameKey } from "../types";

export function normalizeGameKey(input: string | undefined | null): GameKey | null {
    if (!input) return null;

    const normalized = input.toLowerCase().trim();
    const compact = normalized.replace(/[\s_-]+/g, "");
    const spaced = normalized.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

    // Direct mapping for simple cases
    if (normalized === 'all') return 'all';
    if (normalized === 'cs2' || normalized === 'counter_strike_2' || normalized === 'counter-strike-2' || spaced === 'counter strike 2') return 'cs2';
    if (normalized === 'cs16' || normalized === 'cs 1.6' || normalized === 'cs1.6' || normalized === 'counter_strike_1_6' || normalized === 'counter-strike 1.6' || normalized === 'counter-strike-1.6' || normalized === 'counter strike 1.6') return 'cs16';
    if (compact === 'cs16' || compact === 'cs1.6' || compact === 'counterstrike16' || compact === 'counterstrike1.6') return 'cs16';
    if (normalized === 'valorant' || normalized === 'valo') return 'valorant';
    if (normalized === 'fc25' || normalized === 'fc26' || normalized === 'fifa' || normalized === 'football' || compact === 'fc26') return 'fc26';
    if (normalized === 'tekken8' || normalized === 'tekken 8' || normalized === 'tekken') return 'tekken8';
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
    if (normalized.includes('fifa') || normalized.includes('football') || normalized.includes('fc2')) return 'fc26'; // catch fc24/25/26
    if ((normalized.includes('1.6') || normalized.includes('1 6')) && (normalized.includes('cs') || normalized.includes('counter'))) return 'cs16';
    if (normalized.includes('cs') || normalized.includes('counter')) return 'cs2';

    return null;
}
