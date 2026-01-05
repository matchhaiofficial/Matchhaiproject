import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { db } from "../../../src/config/firebaseConfig";
import { useAuth } from "../../../src/context/AuthContext";
import { fetchOnboardingSummary } from "../../../src/services/userService";
import { COLORS } from "../../../src/theme";
import styles from "./_dashboard.styles";

export default function PlayerDashboard() {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [tags, setTags] = useState<string[]>([]);
    const [notificationCount, setNotificationCount] = useState(0);

    useEffect(() => {
        loadTags();
    }, []);

    // Real-time notification count listener
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "notifications"),
            where("toUid", "==", user.uid),
            where("status", "==", "pending")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setNotificationCount(snapshot.size);
        });

        return () => unsubscribe();
    }, [user]);

    const loadTags = async () => {
        const res = await fetchOnboardingSummary();
        if (res.ok) {
            const t: string[] = [];
            if (res.data.playsCs2) t.push("CS2");
            if (res.data.playsFc) t.push("FC25");
            if (res.data.playsTekken) t.push("Tekken 8");
            setTags(t);
        }
    };

    const QuickAction = ({ icon, label, onPress, color, shadowColor }: any) => (
        <TouchableOpacity
            style={[
                styles.quickActionBtn,
                { borderColor: color + '40', shadowColor: shadowColor || color }
            ]}
            onPress={onPress}
        >
            <View style={[styles.quickActionIconContainer, { backgroundColor: color + '15' }]}>
                <MaterialIcons name={icon} size={28} color={color} />
            </View>
            <Text style={styles.quickActionText}>{label}</Text>
        </TouchableOpacity>
    );

    const NotificationCard = ({ icon, message, time, color }: any) => (
        <View style={[styles.notificationCard, { borderLeftColor: color, borderLeftWidth: 3 }]}>
            <View style={[styles.notificationIconBox, { backgroundColor: color + '10', borderColor: color + '30' }]}>
                <MaterialIcons name={icon} size={20} color={color} />
            </View>
            <View style={styles.notificationContent}>
                <Text style={styles.notificationText} numberOfLines={2}>
                    {message}
                </Text>
                <Text style={styles.notificationTime}>{time}</Text>
            </View>
        </View>
    );

    const NearbyCard = ({ game, title, distance, time, price, roles }: any) => {
        const displayRoles = roles ? roles.slice(0, 2) : []; // Max 2 roles
        const remainingRoles = roles && roles.length > 2 ? roles.length - 2 : 0;

        return (
            <TouchableOpacity
                style={styles.nearbyCard}
                onPress={() => router.push("/(player)/(tabs)/matchrooms")}
                activeOpacity={0.7}
            >
                {/* Row 1: Game Name Only */}
                <Text style={styles.nearbyGame}>{game}</Text>

                {/* Row 2: Title & Book Slot Button */}
                <View style={styles.nearbyTitleRow}>
                    <Text style={styles.nearbyTitle}>{title}</Text>
                    <TouchableOpacity style={styles.bookSlotBtn}>
                        <Text style={styles.bookSlotText}>Book Slot</Text>
                    </TouchableOpacity>
                </View>

                {/* Row 3: Distance & Time */}
                <View style={styles.nearbyInfoRow}>
                    <View style={styles.nearbyDistance}>
                        <MaterialIcons name="location-on" size={12} color={COLORS.textSecondary} />
                        <Text style={styles.nearbyDistanceText}>{distance}</Text>
                    </View>
                    <View style={styles.nearbyTime}>
                        <MaterialIcons name="schedule" size={12} color={COLORS.textSecondary} />
                        <Text style={styles.nearbyTimeText}>{time}</Text>
                    </View>
                </View>

                {/* Row 4: Roles & Price */}
                <View style={styles.nearbyBottomRow}>
                    <View style={styles.roleRow}>
                        {displayRoles.map((role: string, index: number) => (
                            <View key={index} style={styles.roleTag}>
                                <Text style={styles.roleText}>{role}</Text>
                            </View>
                        ))}
                        {remainingRoles > 0 && (
                            <Text style={styles.moreRolesText}>+{remainingRoles}</Text>
                        )}
                    </View>
                    <View style={styles.priceTag}>
                        <Text style={styles.priceTagText}>₨ {price}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const RecommendedCard = ({ game, title, matchScore, price }: any) => (
        <TouchableOpacity
            style={styles.recommendedCard}
            onPress={() => router.push("/(player)/(tabs)/matchrooms")}
            activeOpacity={0.7}
        >
            <View style={styles.recommendedHeader}>
                <Text style={styles.recommendedGame}>{game}</Text>
                <View style={styles.matchScoreBadge}>
                    <MaterialIcons name="local-fire-department" size={12} color="#FFF" />
                    <Text style={styles.matchScoreText}>{matchScore}%</Text>
                </View>
            </View>
            <Text style={styles.recommendedTitle} numberOfLines={2}>{title}</Text>
            <View style={styles.recommendedFooter}>
                <View style={styles.priceTag}>
                    <Text style={styles.priceTagText}>₨ {price}</Text>
                </View>
                <MaterialIcons name="arrow-forward" size={18} color={COLORS.accent} />
            </View>
        </TouchableOpacity>
    );

    const UpcomingCard = ({ game, title, time, players }: any) => (
        <View style={styles.upcomingCard}>
            <View style={styles.upcomingLeft}>
                <View style={styles.upcomingTimeBox}>
                    <Text style={styles.upcomingTimeBig}>{time.split(' ')[0]}</Text>
                    <Text style={styles.upcomingTimeSmall}>{time.split(' ')[1]}</Text>
                </View>
                <View style={styles.upcomingVerticalLine} />
                <View>
                    <Text style={styles.upcomingGame}>{game}</Text>
                    <Text style={styles.upcomingTitle}>{title}</Text>
                    <Text style={styles.upcomingPlayers}>{players}</Text>
                </View>
            </View>
            <TouchableOpacity style={styles.bookSlotBtn}>
                <Text style={styles.bookSlotText}>Book Slot</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.screen}>
            <ScrollView
                contentContainerStyle={[styles.container, { paddingBottom: 100 + insets.bottom }]}
                showsVerticalScrollIndicator={false}
            >

                {/* 🔥 TOP SECTION: Personalized Header */}
                <View style={styles.header}>
                    <View style={styles.headerTopRow}>
                        <View style={styles.avatarContainer}>
                            <Image
                                source={{
                                    uri: user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || "Player"}&background=42a5f5&color=fff&size=112`
                                }}
                                style={styles.avatar}
                            />
                            <View style={styles.onlineIndicator} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.welcomeText}>PLAYER DASHBOARD</Text>
                            <Text style={styles.username}>{user?.displayName || "Guest"}</Text>
                        </View>
                        <TouchableOpacity style={styles.notificationBell} onPress={() => router.push("/(player)/inbox")}>
                            <MaterialIcons name="notifications-none" size={24} color={COLORS.text} />
                            {notificationCount > 0 && (
                                <View style={{
                                    position: 'absolute',
                                    top: -4,
                                    right: -6,
                                    backgroundColor: COLORS.error,
                                    borderRadius: 10,
                                    minWidth: 20,
                                    height: 20,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingHorizontal: 4,
                                    borderWidth: 2,
                                    borderColor: COLORS.background
                                }}>
                                    <Text style={{
                                        color: '#FFF',
                                        fontSize: 11,
                                        fontWeight: '700'
                                    }}>
                                        {notificationCount > 9 ? '9+' : notificationCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                    <View style={styles.tagsRow}>
                        {tags.length > 0 ? tags.map((tag, i) => (
                            <View key={i} style={styles.tag}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </View>
                        )) : null}
                    </View>
                </View>

                {/* 📍 SECTION 1: Quick Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.quickActionsGrid}>
                        <QuickAction
                            icon="add-circle"
                            label="Create Room"
                            color={COLORS.accent}
                            onPress={() => router.push("/matchrooms/create" as any)}
                        />
                        <QuickAction
                            icon="search"
                            label="Find Match"
                            color={COLORS.successBright}
                            onPress={() => router.push("/(player)/(tabs)/matchrooms" as any)}
                        />
                        <QuickAction
                            icon="people"
                            label="Find Players"
                            color={COLORS.warning}
                            onPress={() => router.push("/(player)/(tabs)/find-players")}
                        />
                        <QuickAction
                            icon="groups"
                            label="My Teams"
                            color="#AB47BC" // Purple
                            onPress={() => router.push("/(player)/(tabs)/teams")}
                        />
                    </View>
                </View>

                {/* 🔔 SECTION 2: Notifications (Simplified) */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Latest Alerts</Text>
                    </View>
                    <NotificationCard
                        icon="person-add"
                        message="New join request for CS2 @ NukeTown"
                        time="2m ago"
                        color={COLORS.accent}
                    />
                    <NotificationCard
                        icon="schedule"
                        message="Match starts in 6 hours"
                        time="1h ago"
                        color={COLORS.warning}
                    />
                </View>

                {/* 🔥 SECTION 3: Nearby Matchrooms */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Nearby</Text>
                        <Text style={styles.seeAllText}>See All</Text>
                    </View>
                    <NearbyCard
                        game="CS2"
                        title="Defence 5v5"
                        distance="0.8 km away"
                        time="10 PM – 12 AM"
                        price="450"
                        roles={['NEEDS AWPER', 'NEEDS IGL', 'NEEDS ENTRY', 'NEEDS SUPPORT']}
                    />
                    <NearbyCard
                        game="Futsal"
                        title="Gulshan Arena"
                        distance="2.5 km away"
                        time="8 PM – 9:30 PM"
                        price="300"
                        roles={['NEEDS GK']}
                    />
                </View>

                {/* 🎮 SECTION 4: Recommended */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Recommended for You</Text>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingRight: 24 }}
                        style={{ marginHorizontal: -24, paddingLeft: 24 }}
                    >
                        <RecommendedCard
                            game="Padel"
                            title="BlazeArena 2v2"
                            matchScore="95"
                            price="700"
                        />
                        <RecommendedCard
                            game="Tekken 8"
                            title="Arcade Battle"
                            matchScore="88"
                            price="200"
                        />
                        <RecommendedCard
                            game="CS2"
                            title="Dust II Ranked"
                            matchScore="82"
                            price="500"
                        />
                    </ScrollView>
                </View>

                {/* 📅 SECTION 6: Upcoming */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Upcoming Match</Text>
                    </View>
                    <UpcomingCard
                        game="CS2"
                        title="O2 Arena • 5v5"
                        time="10:00 PM"
                        players="You + 4 TBD"
                    />
                </View>

                {/* 💰 SECTION 8: Wallet */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Wallet</Text>
                    </View>
                    <View style={styles.walletCard}>
                        <View style={styles.walletContent}>
                            <Text style={styles.walletLabel}>Balance</Text>
                            <Text style={styles.walletBalance}>₨ 1,250</Text>
                        </View>
                        <View style={styles.walletIconContainer}>
                            <MaterialIcons name="account-balance-wallet" size={24} color={COLORS.accent} />
                        </View>
                    </View>
                </View>

                {/* 🎖 SECTION 9: Stats */}
                <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Your Stats</Text>
                    </View>
                    <View style={styles.statsRow}>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>28</Text>
                            <Text style={styles.statLabel}>Matches</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>1.06</Text>
                            <Text style={styles.statLabel}>K/D</Text>
                        </View>
                        <View style={[styles.statCard, { marginRight: 0 }]}>
                            <Text style={styles.statValue}>⭐</Text>
                            <Text style={styles.statLabel}>Top 10</Text>
                        </View>
                    </View>
                </View>

            </ScrollView>
        </View>
    );
}
