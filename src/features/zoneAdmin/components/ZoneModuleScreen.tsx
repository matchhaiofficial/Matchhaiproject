import { useRouter } from "expo-router";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import AppHeader from "../../../components/AppHeader";
import { AppIcon } from "../../../components/AppIcon";
import Screen from "../../../components/Screen";
import styles from "./ZoneModuleScreen.styles";

type ModuleBlock = {
    title: string;
    points: string[];
};

interface ZoneModuleScreenProps {
    title: string;
    subtitle: string;
    blocks: ModuleBlock[];
    footerHint?: string;
}

export default function ZoneModuleScreen({
    title,
    subtitle,
    blocks,
    footerHint,
}: ZoneModuleScreenProps) {
    const router = useRouter();

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader title={title} onBack={() => router.back()} inlineTitle />

            <View style={styles.heroCard}>
                <Text style={styles.heroTitle}>{title}</Text>
                <Text style={styles.heroSubtitle}>{subtitle}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {blocks.map((block) => (
                    <View key={block.title} style={styles.blockCard}>
                        <Text style={styles.blockTitle}>{block.title}</Text>
                        {block.points.map((point) => (
                            <View key={point} style={styles.blockPointRow}>
                                <AppIcon name="check-circle" size="sm" tone="accent" />
                                <Text style={styles.blockPointText}>{point}</Text>
                            </View>
                        ))}
                    </View>
                ))}

                {footerHint ? (
                    <Pressable style={styles.footerHintCard}>
                        <AppIcon name="tips-and-updates" size={18} tone="accent" />
                        <Text style={styles.footerHintText}>{footerHint}</Text>
                    </Pressable>
                ) : null}
            </ScrollView>
        </Screen>
    );
}

