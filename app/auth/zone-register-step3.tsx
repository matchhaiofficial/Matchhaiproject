// app/auth/zone-register-step3.tsx
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  FUTSAL_COURT_TYPES,
  INDOOR_CRICKET_SURFACES,
  PADEL_SURFACES,
  PC_TYPES,
  PICKLEBALL_SURFACES
} from "../../constants/profileOptions";
import LogoHalo from "../../src/components/LogoHalo";
import { useToast } from "../../src/hooks/useToast";
import { BranchData, useZoneOnboardingStore } from "../../src/store/zoneOnboardingStore";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";

export default function AdminRegisterStep3() {
  const { step1, branches, updateBranch, setCurrentStep } = useZoneOnboardingStore();
  const { showToast } = useToast();

  const [activeBranchIndex, setActiveBranchIndex] = useState(0);
  const activeBranch = branches[activeBranchIndex];

  // Helper to update the active branch
  const updateActiveBranch = (data: Partial<BranchData>) => {
    if (activeBranch) {
      updateBranch(activeBranch.id, data);
    }
  };

  // Helper to update pricing for the active branch
  const updatePricing = (category: keyof BranchData['pricing'], subKey: string, field: string, value: string) => {
    if (!activeBranch) return;
    const currentPricing = activeBranch.pricing || {};
    const categoryPricing = currentPricing[category] || {};

    // Handle nested pricing update
    const updatedCategory = {
      ...categoryPricing,
      [subKey]: {
        ...(categoryPricing as any)[subKey],
        [field]: value
      }
    };

    updateActiveBranch({
      pricing: {
        ...currentPricing,
        [category]: updatedCategory
      }
    });
  };

  // Toggle support for a category
  const toggleSupport = (field: keyof BranchData) => {
    if (!activeBranch) return;
    updateActiveBranch({ [field]: !activeBranch[field] });
  };

  const handleContinue = () => {
    // Basic validation: check if at least one branch has some inventory
    const hasInventory = branches.some(b =>
      b.supportsCs2 || b.supportsFc25 || b.supportsTekken8 ||
      b.supportsFutsal || b.supportsIndoorCricket || b.supportsPadel || b.supportsPickleball
    );

    if (!hasInventory) {
      showToast({ type: "info", title: "Missing inventory", message: "Please add at least one game or court to a branch." });
      return;
    }

    setCurrentStep(3);
    router.push("/auth/zone-register-step4");
  };

  const Container: any = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const containerProps = Platform.OS === "ios" ? { style: styles.screen, behavior: "padding" as const } : { style: styles.screen };

  if (!activeBranch) {
    return (
      <Container {...containerProps}>
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: COLORS.text }}>No branches found. Please go back.</Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={{ color: COLORS.accent }}>Go Back</Text>
          </Pressable>
        </View>
      </Container>
    );
  }

  return (
    <Container {...containerProps}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 24, // Explicitly match SPACING.screenPadding
          justifyContent: 'flex-start'
        }}
        showsVerticalScrollIndicator={false}
      >
        <LogoHalo />

        {/* Stepper */}
        <View style={styles.stepperWrapper}>
          <Text style={styles.stepperTitle}>Inventory & Pricing</Text>
          <Text style={styles.stepperSubtitle}>Step 3 of 4 · Configure each branch</Text>
          <View style={styles.stepperBar}><View style={[styles.stepperBarFill, { width: "75%" }]} /></View>
        </View>

        <Text style={styles.heading}>Branches</Text>
        <Text style={styles.sub}>Select a branch to configure its inventory and pricing.</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 24, flexGrow: 0 }}
          contentContainerStyle={{ alignItems: 'center' }}
        >
          {branches.map((b, index) => (
            <Pressable
              key={b.id}
              onPress={() => setActiveBranchIndex(index)}
              style={({ pressed }) => [
                styles.optionChip,
                index === activeBranchIndex && styles.optionChipActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={[
                styles.optionChipText,
                index === activeBranchIndex && styles.optionChipTextActive,
              ]}>
                {b.branchDisplayName}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.heading}>Configure {activeBranch.branchDisplayName}</Text>
        <Text style={styles.sub}>Select what you have at this branch and set your prices.</Text>

        {/* Inventory Chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
          {[
            ...(step1.type === 'gaming' || step1.type === 'hybrid' ? [
              { label: 'PC Setup', key: 'supportsCs2', icon: 'computer' },
              { label: 'Console', key: 'supportsFc25', icon: 'gamepad' },
            ] : []),
            ...(step1.type === 'sports' || step1.type === 'hybrid' ? [
              { label: 'Futsal', key: 'supportsFutsal', icon: 'sports-soccer' },
              { label: 'Cricket', key: 'supportsIndoorCricket', icon: 'sports-cricket' },
              { label: 'Padel', key: 'supportsPadel', icon: 'sports-tennis' },
              { label: 'Pickleball', key: 'supportsPickleball', icon: 'sports-tennis' },
            ] : []),
          ].map((item) => {
            const isActive = activeBranch[item.key as keyof BranchData];
            return (
              <Pressable
                key={item.key}
                onPress={() => toggleSupport(item.key as keyof BranchData)}
                style={({ pressed }) => [
                  styles.optionChip,
                  isActive && styles.optionChipActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <MaterialIcons name={item.icon as any} size={18} color={isActive ? '#fff' : COLORS.muted} style={{ marginRight: 6 }} />
                <Text style={[
                  styles.optionChipText,
                  isActive && styles.optionChipTextActive,
                ]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>


        {/* Active Sections */}

        {/* PC Section */}
        {activeBranch.supportsCs2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>PC Setups</Text>
            {PC_TYPES.map(type => (
              <View key={type.value} style={styles.fieldGroup}>
                <Text style={{ color: COLORS.accent, fontWeight: '600', marginBottom: 8 }}>{type.label}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Count</Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.muted}
                        value={activeBranch.pricing.pc?.[type.value as 'regular' | 'premium' | 'elite']?.count || ''}
                        onChangeText={(v) => updatePricing('pc', type.value, 'count', v)}
                        selectionColor={COLORS.accent}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Price/Hr</Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.muted}
                        value={activeBranch.pricing.pc?.[type.value as 'regular' | 'premium' | 'elite']?.price || ''}
                        onChangeText={(v) => updatePricing('pc', type.value, 'price', v)}
                        selectionColor={COLORS.accent}
                      />
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Console Section */}
        {activeBranch.supportsFc25 && (
          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={styles.cardTitle}>Consoles</Text>
            {/* PS5 */}
            <View style={styles.fieldGroup}>
              <Text style={{ color: COLORS.accent, fontWeight: '600', marginBottom: 8 }}>PlayStation 5</Text>
              <View style={{ marginBottom: 8 }}>
                <Text style={styles.label}>Total Units</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.muted}
                    value={activeBranch.pricing.console?.ps5?.count || ''}
                    onChangeText={(v) => updatePricing('console', 'ps5', 'count', v)}
                    selectionColor={COLORS.accent}
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Price (1v1)</Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={COLORS.muted}
                      value={activeBranch.pricing.console?.ps5?.price1v1 || ''}
                      onChangeText={(v) => updatePricing('console', 'ps5', 'price1v1', v)}
                      selectionColor={COLORS.accent}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Price (2v2)</Text>
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={COLORS.muted}
                      value={activeBranch.pricing.console?.ps5?.price2v2 || ''}
                      onChangeText={(v) => updatePricing('console', 'ps5', 'price2v2', v)}
                      selectionColor={COLORS.accent}
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Futsal Section */}
        {activeBranch.supportsFutsal && (
          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={styles.cardTitle}>Futsal Courts</Text>
            {FUTSAL_COURT_TYPES.filter(t => t.value).map(type => (
              <View key={type.value} style={styles.fieldGroup}>
                <Text style={{ color: COLORS.accent, fontWeight: '600', marginBottom: 8 }}>{type.label}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Count</Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.muted}
                        value={activeBranch.pricing.futsal?.[type.value]?.count || ''}
                        onChangeText={(v) => updatePricing('futsal', type.value, 'count', v)}
                        selectionColor={COLORS.accent}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Price/Hr</Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.muted}
                        value={activeBranch.pricing.futsal?.[type.value]?.price || ''}
                        onChangeText={(v) => updatePricing('futsal', type.value, 'price', v)}
                        selectionColor={COLORS.accent}
                      />
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Cricket Section */}
        {activeBranch.supportsIndoorCricket && (
          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={styles.cardTitle}>Indoor Cricket</Text>
            {INDOOR_CRICKET_SURFACES.filter(t => t.value).map(type => (
              <View key={type.value} style={styles.fieldGroup}>
                <Text style={{ color: COLORS.accent, fontWeight: '600', marginBottom: 8 }}>{type.label}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Count</Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.muted}
                        value={activeBranch.pricing.indoorCricket?.[type.value]?.count || ''}
                        onChangeText={(v) => updatePricing('indoorCricket', type.value, 'count', v)}
                        selectionColor={COLORS.accent}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Price/Hr</Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.muted}
                        value={activeBranch.pricing.indoorCricket?.[type.value]?.price || ''}
                        onChangeText={(v) => updatePricing('indoorCricket', type.value, 'price', v)}
                        selectionColor={COLORS.accent}
                      />
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Padel Section */}
        {activeBranch.supportsPadel && (
          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={styles.cardTitle}>Padel Courts</Text>
            {PADEL_SURFACES.filter(t => t.value).map(type => (
              <View key={type.value} style={styles.fieldGroup}>
                <Text style={{ color: COLORS.accent, fontWeight: '600', marginBottom: 8 }}>{type.label}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Count</Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.muted}
                        value={activeBranch.pricing.padel?.[type.value]?.count || ''}
                        onChangeText={(v) => updatePricing('padel', type.value, 'count', v)}
                        selectionColor={COLORS.accent}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Price/Hr</Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.muted}
                        value={activeBranch.pricing.padel?.[type.value]?.price || ''}
                        onChangeText={(v) => updatePricing('padel', type.value, 'price', v)}
                        selectionColor={COLORS.accent}
                      />
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pickleball Section */}
        {activeBranch.supportsPickleball && (
          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={styles.cardTitle}>Pickleball Courts</Text>
            {PICKLEBALL_SURFACES.filter(t => t.value).map(type => (
              <View key={type.value} style={styles.fieldGroup}>
                <Text style={{ color: COLORS.accent, fontWeight: '600', marginBottom: 8 }}>{type.label}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Count</Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.muted}
                        value={activeBranch.pricing.pickleball?.[type.value]?.count || ''}
                        onChangeText={(v) => updatePricing('pickleball', type.value, 'count', v)}
                        selectionColor={COLORS.accent}
                      />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Price/Hr</Text>
                    <View style={styles.inputBox}>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.muted}
                        value={activeBranch.pricing.pickleball?.[type.value]?.price || ''}
                        onChangeText={(v) => updatePricing('pickleball', type.value, 'price', v)}
                        selectionColor={COLORS.accent}
                      />
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Navigation */}
        <View style={{ marginTop: 32, gap: 12 }}>
          <Pressable onPress={() => router.back()} style={{ alignSelf: 'center' }}>
            <Text style={{ color: COLORS.muted }}>Back</Text>
          </Pressable>

          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && { opacity: 0.92 }
            ]}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
        </View>

      </ScrollView>
    </Container>
  );
}
