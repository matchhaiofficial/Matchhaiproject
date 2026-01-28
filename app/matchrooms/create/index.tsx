import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { db } from '../../../src/config/firebaseConfig';
import { useAuth } from '../../../src/context/AuthContext';
import { createMatchroom } from '../../../src/services/matchService';
import { calculateInitialRating, GameKey, getTierFromRating, SkillTier } from '../../../src/services/skillRatingService';
import type { Team } from '../../../src/services/teamService';
import { getUserTeamsForGame } from '../../../src/services/teamService';
import type { UserProfile } from '../../../src/services/userService';
import { getUserProfile } from '../../../src/services/userService';
import type { BookingRequest } from '../../../src/services/zoneService';
import { createBookingRequest } from '../../../src/services/zoneService';
import { COLORS, FONTS } from '../../../src/theme';

import Logger from '../../../src/utils/logger';
import BasicFields from './components/BasicFields';
import BroadcastAreaSelector from './components/BroadcastAreaSelector';
import GameDynamicFields from './components/GameDynamicFields';
import GameSelector from './components/GameSelector';
import LocationModeSelector from './components/LocationModeSelector';
import RoleAutoFill from './components/RoleAutoFill';
import SkillBracketSection from './components/SkillBracketSection';
// import TeamModeSelector from './components/TeamModeSelector';
// import TeamPicker from './components/TeamPicker';
// import SlotReservation from './components/SlotReservation';
import ZonePicker from './components/ZonePicker';
import styles from './create.styles';

export default function CreateMatchroom() {
    const { user } = useAuth();
    const params = useLocalSearchParams<{ zoneId?: string; zoneName?: string; zoneSupportedGames?: string }>();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [selectedGame, setSelectedGame] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [hostRole, setHostRole] = useState<string | null>(null);

    // Skill System State
    const [hostSkillScore, setHostSkillScore] = useState<number | null>(null);
    const [hostSkillTier, setHostSkillTier] = useState<SkillTier | null>(null);
    const [hostSkillAnswers, setHostSkillAnswers] = useState<Record<string, any>>({});

    // Phase 2: Team State
    const [teams, setTeams] = useState<Team[]>([]);
    const [teamMode, setTeamMode] = useState<'solo' | 'team'>('solo');
    const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
    const [reservedSlots, setReservedSlots] = useState(1);

    // Phase 3: Location Mode State
    const [locationMode, setLocationMode] = useState<'zone' | 'broadcast'>('zone');
    const [broadcastAreas, setBroadcastAreas] = useState<string[]>([]);

    // Phase 3: Zone Selection State (pre-fill from params if coming from venue)
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(params.zoneId || null);
    const [selectedZoneName, setSelectedZoneName] = useState<string | null>(params.zoneName || null);

    // Phase 4: CS2 & FC25/26 Specific State
    const [zoneRate, setZoneRate] = useState<number>(0);
    const [ps5Rate, setPs5Rate] = useState<number>(0);
    const [seriesType, setSeriesType] = useState<'BO1' | 'BO3' | 'BO5' | 'BO10' | 'BO7' | 'BO20' | 'BO40'>('BO1');
    const [duration, setDuration] = useState<number>(1); // Duration in hours (for Futsal)

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        maxPlayers: 10,
        pricePerPlayer: 0,
        format: '',
        selectedMaps: [] as string[],
        skillLevel: 'Any',
        playstyle: '',
        rankRequirement: '',
        overs: '',
        sidePreference: '',
        locationMode: 'zone' as 'zone' | 'broadcast',
        date: '',
        time: '',
        favouriteClub: '',
        formation: '',
        tekkenCharacters: [] as string[],
        composition: '',
        battingOrder: '',
        battingStyle: '',
        bowlingStyle: '',
        bowlingOrder: '',
        seriesType: '',
    });

    // Phase 4: Calculate price per player for CS2 & FC25/26 & Futsal matches
    useEffect(() => {
        if (selectedGame === 'cs2' && zoneRate > 0) {
            const hoursMap: Record<string, number> = { BO1: 1, BO3: 3, BO5: 5, BO10: 10 };
            const hours = hoursMap[seriesType] || 1;

            // Price per player is simply the zone rate * hours (assuming rate is per PC/player)
            const pricePerPlayer = zoneRate * hours;
            setFormData(prev => ({ ...prev, pricePerPlayer }));
        } else if ((selectedGame === 'fc26') && ps5Rate > 0) {
            // FC Logic: BO3 = 1hr, BO5 = 2hr, BO10 = 3hr
            const hoursMap: Record<string, number> = { BO1: 0.5, BO3: 1, BO5: 2, BO10: 3 };
            const hours = hoursMap[seriesType] || 1;

            // Calculate Total Cost for the console/setup
            const totalConsoleCost = ps5Rate * hours;

            // Calculate Price Per Player based on Format
            let pricePerPlayer = 0;
            if (formData.format === '1v1') {
                // 1v1 = 2 players sharing the cost (or paying for their share of the console time)
                // Assuming ps5Rate is per console.
                pricePerPlayer = totalConsoleCost / 2;
            } else if (formData.format === '2v2') {
                // 2v2 = 4 players.
                pricePerPlayer = totalConsoleCost / 4;
            } else {
                // Fallback if format not selected yet, assume 1v1
                pricePerPlayer = totalConsoleCost / 2;
            }

            setFormData(prev => ({ ...prev, pricePerPlayer }));
        } else if (selectedGame === 'tekken8' && ps5Rate > 0) {
            // Tekken 8 Logic: BO7 = 1hr, BO20 = 2hr, BO40 = 3hr
            const hoursMap: Record<string, number> = { BO7: 1, BO20: 2, BO40: 3 };
            const hours = hoursMap[seriesType] || 1;

            // Calculate Total Cost for the console/setup
            const totalConsoleCost = ps5Rate * hours;

            // Calculate Price Per Player based on Format
            let pricePerPlayer = 0;
            if (formData.format === '1v1') {
                pricePerPlayer = totalConsoleCost / 2;
            } else if (formData.format === '2v2') {
                pricePerPlayer = totalConsoleCost / 4;
            } else {
                pricePerPlayer = totalConsoleCost / 2;
            }

            setFormData(prev => ({ ...prev, pricePerPlayer }));
        } else if (selectedGame === 'futsal' && zoneRate > 0) {
            // Futsal Logic: Price is per hour for the court.
            // Total Cost = Hourly Rate * Duration
            // Price Per Player = Total Cost / Max Players

            const totalCourtCost = zoneRate * duration;
            const pricePerPlayer = formData.maxPlayers > 0 ? (totalCourtCost / formData.maxPlayers) : 0;

            setFormData(prev => ({ ...prev, pricePerPlayer: Math.ceil(pricePerPlayer) })); // Round up to nearest integer
        } else if (selectedGame === 'indoor_cricket' && zoneRate > 0) {
            // Indoor Cricket Logic:
            // 5 overs (BO3) = 2 hours
            // 6 overs (BO3) = 2.5 hours
            // Price = (Hourly Rate * Duration) / 16 players

            let calcDuration = 2; // Default 2 hours for 5 overs
            if (formData.overs === '6') {
                calcDuration = 2.5;
            }

            const totalCourtCost = zoneRate * calcDuration;
            const pricePerPlayer = formData.maxPlayers > 0 ? (totalCourtCost / formData.maxPlayers) : 0;

            setFormData(prev => ({ ...prev, pricePerPlayer: Math.ceil(pricePerPlayer) }));
        } else if (selectedGame === 'padel' && zoneRate > 0) {
            // Padel Logic: BO3 = 1hr, BO5 = 2hr, BO10 = 3hr
            // Price = (Hourly Rate * Hours) / 4 players
            const hoursMap: Record<string, number> = { BO3: 1, BO5: 2, BO10: 3 };
            const hours = hoursMap[formData.seriesType] || 1;

            const totalCourtCost = zoneRate * hours;
            const pricePerPlayer = totalCourtCost / 4;
            setFormData(prev => ({ ...prev, pricePerPlayer: Math.ceil(pricePerPlayer) }));
        } else if (selectedGame === 'pickleball' && zoneRate > 0) {
            // Pickleball Logic: BO3 = 1hr, BO5 = 2hr, BO10 = 3hr
            const hoursMap: Record<string, number> = { BO3: 1, BO5: 2, BO10: 3 };
            const hours = hoursMap[formData.seriesType] || 1;

            const totalCourtCost = zoneRate * hours;
            const players = formData.format === '2v2' ? 4 : 2;
            const pricePerPlayer = totalCourtCost / players;
            setFormData(prev => ({ ...prev, pricePerPlayer: Math.ceil(pricePerPlayer) }));
        }
    }, [selectedGame, zoneRate, ps5Rate, seriesType, formData.format, duration, formData.maxPlayers, formData.overs, formData.seriesType]);

    // FC26 & Tekken 8 & Futsal & Indoor Cricket & Padel: Update title based on format
    useEffect(() => {
        if (selectedGame === 'fc26' || selectedGame === 'tekken8') {
            if (formData.format === '1v1') {
                setFormData(prev => ({ ...prev, title: '1v1 Competitive', maxPlayers: 2 }));
            } else if (formData.format === '2v2') {
                setFormData(prev => ({ ...prev, title: '2v2 Competitive', maxPlayers: 4 }));
            }
        } else if (selectedGame === 'futsal') {
            if (formData.format === '5v5') {
                setFormData(prev => ({ ...prev, title: '5v5 Futsal Match', maxPlayers: 10, formation: '2-2 (Diamond)' }));
            } else if (formData.format === '6v6') {
                setFormData(prev => ({ ...prev, title: '6v6 Futsal Match', maxPlayers: 12, formation: '2-2-1' }));
            }
        } else if (selectedGame === 'indoor_cricket') {
            if (formData.format === '8-a-side') {
                setFormData(prev => ({ ...prev, title: '8-a-side Indoor Cricket', maxPlayers: 16 }));
            }
        } else if (selectedGame === 'padel') {
            // Padel is always 2v2
            setFormData(prev => ({ ...prev, title: '2v2 Padel Match', maxPlayers: 4, format: '2v2' }));
        } else if (selectedGame === 'pickleball') {
            if (formData.format === '1v1') {
                setFormData(prev => ({ ...prev, title: '1v1 Pickleball Match', maxPlayers: 2 }));
            } else if (formData.format === '2v2') {
                setFormData(prev => ({ ...prev, title: '2v2 Pickleball Match', maxPlayers: 4 }));
            }
        }
    }, [formData.format, selectedGame]);

    useEffect(() => {
        loadUserProfile();
    }, [user]);

    // Reset skill state when game changes
    useEffect(() => {
        setHostSkillScore(null);
        setHostSkillTier(null);
        setHostSkillAnswers({});
    }, [selectedGame]);

    // Check if user has games configured that match the venue's offerings
    useEffect(() => {
        if (!userProfile || !params.zoneSupportedGames) return;

        try {
            const zoneSupportedGames: string[] = JSON.parse(params.zoneSupportedGames);
            if (zoneSupportedGames.length === 0) return;

            // Game labels for display
            const gameLabels: Record<string, string> = {
                'cs2': 'CS2',
                'fc26': 'FC26',
                'tekken8': 'Tekken 8',
                'futsal': 'Futsal',
                'indoor_cricket': 'Indoor Cricket',
                'padel': 'Padel',
                'pickleball': 'Pickleball'
            };

            // Map game keys to profile flags
            const gameToProfileFlag: Record<string, keyof typeof userProfile> = {
                'cs2': 'playsCs2',
                'fc26': 'playsFc',
                'tekken8': 'playsTekken',
                'futsal': 'playsFutsal',
                'indoor_cricket': 'playsIndoorCricket',
                'padel': 'playsPadel',
                'pickleball': 'playsPickleball'
            };

            // Get user's configured games
            const userConfiguredGames = Object.entries(gameToProfileFlag)
                .filter(([game, flag]) => userProfile[flag])
                .map(([game]) => game);

            // Check if user has any of the venue's supported games configured
            const matchingGames = zoneSupportedGames.filter(game => {
                const flagKey = gameToProfileFlag[game];
                return flagKey && userProfile[flagKey];
            });

            if (matchingGames.length === 0) {
                const supportedLabels = zoneSupportedGames.map(g => gameLabels[g] || g).join(', ');
                const userGamesLabels = userConfiguredGames.map(g => gameLabels[g] || g).join(', ');

                // Different message based on whether user has any games at all
                if (userConfiguredGames.length > 0) {
                    // User has games but they don't match venue
                    Alert.alert(
                        'Game Mismatch',
                        `Your games: ${userGamesLabels}\n\nThis venue supports: ${supportedLabels}\n\nTo create a matchroom here, please add one of the venue's supported games to your profile.`,
                        [
                            { text: 'Go Back', style: 'cancel', onPress: () => router.back() },
                            { text: 'Add Game', onPress: () => router.replace('/(player)/(tabs)/profile') }
                        ]
                    );
                } else {
                    // User has no games configured at all
                    Alert.alert(
                        'Add a Game First',
                        `This venue supports: ${supportedLabels}\n\nPlease add one of these games to your profile to create a matchroom here.`,
                        [
                            { text: 'Go Back', style: 'cancel', onPress: () => router.back() },
                            { text: 'Edit Profile', onPress: () => router.replace('/(player)/(tabs)/profile') }
                        ]
                    );
                }
            }
        } catch (e) {
            Logger.error('CreateMatchroom', 'Error parsing zoneSupportedGames', e);
        }
    }, [userProfile, params.zoneSupportedGames]);

    const loadUserProfile = async () => {
        if (!user?.uid) {
            setLoading(false);
            return;
        }

        try {
            const result = await getUserProfile(user.uid);
            if (result.ok) {
                setUserProfile(result.data);
            } else {
                // Profile doesn't exist - user needs to complete registration
                Logger.warn('CreateMatchroom', 'User profile not found - redirecting to registration', result.message);
                Alert.alert(
                    'Profile Not Found',
                    'Please complete your player registration first.',
                    [
                        {
                            text: 'Go to Profile',
                            onPress: () => router.replace('/auth/register')
                        }
                    ]
                );
            }
        } catch (error) {
            Logger.error('CreateMatchroom', 'Error loading profile', error);
            Alert.alert(
                'Error',
                'Could not load your profile. Please try logging in again.',
                [
                    {
                        text: 'OK',
                        onPress: () => router.back()
                    }
                ]
            );
        } finally {
            setLoading(false);
        }
    };

    const handleFieldChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleGameSelect = async (gameKey: string) => {
        setSelectedGame(gameKey);

        // Auto-Initialize Skill Score if missing
        if (user && userProfile && !userProfile.skillScores?.[gameKey as GameKey]) {
            try {
                const { rating, source } = calculateInitialRating(gameKey as GameKey, userProfile);
                const tier = getTierFromRating(rating);

                const newScore = {
                    rating,
                    tier,
                    matchesPlayed: 0,
                    wins: 0,
                    losses: 0,
                    initialSource: source,
                    initialRating: rating,
                    lastMatchDate: null,
                    lastUpdated: new Date() // will be converted to Timestamp by Firestore if directly passed, strictly we use serverTimestamp() for field but here we construct object
                };

                // Update Firestore
                await updateDoc(doc(db, "users", user.uid), {
                    [`skillScores.${gameKey}`]: {
                        ...newScore,
                        lastUpdated: serverTimestamp() // Use server timestamp for DB
                    }
                });

                // Update local state to reflect change immediately (so badge might appear if we showed it)
                setUserProfile(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        skillScores: {
                            ...prev.skillScores,
                            [gameKey as GameKey]: { ...newScore, lastUpdated: new Date() }
                        }
                    };
                });

                Logger.info('CreateMatchroom', `Auto-initialized skill score for ${gameKey}`, { rating, tier });
            } catch (err) {
                Logger.error('CreateMatchroom', 'Failed to auto-init skill score', err);
            }
        }

        // Reset game-specific fields when changing game
        setFormData(prev => ({
            ...prev,
            // Reset game-specific fields to defaults
            format: '',
            selectedMaps: [],
            skillLevel: 'Any',
            playstyle: '',
            rankRequirement: '',
            overs: '',
            sidePreference: '',
            date: '',
            time: '',
            favouriteClub: '',
            formation: '',
            tekkenCharacters: [],
            composition: '',
            battingOrder: '',
            battingStyle: '',
            bowlingStyle: '',
            bowlingOrder: '',
            seriesType: '',
        }));
        setDuration(1); // Reset duration

        // Phase 2: Load teams for this game
        if (user) {
            const result = await getUserTeamsForGame(user.uid, gameKey as any);
            if (result.ok && result.data) {
                setTeams(result.data);
                // Reset team state
                setTeamMode('solo');
                setSelectedTeamId(null);
                setReservedSlots(1);
            }
        }

        // Phase 4: Enforce CS2 Rules
        if (gameKey === 'cs2') {
            console.log('[CS2 Auto-fill] UserProfile:', userProfile);
            console.log('[CS2 Auto-fill] FACEIT Skill Level:', userProfile?.faceitSkillLevel);

            // Map FACEIT skill level to band
            let skillLevel = 'Any';
            if (userProfile?.faceitSkillLevel) {
                const level = userProfile.faceitSkillLevel;
                console.log('[CS2 Auto-fill] Mapping level:', level);
                if (level >= 1 && level <= 3) {
                    skillLevel = 'FACEIT 1-3';
                } else if (level >= 4 && level <= 6) {
                    skillLevel = 'FACEIT 4-6';
                } else if (level >= 7 && level <= 10) {
                    skillLevel = 'FACEIT 7-10';
                }
            }
            console.log('[CS2 Auto-fill] Setting skill level to:', skillLevel);

            setFormData(prev => ({
                ...prev,
                title: '5v5 Competitive', // Default title
                format: '5v5',
                maxPlayers: 10,
                skillLevel: skillLevel,
            }));
            // Initialize host role from profile
            if (userProfile?.cs2Role) {
                setHostRole(userProfile.cs2Role);
            } else {
                setHostRole(null);
            }
        } else if (gameKey === 'fc26') {
            // FC26 Defaults
            setFormData(prev => ({
                ...prev,
                title: '1v1 Competitive',
                format: '1v1',
                maxPlayers: 2, // 1v1 = 2 players total
                favouriteClub: userProfile?.fcTeam || '',
                formation: userProfile?.fcFormation || '',
            }));
            setSeriesType('BO3'); // Default to BO3 for FC
            setHostRole(null);
        } else if (gameKey === 'tekken8') {
            // Tekken 8 Defaults
            setFormData(prev => ({
                ...prev,
                title: '1v1 Competitive',
                format: '1v1',
                maxPlayers: 2,
                tekkenCharacters: userProfile?.tekkenFavorites || [],
                skillLevel: 'Any', // Will be updated by SkillBracketSection
            }));
            setSeriesType('BO7'); // Default to BO7 for Tekken
            setHostRole(null);
        } else if (gameKey === 'futsal') {
            // Futsal Defaults
            setFormData(prev => ({
                ...prev,
                title: '5v5 Futsal Match',
                format: '5v5',
                maxPlayers: 10,
                formation: '2-2 (Diamond)', // Default formation for 5v5
            }));
            setDuration(1); // Default to 1 hour
            setHostRole(null);
        } else if (gameKey === 'indoor_cricket') {
            // Indoor Cricket Defaults
            setFormData(prev => ({
                ...prev,
                title: '8v8 competitive',
                format: '8-a-side',
                maxPlayers: 16,
                overs: '5', // Default to 5 overs
                composition: 'Balanced',
            }));
            setSeriesType('BO3'); // Default/Only option
            setHostRole(userProfile?.indoorCricketRole || null);
        } else if (gameKey === 'padel') {
            // Padel Defaults - Always 2v2, with series type
            setFormData(prev => ({
                ...prev,
                title: '2v2 Padel Match',
                format: '2v2',
                maxPlayers: 4,
                seriesType: 'BO3', // Default to BO3 (1 hour)
            }));
            setDuration(1); // Default to 1 hour (BO3)
            setHostRole(userProfile?.padelRole || null);
        } else if (gameKey === 'pickleball') {
            // Pickleball Defaults
            setFormData(prev => ({
                ...prev,
                title: '1v1 Pickleball Match',
                format: '1v1',
                maxPlayers: 2,
                seriesType: 'BO3', // Default to BO3 (1 hour)
            }));
            setDuration(1);
            setHostRole(null);
        } else {
            setHostRole(null);
        }
    };

    const validateForm = () => {
        if (!selectedGame) {
            Alert.alert('Missing Game', 'Please select a game/sport');
            return false;
        }
        if (!formData.title?.trim()) {
            Alert.alert('Missing Title', 'Please enter a match title');
            return false;
        }
        if (!formData.maxPlayers || formData.maxPlayers < 2) {
            Alert.alert('Invalid Players', 'Please enter a valid number of players (minimum 2)');
            return false;
        }
        if (!formData.format) {
            Alert.alert('Missing Format', 'Please select a match format');
            Alert.alert('Missing Format', 'Please select a match format');
            return false;
        }
        if (!formData.date || !formData.time) {
            Alert.alert('Missing Date/Time', 'Please enter date and time');
            return false;
        }
        // Phase 3: Zone validation
        if (locationMode === 'zone' && !selectedZoneId) {
            Alert.alert('Missing Zone', 'Please select a zone to host the match');
            return false;
        }
        // Phase 3: Broadcast validation
        if (locationMode === 'broadcast' && broadcastAreas.length === 0 && (!userProfile?.areasPreferred || userProfile.areasPreferred.length === 0)) {
            Alert.alert('Missing Areas', 'Please select at least one area for broadcast');
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm() || !user || !userProfile) return;

        setSubmitting(true);
        try {
            // Phase 3: If broadcast mode, create booking request instead of matchroom
            if (locationMode === 'broadcast') {
                const requestData: Omit<BookingRequest, 'id' | 'createdAt' | 'status'> = {
                    userId: user.uid,
                    userName: userProfile.displayName || userProfile.username || 'Player',
                    gameKey: selectedGame!,
                    title: formData.title.trim(),
                    description: formData.description?.trim() || '',
                    maxPlayers: formData.maxPlayers,
                    format: formData.format,
                    selectedMaps: formData.selectedMaps || [],

                    // Skill Info
                    skillLevel: formData.skillLevel || 'Any',
                    hostSkillScore: hostSkillScore ?? null,
                    hostSkillTier: hostSkillTier ?? 'Any',
                    hostSkillContext: {
                        gameKey: selectedGame!,
                        answers: hostSkillAnswers || {},
                    },

                    teamMode: teamMode,
                    teamId: teamMode === 'team' ? (selectedTeamId || null) : null,
                    reservedSlots: teamMode === 'team' ? reservedSlots : 1,
                    preferredAreas: broadcastAreas.length > 0 ? broadcastAreas : (userProfile.areasPreferred || []),
                    budgetPerPlayer: formData.pricePerPlayer || 0,
                    currency: 'PKR',
                    // TODO: Add date/time to BookingRequest interface if needed, or put in description
                };

                const result = await createBookingRequest(requestData);

                if (result.ok) {
                    Alert.alert(
                        'Broadcast Sent!',
                        'Zone admins in your preferred areas will send you offers. Check "My Requests" to view offers.',
                        [{ text: 'OK', onPress: () => router.back() }]
                    );
                } else {
                    Alert.alert('Error', result.message || 'Failed to create request');
                }
                setSubmitting(false);
                return;
            }

            // Phase 1 & 2: Normal matchroom creation (zone mode)
            const matchroomData = {
                hostUid: user.uid,
                hostName: userProfile.username || userProfile.displayName || 'Player',
                game: selectedGame!,
                title: formData.title.trim(),
                description: formData.description?.trim() || '',
                maxPlayers: formData.maxPlayers,
                pricing: {
                    perPlayer: formData.pricePerPlayer || 0,
                    currency: 'PKR',
                },
                scheduledDate: formData.date,
                scheduledTime: formData.time,
                durationMinutes: (() => {
                    if (selectedGame === 'futsal') return duration * 60;
                    if (selectedGame === 'indoor_cricket') {
                        if (formData.overs === '6') return 2.5 * 60; // 6 overs = 2.5h
                        return 2 * 60; // 5 overs = 2h
                    }
                    if (selectedGame === 'cs2') {
                        if (seriesType === 'BO1') return 60;
                        if (seriesType === 'BO3') return 180;
                        if (seriesType === 'BO5') return 300;
                        if (seriesType === 'BO10') return 600;
                    }
                    if (selectedGame === 'fc26') {
                        if (seriesType === 'BO1') return 30;
                        if (seriesType === 'BO3') return 60;
                        if (seriesType === 'BO5') return 120;
                        if (seriesType === 'BO10') return 180;
                    }
                    if (selectedGame === 'tekken8') {
                        if (seriesType === 'BO7') return 60;
                        if (seriesType === 'BO20') return 120;
                        if (seriesType === 'BO40') return 180;
                    }
                    if (selectedGame === 'padel' || selectedGame === 'pickleball') {
                        if (formData.seriesType === 'BO5') return 120;
                        if (formData.seriesType === 'BO10') return 180;
                        return 60; // Default BO3 = 1h
                    }
                    return 60; // Fallback default
                })(),

                // Tekken characters
                tekkenCharacters: selectedGame === 'tekken8' ? formData.tekkenCharacters : undefined,

                // Game-specific fields
                format: (selectedGame === 'cs2' || selectedGame === 'fc26' || selectedGame === 'tekken8')
                    ? `${formData.format} (${seriesType})`
                    : (selectedGame === 'futsal'
                        ? `${formData.format} (${duration}h)`
                        : (selectedGame === 'indoor_cricket'
                            ? `${formData.format} (${formData.overs} overs)`
                            : formData.format)),
                selectedMaps: formData.selectedMaps || [],

                // Skill System
                skillLevel: hostSkillTier || formData.skillLevel || 'Any',
                hostSkillScore: hostSkillScore ?? null,
                hostSkillTier: hostSkillTier ?? 'Any',
                hostSkillContext: {
                    gameKey: selectedGame,
                    answers: hostSkillAnswers || {},
                },
                hostRole: (() => {
                    const game = selectedGame?.toLowerCase();
                    if (game === 'cs2') return userProfile.cs2Role || 'Flex';
                    if (game === 'fc26' || game === 'fc25') return userProfile.fcTeam || 'Flex';
                    if (game === 'tekken8') return userProfile.tekkenFavorites?.[0] || 'Flex';
                    if (game === 'futsal') return userProfile.futsalPosition || 'Flex';
                    if (game === 'indoor_cricket') return userProfile.indoorCricketRole || 'Flex';
                    return 'Flex';
                })(),

                playstyle: formData.playstyle || null,
                rankRequirement: formData.rankRequirement || null,
                overs: formData.overs || null,
                sidePreference: formData.sidePreference || null,
                composition: selectedGame === 'indoor_cricket' ? formData.composition : null,
                battingOrder: selectedGame === 'indoor_cricket' ? formData.battingOrder : null,
                battingStyle: selectedGame === 'indoor_cricket' ? formData.battingStyle : null,
                bowlingStyle: selectedGame === 'indoor_cricket' ? formData.bowlingStyle : null,
                bowlingOrder: selectedGame === 'indoor_cricket' ? formData.bowlingOrder : null,

                // Location (Phase 1: zone only)
                locationMode: 'zone' as const,
                location: selectedZoneName || 'TBD',
                zoneId: selectedZoneId || undefined,

                // Team fields (Phase 2)
                teamMode: teamMode,
                teamId: teamMode === 'team' ? (selectedTeamId || null) : null,
                teamName: teamMode === 'team' ? (teams.find((t: Team) => t.id === selectedTeamId)?.name || null) : null,
                reservedSlots: teamMode === 'team' ? reservedSlots : 1,
                assignedTeamMembers: (teamMode === 'team' && selectedTeamId) ?
                    (teams.find((t: Team) => t.id === selectedTeamId)?.memberUids || []).slice(0, reservedSlots).map((uid: string) => ({
                        uid,
                        username: 'Team Member', // TODO: Fetch actual usernames
                    })) : [],

                // Required roles (optional)
                requiredRoles: [],
            };

            // Helper to remove undefined values
            const sanitizeData = (data: any) => {
                const cleaned: any = {};
                Object.keys(data).forEach(key => {
                    const value = data[key];
                    if (value !== undefined) {
                        cleaned[key] = value;
                    }
                });
                return cleaned;
            };

            const result = await createMatchroom(sanitizeData(matchroomData) as any);

            if (result.ok) {
                Alert.alert(
                    'Success!',
                    'Your matchroom has been created',
                    [
                        {
                            text: 'View Match',
                            onPress: () => router.replace(`/matchrooms/${result.id}`),
                        },
                    ]
                );
            } else {
                Alert.alert('Error', result.message || 'Failed to create matchroom');
            }
        } catch (error) {
            Logger.error('CreateMatchroom', 'Error creating matchroom', error);
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.screen}>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={COLORS.accent} />
                </View>
            </SafeAreaView>
        );
    }

    const canSubmit = (
        selectedGame &&
        formData.title &&
        (locationMode === 'broadcast' || selectedZoneId)
    );

    return (
        <SafeAreaView style={styles.screen}>
            <KeyboardAvoidingView
                style={styles.flex1}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Pressable onPress={() => router.back()} style={styles.marginBottom8}>
                            <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
                        </Pressable>
                        <Text style={styles.headerTitle}>Create Matchroom</Text>
                        <Text style={styles.headerSubtitle}>
                            Set up your match and invite players
                        </Text>
                    </View>

                    {/* Game Selector */}
                    <GameSelector selectedGame={selectedGame} onSelectGame={handleGameSelect} userProfile={userProfile} />

                    {selectedGame && (
                        <>
                            {/* Profile Auto-fill */}
                            <RoleAutoFill
                                gameKey={selectedGame}
                                profile={userProfile}
                                selectedRole={hostRole}
                                onRoleChange={setHostRole}
                                formData={formData}
                                onChange={handleFieldChange}
                            />

                            {/* Basic Fields */}
                            <BasicFields
                                formData={formData}
                                onChange={handleFieldChange}
                                selectedGame={selectedGame || undefined}
                            />

                            {/* Game-Specific Dynamic Fields */}
                            <GameDynamicFields
                                gameKey={selectedGame}
                                formData={formData}
                                onChange={(field, value) => {
                                    setFormData(prev => ({ ...prev, [field]: value }));
                                }}
                            />

                            {/* Skill Bracket Section (New) */}
                            <SkillBracketSection
                                gameKey={selectedGame}
                                userProfile={userProfile}
                                valueScore={hostSkillScore}
                                valueTier={hostSkillTier}
                                onChange={({ score, tier }) => {
                                    setHostSkillScore(score);
                                    setHostSkillTier(tier as any); // Cast if needed
                                    // Also update older formData field for compatibility if needed
                                    setFormData(prev => ({
                                        ...prev,
                                        skillLevel: (tier as string) || 'Any',
                                    }));
                                }}
                            />

                            {/* Phase 3: Location Mode Selector */}
                            <LocationModeSelector
                                locationMode={locationMode}
                                onModeChange={setLocationMode}
                            />

                            {/* Zone Picker (Specific Zone Mode) */}
                            {locationMode === 'zone' && (
                                <>
                                    <ZonePicker
                                        gameKey={selectedGame}
                                        selectedZoneId={selectedZoneId}
                                        onZoneSelect={(zoneId, zoneName, hourlyRate, ps5HourlyRate) => {
                                            setSelectedZoneId(zoneId);
                                            setSelectedZoneName(zoneName);
                                            setZoneRate(hourlyRate);
                                            setPs5Rate(ps5HourlyRate || 0);
                                        }}
                                        userPreferredAreas={userProfile?.areasPreferred}
                                    />

                                    {/* Series Type Selector (CS2 & FC & Tekken) */}
                                    {(selectedGame === 'cs2' || selectedGame === 'fc26' || selectedGame === 'tekken8') && selectedZoneId && (
                                        <View style={styles.section}>
                                            <Text style={styles.sectionLabel}>Series Type</Text>
                                            <View style={[styles.row, styles.gap8]}>
                                                {(selectedGame === 'cs2'
                                                    ? ['BO1', 'BO3', 'BO5'] as const
                                                    : selectedGame === 'tekken8'
                                                        ? ['BO7', 'BO20', 'BO40'] as const
                                                        : ['BO3', 'BO5', 'BO10'] as const).map((type) => (
                                                            <Pressable
                                                                key={type}
                                                                style={({ pressed }) => [
                                                                    styles.optionChip,
                                                                    seriesType === type && styles.optionChipActive,
                                                                    { flex: 1, alignItems: 'center', justifyContent: 'center' },
                                                                    pressed && { opacity: 0.9 }
                                                                ]}
                                                                onPress={() => setSeriesType(type)}
                                                                android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
                                                            >
                                                                <Text
                                                                    style={[
                                                                        styles.optionChipText,
                                                                        seriesType === type && styles.optionChipTextActive
                                                                    ]}
                                                                >
                                                                    {type === 'BO1' ? 'Best of 1' : type === 'BO3' ? 'Best of 3' : type === 'BO5' ? 'Best of 5' : type === 'BO10' ? 'Best of 10' : type === 'BO7' ? 'Best of 7' : type === 'BO20' ? 'Best of 20' : 'Best of 40'}
                                                                </Text>
                                                            </Pressable>
                                                        ))}
                                            </View>
                                            <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 8 }}>
                                                {selectedGame === 'cs2'
                                                    ? `Est.Duration: ${seriesType === 'BO1' ? '1 hr' : seriesType === 'BO3' ? '3 hrs' : '5 hrs'} `
                                                    : selectedGame === 'tekken8'
                                                        ? `Booking Duration: ${seriesType === 'BO7' ? '1 hr' : seriesType === 'BO20' ? '2 hrs' : '3 hrs'} `
                                                        : `Booking Duration: ${seriesType === 'BO3' ? '1 hr' : seriesType === 'BO5' ? '2 hrs' : '3 hrs'} `
                                                }
                                            </Text>
                                        </View>
                                    )}

                                    {/* Booking Duration Selector (Futsal) */}
                                    {selectedGame === 'futsal' && selectedZoneId && (
                                        <View style={styles.section}>
                                            <Text style={styles.sectionLabel}>Booking Duration</Text>
                                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                                {[1, 1.5, 2].map((d) => (
                                                    <Pressable
                                                        key={d}
                                                        style={({ pressed }) => [
                                                            styles.optionChip,
                                                            duration === d && styles.optionChipActive,
                                                            { flex: 1, alignItems: 'center', justifyContent: 'center' },
                                                            pressed && { opacity: 0.9 }
                                                        ]}
                                                        onPress={() => setDuration(d)}
                                                        android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.optionChipText,
                                                                duration === d && styles.optionChipTextActive
                                                            ]}
                                                        >
                                                            {d} Hour{d > 1 ? 's' : ''}
                                                        </Text>
                                                    </Pressable>
                                                ))}
                                            </View>
                                            <Text style={[styles.helperText, styles.marginTop8]}>
                                                Standard match lengths ensure competitive balance and fair play.
                                            </Text>
                                        </View>
                                    )}
                                </>
                            )}

                            {/* Phase 3: Broadcast Area Selector */}
                            {locationMode === 'broadcast' && (
                                <BroadcastAreaSelector
                                    profile={userProfile}
                                    selectedAreas={broadcastAreas}
                                    onAreasChange={setBroadcastAreas}
                                />
                            )}

                            {/* Series Type (Padel & Pickleball) */}
                            {(selectedGame === 'padel' || selectedGame === 'pickleball') && (
                                <View style={styles.section}>
                                    <Text style={styles.sectionLabel}>Series Type</Text>
                                    <View style={styles.chipRow}>
                                        {['BO3', 'BO5', 'BO10'].map((series) => {
                                            const isActive = formData.seriesType === series;
                                            const labels: Record<string, string> = { BO3: 'Best of 3', BO5: 'Best of 5', BO10: 'Best of 10' };
                                            return (
                                                <TouchableOpacity
                                                    key={series}
                                                    style={[styles.optionChip, isActive && styles.optionChipActive]}
                                                    onPress={() => handleFieldChange('seriesType', series)}
                                                >
                                                    <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>
                                                        {labels[series] || series}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                    {formData.seriesType && (
                                        <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 8 }}>
                                            Estimated Hours: {formData.seriesType === 'BO3' ? 1 : (formData.seriesType === 'BO5' ? 2 : 3)} hour{formData.seriesType !== 'BO3' ? 's' : ''}
                                        </Text>
                                    )}
                                </View>
                            )}

                            {/* Price Per Player */}
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>Price Per Player (₨)</Text>
                                <View style={[styles.inputBox, { flexDirection: 'row', alignItems: 'center' }]}>
                                    <TextInput
                                        style={[styles.input, { flex: 1 }, (selectedGame === 'cs2' || selectedGame === 'fc26' || selectedGame === 'tekken8' || selectedGame === 'futsal' || selectedGame === 'indoorCricket' || selectedGame === 'padel' || selectedGame === 'pickleball') && { color: COLORS.muted }]}
                                        placeholder="e.g., 500 (or leave empty for free)"
                                        placeholderTextColor="#757575"
                                        value={formData.pricePerPlayer ? String(formData.pricePerPlayer) : ''}
                                        onChangeText={(text: string) => handleFieldChange('pricePerPlayer', text ? parseInt(text, 10) : '')}
                                        keyboardType="number-pad"
                                        editable={
                                            selectedGame !== 'cs2' &&
                                            selectedGame !== 'fc26' &&
                                            selectedGame !== 'tekken8' &&
                                            selectedGame !== 'futsal' &&
                                            selectedGame !== 'indoorCricket' &&
                                            selectedGame !== 'padel' &&
                                            selectedGame !== 'pickleball'
                                        }
                                    />
                                    {(selectedGame === 'cs2' || selectedGame === 'fc26' || selectedGame === 'tekken8' || selectedGame === 'futsal' || selectedGame === 'indoorCricket' || selectedGame === 'padel' || selectedGame === 'pickleball') && (
                                        <MaterialIcons name="lock" size={16} color={COLORS.muted} style={{ marginLeft: 8 }} />
                                    )}
                                </View>
                                {(selectedGame === 'futsal' || selectedGame === 'indoorCricket') && (
                                    <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 4, marginLeft: 4 }}>
                                        Calculated based on zone rate & duration
                                    </Text>
                                )}
                                {(selectedGame === 'cs2' || selectedGame === 'fc26' || selectedGame === 'tekken8' || selectedGame === 'padel' || selectedGame === 'pickleball') && (
                                    <>
                                        <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 4, marginLeft: 4 }}>
                                            Calculated based on zone rate & series type
                                            <MaterialIcons name="lock" size={16} color={COLORS.muted} style={styles.marginLeft8} />
                                        </Text>
                                        <Text style={[styles.helperTextTiny, styles.marginTop4, styles.marginLeft4, { color: COLORS.accent }]}>
                                            Matches at this level are restricted to verified, high-trust players only.
                                        </Text>
                                        <View style={[styles.infoBox, { marginTop: 12, backgroundColor: COLORS.accent + '10' }]}>
                                            <Text style={[styles.infoBoxText, { color: COLORS.text, fontSize: 13 }]}>
                                                <MaterialIcons name="verified-user" size={16} color={COLORS.accent} />
                                                {'\u00A0'}CS2 competitive lobbies require <Text style={{ fontWeight: 'bold' }}>Prime Status</Text> or a verified <Text style={{ fontWeight: 'bold' }}>FACEIT</Text> profile.
                                            </Text>
                                        </View>
                                    </>
                                )}
                            </View>

                            {/* Submit Button */}
                            <View style={styles.buttonWrapper}>
                                {/* CS2 Summary Line */}
                                {selectedGame === 'cs2' && formData.format && (
                                    <View style={{ marginBottom: 16, padding: 12, backgroundColor: 'rgba(66, 165, 245, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(66, 165, 245, 0.3)' }}>
                                        <Text style={{ color: COLORS.text, fontSize: 13, fontFamily: FONTS.interMedium, lineHeight: 18 }}>
                                            {'Hosting CS2 5v5 in '}
                                            <Text style={{ color: COLORS.accent }}>
                                                {locationMode === 'broadcast'
                                                    ? `${broadcastAreas.length > 0 ? broadcastAreas.join(', ') : (userProfile?.areasPreferred?.join(', ') || 'preferred areas')} `
                                                    : (selectedZoneName || 'selected zone')}
                                            </Text>
                                            {' · '}
                                            <Text style={{ color: COLORS.accent }}>
                                                {hostSkillTier || formData.skillLevel || 'Any skill'}
                                            </Text>
                                            {formData.selectedMaps && formData.selectedMaps.length > 0 && (
                                                <>
                                                    {' · '}
                                                    <Text style={{ color: COLORS.accent }}>
                                                        {formData.selectedMaps.join(', ')}
                                                    </Text>
                                                </>
                                            )}
                                        </Text>
                                    </View>
                                )}

                                {/* Tekken 8 Summary Line */}
                                {selectedGame === 'tekken8' && formData.format && (
                                    <View
                                        style={{
                                            marginBottom: 16,
                                            padding: 12,
                                            backgroundColor: 'rgba(244, 143, 177, 0.08)',
                                            borderRadius: 8,
                                            borderWidth: 1,
                                            borderColor: 'rgba(244, 143, 177, 0.3)',
                                        }}
                                    >
                                        <Text
                                            style={{
                                                color: COLORS.text,
                                                fontSize: 13,
                                                fontFamily: FONTS.interMedium,
                                                lineHeight: 18,
                                            }}
                                        >
                                            {'Hosting Tekken 8 '}
                                            <Text style={{ color: COLORS.accent }}>
                                                {formData.format || '1v1'}
                                            </Text>
                                            {' in '}
                                            <Text style={{ color: COLORS.accent }}>
                                                {locationMode === 'broadcast'
                                                    ? (broadcastAreas.length > 0
                                                        ? broadcastAreas.join(', ')
                                                        : (userProfile?.areasPreferred?.join(', ') || 'preferred areas'))
                                                    : (selectedZoneName || 'selected zone')}
                                            </Text>
                                            {' · '}
                                            <Text style={{ color: COLORS.accent }}>
                                                {hostSkillTier || formData.skillLevel || 'Any bracket'}
                                            </Text>
                                            {Array.isArray(formData.tekkenCharacters) &&
                                                formData.tekkenCharacters.length > 0 && (
                                                    <>
                                                        {' · '}
                                                        <Text style={{ color: COLORS.accent }}>
                                                            {formData.tekkenCharacters.join(', ')}
                                                        </Text>
                                                    </>
                                                )}
                                        </Text>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={[styles.primaryButton, !canSubmit && styles.primaryButtonDisabled]}
                                    onPress={handleSubmit}
                                    disabled={!canSubmit || submitting}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={styles.primaryButtonText}>
                                            {locationMode === 'broadcast' ? 'Send Broadcast' : 'Create Matchroom'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
