import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { collection, onSnapshot, query } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { db } from "../../../src/config/firebaseConfig";
import { useZoneData } from "../../../src/hooks/useZoneData";
import { COLORS } from "../../../src/theme";

export default function ZoneBranches() {
    const { zone, loading } = useZoneData();
    const router = useRouter();
    const [branches, setBranches] = useState<any[]>([]);
    const [loadingBranches, setLoadingBranches] = useState(true);

    useEffect(() => {
        if (!zone?.id) {
            setLoadingBranches(false);
            return;
        }

        const q = query(collection(db, "zones", zone.id, "branches"));
        const unsub = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setBranches(list);
            setLoadingBranches(false);
        });

        return () => unsub();
    }, [zone?.id]);

    if (loading || loadingBranches) {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: COLORS.background,
                }}
            >
                <ActivityIndicator size="large" color={COLORS.accent} />
            </View>
        );
    }

    if (!zone) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
                <View
                    style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
                >
                    <Text style={{ color: COLORS.text, fontSize: 18 }}>
                        No zone found.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
                <View
                    style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 24,
                    }}
                >
                    <Text style={{ color: COLORS.text, fontSize: 28, fontWeight: "bold" }}>
                        Branches
                    </Text>
                    <Pressable
                        style={{
                            backgroundColor: COLORS.accent,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 8,
                            flexDirection: "row",
                            alignItems: "center",
                        }}
                        onPress={() => {
                            router.push("/zone/branch/new");
                        }}
                    >
                        <MaterialIcons
                            name="add"
                            size={18}
                            color="#fff"
                            style={{ marginRight: 4 }}
                        />
                        <Text style={{ color: "#fff", fontWeight: "600" }}>Add New</Text>
                    </Pressable>
                </View>

                {branches.length === 0 ? (
                    <View style={{ alignItems: "center", marginTop: 40 }}>
                        <Text style={{ color: COLORS.muted }}>No branches found.</Text>
                    </View>
                ) : (
                    branches.map((branch) => (
                        <Pressable
                            key={branch.id}
                            style={({ pressed }) => ({
                                backgroundColor: COLORS.cardBackground,
                                borderRadius: 12,
                                padding: 16,
                                marginBottom: 16,
                                borderWidth: 1,
                                borderColor: COLORS.divider,
                                opacity: pressed ? 0.9 : 1,
                            })}
                            onPress={() => {
                                router.push(`/zone/branch/${branch.id}`);
                            }}
                        >
                            <View
                                style={{
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                }}
                            >
                                <View>
                                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                                        <Text
                                            style={{
                                                color: COLORS.text,
                                                fontSize: 18,
                                                fontWeight: "bold",
                                            }}
                                        >
                                            {branch.branchDisplayName || "Main Branch"}
                                        </Text>
                                        {branch.isPrimary && (
                                            <View
                                                style={{
                                                    backgroundColor: "rgba(66, 165, 245, 0.15)",
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 2,
                                                    borderRadius: 4,
                                                    marginLeft: 8,
                                                }}
                                            >
                                                <Text
                                                    style={{
                                                        color: COLORS.accent,
                                                        fontSize: 10,
                                                        fontWeight: "bold",
                                                        textTransform: "uppercase",
                                                    }}
                                                >
                                                    Primary
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={{ color: COLORS.muted, marginTop: 4 }}>
                                        {branch.areaLabel}, {branch.city}
                                    </Text>
                                    <Text
                                        style={{ color: COLORS.muted, fontSize: 12, marginTop: 2 }}
                                    >
                                        {branch.addressLine1}
                                    </Text>
                                </View>
                                <MaterialIcons
                                    name="chevron-right"
                                    size={24}
                                    color={COLORS.muted}
                                />
                            </View>
                        </Pressable>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
