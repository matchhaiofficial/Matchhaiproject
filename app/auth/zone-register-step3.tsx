import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  FUTSAL_COURT_TYPES,
  INDOOR_CRICKET_SURFACES,
  PADEL_SURFACES,
  PC_TYPES,
  PICKLEBALL_SURFACES,
} from "../../constants/profileOptions";
import RegistrationFieldLabel from "./components/RegistrationFieldLabel";
import RegistrationStepHeader from "./components/RegistrationStepHeader";
import { AppIcon, type AppIconName } from "../../src/components/AppIcon";
import { AppButton } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import { useToast } from "../../src/hooks/useToast";
import { BranchData, useZoneOnboardingStore } from "../../src/store/zoneOnboardingStore";
import { COLORS } from "../../src/theme";
import styles from "./register.styles";

export default function AdminRegisterStep3() {
  const { step1, branches, updateBranch, setCurrentStep } = useZoneOnboardingStore();
  const { showToast } = useToast();

  const [activeBranchIndex, setActiveBranchIndex] = useState(0);
  const activeBranch = branches[activeBranchIndex];

  useEffect(() => {
    setCurrentStep(3);
  }, [setCurrentStep]);

  useEffect(() => {
    if (
      !step1.ownerFullName.trim() ||
      !step1.venueBrandName.trim() ||
      !step1.contactEmail.trim() ||
      !step1.password
    ) {
      router.replace("/auth/zone-register");
      return;
    }

    if (!branches.length) {
      router.replace("/auth/zone-register-step2");
      return;
    }

    if (activeBranchIndex > branches.length - 1) {
      setActiveBranchIndex(0);
    }
  }, [activeBranchIndex, branches, step1]);

  const updateActiveBranch = (data: Partial<BranchData>) => {
    if (!activeBranch) return;
    updateBranch(activeBranch.id, data);
  };

  const updatePricing = (
    category: keyof BranchData["pricing"],
    subKey: string,
    field: string,
    value: string,
  ) => {
    if (!activeBranch) return;

    const currentPricing = activeBranch.pricing || {};
    const categoryPricing = currentPricing[category] || {};

    const updatedCategory = {
      ...categoryPricing,
      [subKey]: {
        ...(categoryPricing as any)[subKey],
        [field]: value,
      },
    };

    updateActiveBranch({
      pricing: {
        ...currentPricing,
        [category]: updatedCategory,
      },
    });
  };

  const toggleSupport = (field: keyof BranchData) => {
    if (!activeBranch) return;
    if (field === "supportsFc25") {
      const enabled = !activeBranch.supportsFc25;
      updateActiveBranch({
        supportsFc25: enabled,
        supportsTekken8: enabled,
      });
      return;
    }
    updateActiveBranch({ [field]: !activeBranch[field] });
  };

  const validation = useMemo(() => {
    const toPositiveNumber = (value: unknown) => {
      const parsed = Number(String(value ?? "").trim());
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };

    const branchErrors = branches.flatMap((branch) => {
      const errors: string[] = [];

      if (branch.supportsCs2) {
        const regularCount = toPositiveNumber(branch.pricing.pc?.regular?.count);
        const premiumCount = toPositiveNumber(branch.pricing.pc?.premium?.count);
        const eliteCount = toPositiveNumber(branch.pricing.pc?.elite?.count);
        const totalPcCount = regularCount + premiumCount + eliteCount;

        if (totalPcCount === 0) {
          errors.push(`${branch.branchDisplayName}: add at least one PC setup count.`);
        }

        [
          ["Regular PCs", regularCount, toPositiveNumber(branch.pricing.pc?.regular?.price)],
          ["Premium PCs", premiumCount, toPositiveNumber(branch.pricing.pc?.premium?.price)],
          ["Elite PCs", eliteCount, toPositiveNumber(branch.pricing.pc?.elite?.price)],
        ].forEach(([label, count, price]) => {
          if (Number(count) > 0 && Number(price) <= 0) {
            errors.push(`${branch.branchDisplayName}: enter a price for ${label}.`);
          }
        });
      }

      if (branch.supportsFc25 || branch.supportsTekken8) {
        const ps5Count = toPositiveNumber(branch.pricing.console?.ps5?.count);
        const xboxCount = toPositiveNumber(branch.pricing.console?.xbox?.count);
        if (ps5Count + xboxCount === 0) {
          errors.push(`${branch.branchDisplayName}: add at least one console unit.`);
        }

        [
          [
            "PS5",
            ps5Count,
            toPositiveNumber(branch.pricing.console?.ps5?.price1v1),
            toPositiveNumber(branch.pricing.console?.ps5?.price2v2),
          ],
          [
            "Xbox",
            xboxCount,
            toPositiveNumber(branch.pricing.console?.xbox?.price1v1),
            toPositiveNumber(branch.pricing.console?.xbox?.price2v2),
          ],
        ].forEach(([label, count, price1v1, price2v2]) => {
          if (Number(count) > 0 && (Number(price1v1) <= 0 || Number(price2v2) <= 0)) {
            errors.push(`${branch.branchDisplayName}: enter both 1v1 and 2v2 prices for ${label}.`);
          }
        });
      }

      const validateCourtCategory = (
        enabled: boolean,
        data: Record<string, any> | undefined,
        label: string,
      ) => {
        if (!enabled) return;
        const entries = Object.values(data || {});
        const totalCount = entries.reduce((sum, item: any) => sum + toPositiveNumber(item?.count), 0);
        if (totalCount === 0) {
          errors.push(`${branch.branchDisplayName}: add at least one ${label.toLowerCase()} count.`);
          return;
        }
        entries.forEach((item: any) => {
          const count = toPositiveNumber(item?.count);
          const price = toPositiveNumber(item?.price);
          if (count > 0 && price <= 0) {
            errors.push(
              `${branch.branchDisplayName}: enter a price for each configured ${label.toLowerCase()} option.`,
            );
          }
        });
      };

      // Physical sports are temporarily disabled.
      // validateCourtCategory(branch.supportsFutsal, branch.pricing.futsal, "Futsal court");
      // validateCourtCategory(branch.supportsIndoorCricket, branch.pricing.indoor_cricket, "Indoor cricket lane");
      // validateCourtCategory(branch.supportsPadel, branch.pricing.padel, "Padel court");
      // validateCourtCategory(branch.supportsPickleball, branch.pricing.pickleball, "Pickleball court");

      return errors;
    });

    const hasInventory = branches.some(
      (branch) =>
        branch.supportsCs2 ||
        branch.supportsFc25 ||
        branch.supportsTekken8,
    );

    return {
      hasInventory,
      branchErrors,
      isStepValid: hasInventory && branchErrors.length === 0,
    };
  }, [branches]);

  const handleContinue = () => {
    if (!validation.hasInventory) {
      showToast({
        type: "info",
        title: "Missing inventory",
        message: "Please add at least one game setup to a branch.",
      });
      return;
    }

    if (validation.branchErrors.length > 0) {
      showToast({
        type: "error",
        title: "Complete branch setup",
        message: validation.branchErrors[0],
      });
      return;
    }

    router.replace("/auth/zone-register-step4");
  };

  if (!activeBranch) {
    return (
      <Screen style={styles.screen} contentStyle={styles.container}>
        <RegistrationStepHeader
          title="Inventory and Pricing"
          subtitle="No branches are available to configure yet."
          stepTitle="Step 3 of 4"
          stepSubtitle="Inventory and pricing"
          progress="75%"
          onBack={() => router.replace("/auth/zone-register-step2")}
        />
        <View style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle}>No branches found</Text>
          <Text style={styles.emptyStateText}>
            Go back and add at least one branch before continuing.
          </Text>
        </View>
      </Screen>
    );
  }

  const inventoryOptions = [
    ...(step1.type === "gaming" || step1.type === "hybrid"
      ? [
          { label: "PC Setup", key: "supportsCs2", icon: "computer" },
          { label: "Console", key: "supportsFc25", icon: "gamepad" },
        ]
      : []),
    // Physical sports are temporarily disabled.
    // ...(step1.type === "sports" || step1.type === "hybrid"
    //   ? [
    //       { label: "Futsal", key: "supportsFutsal", icon: "sports-soccer" },
    //       { label: "Cricket", key: "supportsIndoorCricket", icon: "sports-cricket" },
    //       { label: "Padel", key: "supportsPadel", icon: "sports-tennis" },
    //       { label: "Pickleball", key: "supportsPickleball", icon: "sports-tennis" },
    //     ]
    //   : []),
  ] as const;

  return (
    <Screen
      scroll
      keyboardAvoiding
      style={styles.screen}
      contentStyle={styles.container}
      routeKey="/auth/zone-register-step3"
      scrollProps={{
        showsVerticalScrollIndicator: false,
        keyboardShouldPersistTaps: "handled",
      }}
    >
      <RegistrationStepHeader
        title="Inventory and Pricing"
        subtitle="Configure each branch so booking and pricing surfaces can open with valid data."
        stepTitle="Step 3 of 4"
        stepSubtitle="Inventory and pricing"
        progress="75%"
        onBack={() => router.replace("/auth/zone-register-step2")}
      />

      <Text style={styles.heading}>Configure each branch</Text>
      <Text style={styles.sub}>
        Select the inventory each branch supports, then fill the required counts and prices.
      </Text>

      <View style={styles.fieldGroup}>
        <RegistrationFieldLabel label="Active branch" required />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ alignItems: "center", gap: 10 }}
        >
          {branches.map((branch, index) => (
            <Pressable
              key={branch.id}
              onPress={() => setActiveBranchIndex(index)}
              style={({ pressed }) => [
                styles.optionChip,
                index === activeBranchIndex && styles.optionChipActive,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text
                style={[
                  styles.optionChipText,
                  index === activeBranchIndex && styles.optionChipTextActive,
                ]}
              >
                {branch.branchDisplayName}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.reviewSectionCard}>
        <Text style={styles.reviewSectionTitle}>{activeBranch.branchDisplayName}</Text>
        <Text style={styles.reviewValue}>
          {[activeBranch.areaLabel, activeBranch.city].filter(Boolean).join(", ")}
        </Text>
      </View>

      <View style={styles.fieldGroup}>
        <RegistrationFieldLabel label="Available inventory" required />
        <View style={styles.chipRow}>
          {inventoryOptions.map((item) => {
            const enabled = Boolean(activeBranch[item.key as keyof BranchData]);
            return (
              <Pressable
                key={item.key}
                onPress={() => toggleSupport(item.key as keyof BranchData)}
                style={({ pressed }) => [
                  styles.optionChip,
                  enabled && styles.optionChipActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <AppIcon
                  name={item.icon as AppIconName}
                  size={18}
                  color={enabled ? "#fff" : COLORS.muted}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.optionChipText, enabled && styles.optionChipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {activeBranch.supportsCs2 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>PC setups</Text>
          {PC_TYPES.map((type) => (
            <View key={type.value} style={styles.fieldGroup}>
              <Text style={{ color: COLORS.accent, fontWeight: "600", marginBottom: 8 }}>
                {type.label}
              </Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <RegistrationFieldLabel label="Count" required />
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="e.g. 10"
                      placeholderTextColor={COLORS.muted}
                      value={activeBranch.pricing.pc?.[type.value as "regular" | "premium" | "elite"]?.count || ""}
                      onChangeText={(value) => updatePricing("pc", type.value, "count", value)}
                      selectionColor={COLORS.accent}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <RegistrationFieldLabel label="Price / hour" required />
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="e.g. 250"
                      placeholderTextColor={COLORS.muted}
                      value={activeBranch.pricing.pc?.[type.value as "regular" | "premium" | "elite"]?.price || ""}
                      onChangeText={(value) => updatePricing("pc", type.value, "price", value)}
                      selectionColor={COLORS.accent}
                    />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {activeBranch.supportsFc25 || activeBranch.supportsTekken8 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Consoles</Text>

          <View style={styles.fieldGroup}>
            <Text style={{ color: COLORS.accent, fontWeight: "600", marginBottom: 8 }}>
              PlayStation 5
            </Text>
            <View style={{ marginBottom: 8 }}>
              <RegistrationFieldLabel label="Total units" required />
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="e.g. 4"
                  placeholderTextColor={COLORS.muted}
                  value={activeBranch.pricing.console?.ps5?.count || ""}
                  onChangeText={(value) => updatePricing("console", "ps5", "count", value)}
                  selectionColor={COLORS.accent}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <RegistrationFieldLabel label="Price (1v1)" required />
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="e.g. 800"
                    placeholderTextColor={COLORS.muted}
                    value={activeBranch.pricing.console?.ps5?.price1v1 || ""}
                    onChangeText={(value) => updatePricing("console", "ps5", "price1v1", value)}
                    selectionColor={COLORS.accent}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <RegistrationFieldLabel label="Price (2v2)" required />
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="e.g. 1200"
                    placeholderTextColor={COLORS.muted}
                    value={activeBranch.pricing.console?.ps5?.price2v2 || ""}
                    onChangeText={(value) => updatePricing("console", "ps5", "price2v2", value)}
                    selectionColor={COLORS.accent}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={{ color: COLORS.accent, fontWeight: "600", marginBottom: 8 }}>Xbox</Text>
            <View style={{ marginBottom: 8 }}>
              <RegistrationFieldLabel label="Total units" required />
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="e.g. 2"
                  placeholderTextColor={COLORS.muted}
                  value={activeBranch.pricing.console?.xbox?.count || ""}
                  onChangeText={(value) => updatePricing("console", "xbox", "count", value)}
                  selectionColor={COLORS.accent}
                />
              </View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <RegistrationFieldLabel label="Price (1v1)" required />
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="e.g. 700"
                    placeholderTextColor={COLORS.muted}
                    value={activeBranch.pricing.console?.xbox?.price1v1 || ""}
                    onChangeText={(value) => updatePricing("console", "xbox", "price1v1", value)}
                    selectionColor={COLORS.accent}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <RegistrationFieldLabel label="Price (2v2)" required />
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="e.g. 1000"
                    placeholderTextColor={COLORS.muted}
                    value={activeBranch.pricing.console?.xbox?.price2v2 || ""}
                    onChangeText={(value) => updatePricing("console", "xbox", "price2v2", value)}
                    selectionColor={COLORS.accent}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {false && activeBranch.supportsFutsal ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Futsal courts</Text>
          {FUTSAL_COURT_TYPES.filter((type) => type.value).map((type) => (
            <View key={type.value} style={styles.fieldGroup}>
              <Text style={{ color: COLORS.accent, fontWeight: "600", marginBottom: 8 }}>
                {type.label}
              </Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <RegistrationFieldLabel label="Count" required />
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="e.g. 1"
                      placeholderTextColor={COLORS.muted}
                      value={activeBranch.pricing.futsal?.[type.value]?.count || ""}
                      onChangeText={(value) => updatePricing("futsal", type.value, "count", value)}
                      selectionColor={COLORS.accent}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <RegistrationFieldLabel label="Price / hour" required />
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="e.g. 5000"
                      placeholderTextColor={COLORS.muted}
                      value={activeBranch.pricing.futsal?.[type.value]?.price || ""}
                      onChangeText={(value) => updatePricing("futsal", type.value, "price", value)}
                      selectionColor={COLORS.accent}
                    />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {false && activeBranch.supportsIndoorCricket ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Indoor cricket</Text>
          {INDOOR_CRICKET_SURFACES.filter((type) => type.value).map((type) => (
            <View key={type.value} style={styles.fieldGroup}>
              <Text style={{ color: COLORS.accent, fontWeight: "600", marginBottom: 8 }}>
                {type.label}
              </Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <RegistrationFieldLabel label="Count" required />
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="e.g. 1"
                      placeholderTextColor={COLORS.muted}
                      value={activeBranch.pricing.indoor_cricket?.[type.value]?.count || ""}
                      onChangeText={(value) =>
                        updatePricing("indoor_cricket", type.value, "count", value)
                      }
                      selectionColor={COLORS.accent}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <RegistrationFieldLabel label="Price / hour" required />
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="e.g. 3500"
                      placeholderTextColor={COLORS.muted}
                      value={activeBranch.pricing.indoor_cricket?.[type.value]?.price || ""}
                      onChangeText={(value) =>
                        updatePricing("indoor_cricket", type.value, "price", value)
                      }
                      selectionColor={COLORS.accent}
                    />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {false && activeBranch.supportsPadel ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Padel courts</Text>
          {PADEL_SURFACES.filter((type) => type.value).map((type) => (
            <View key={type.value} style={styles.fieldGroup}>
              <Text style={{ color: COLORS.accent, fontWeight: "600", marginBottom: 8 }}>
                {type.label}
              </Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <RegistrationFieldLabel label="Count" required />
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="e.g. 1"
                      placeholderTextColor={COLORS.muted}
                      value={activeBranch.pricing.padel?.[type.value]?.count || ""}
                      onChangeText={(value) => updatePricing("padel", type.value, "count", value)}
                      selectionColor={COLORS.accent}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <RegistrationFieldLabel label="Price / hour" required />
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="e.g. 3000"
                      placeholderTextColor={COLORS.muted}
                      value={activeBranch.pricing.padel?.[type.value]?.price || ""}
                      onChangeText={(value) => updatePricing("padel", type.value, "price", value)}
                      selectionColor={COLORS.accent}
                    />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {false && activeBranch.supportsPickleball ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pickleball courts</Text>
          {PICKLEBALL_SURFACES.filter((type) => type.value).map((type) => (
            <View key={type.value} style={styles.fieldGroup}>
              <Text style={{ color: COLORS.accent, fontWeight: "600", marginBottom: 8 }}>
                {type.label}
              </Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <RegistrationFieldLabel label="Count" required />
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="e.g. 1"
                      placeholderTextColor={COLORS.muted}
                      value={activeBranch.pricing.pickleball?.[type.value]?.count || ""}
                      onChangeText={(value) =>
                        updatePricing("pickleball", type.value, "count", value)
                      }
                      selectionColor={COLORS.accent}
                    />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <RegistrationFieldLabel label="Price / hour" required />
                  <View style={styles.inputBox}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="e.g. 2500"
                      placeholderTextColor={COLORS.muted}
                      value={activeBranch.pricing.pickleball?.[type.value]?.price || ""}
                      onChangeText={(value) =>
                        updatePricing("pickleball", type.value, "price", value)
                      }
                      selectionColor={COLORS.accent}
                    />
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {!validation.isStepValid ? (
        <Text style={[styles.helperText, styles.helperWarning, { marginBottom: 8 }]}>
          {validation.branchErrors[0] || "Select at least one inventory type before continuing."}
        </Text>
      ) : null}

      <Pressable
        onPress={() => router.replace("/auth/zone-register-step2")}
        style={styles.backLinkWrapper}
      >
        <Text style={styles.backLinkText}>Back to branches and locations</Text>
      </Pressable>

      <View
        style={[
          styles.buttonShadowWrapper,
          validation.isStepValid && styles.buttonShadowWrapperActive,
        ]}
      >
        <AppButton
          onPress={handleContinue}
          disabled={!validation.isStepValid}
          size="lg"
          style={[styles.primaryBtn, !validation.isStepValid ? styles.primaryBtnDisabled : null]}
        >
          Continue
        </AppButton>
      </View>
    </Screen>
  );
}
