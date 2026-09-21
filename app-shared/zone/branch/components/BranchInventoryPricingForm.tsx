import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { PC_TYPES } from "../../../../constants/profileOptions";
import RegistrationFieldLabel from "../../../auth/components/RegistrationFieldLabel";
import registerStyles from "../../../auth/register.styles";
import { AppIcon, type AppIconName } from "../../../../src/components/AppIcon";
import { COLORS } from "../../../../src/theme";

export type PcTierSpecs = {
    cpu?: string;
    gpu?: string;
    monitorRefreshRate?: string;
    mouse?: string;
    keyboard?: string;
    headset?: string;
};

export type BranchPricing = {
    pc?: {
        regular?: { count?: unknown; price?: unknown };
        premium?: { count?: unknown; price?: unknown };
        elite?: { count?: unknown; price?: unknown };
    };
    console?: {
        regular?: { count?: unknown; price1v1?: unknown; price2v2?: unknown };
        premium?: { count?: unknown; price1v1?: unknown; price2v2?: unknown };
        elite?: { count?: unknown; price1v1?: unknown; price2v2?: unknown };
        ps5?: { count?: unknown; price1v1?: unknown; price2v2?: unknown };
        xbox?: { count?: unknown; price1v1?: unknown; price2v2?: unknown };
    };
    futsal?: Record<string, { count?: unknown; price?: unknown }>;
    indoor_cricket?: Record<string, { count?: unknown; price?: unknown }>;
    padel?: Record<string, { count?: unknown; price?: unknown }>;
    pickleball?: Record<string, { count?: unknown; price?: unknown }>;
};

export type BranchInventoryFields = {
    supportsCs2: boolean;
    supportsFc25: boolean;
    supportsFc26: boolean;
    supportsTekken8: boolean;
    supportsFutsal: boolean;
    supportsIndoorCricket: boolean;
    supportsPadel: boolean;
    supportsPickleball: boolean;
    pricing: BranchPricing;
    pcSpecs?: {
        regular?: PcTierSpecs;
        premium?: PcTierSpecs;
        elite?: PcTierSpecs;
    };
};

type BranchInventoryPricingFormProps = {
    value: BranchInventoryFields;
    onChange: (next: BranchInventoryFields) => void;
    validationError?: string | null;
};

const inventoryOptions = [
    { label: "PC Setup", key: "supportsCs2", icon: "computer" },
    { label: "Console", key: "supportsFc25", icon: "gamepad" },
] as const;

const CONSOLE_TYPES = PC_TYPES;
const PC_SPEC_FIELDS = [
    { key: "cpu", label: "Processor / CPU", placeholder: "e.g. Ryzen 5 5600" },
    { key: "gpu", label: "Graphics Card / GPU", placeholder: "e.g. RTX 3060" },
    { key: "monitorRefreshRate", label: "Monitor Refresh Rate", placeholder: "e.g. 144Hz" },
    { key: "mouse", label: "Mouse", placeholder: "e.g. Logitech G Pro" },
    { key: "keyboard", label: "Keyboard", placeholder: "e.g. Mechanical keyboard" },
    { key: "headset", label: "Headset", placeholder: "e.g. HyperX Cloud" },
] as const;

const toInputValue = (value: unknown) => (value === undefined || value === null ? "" : String(value));

const toPositiveNumber = (value: unknown) => {
    const parsed = Number(String(value ?? "").trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const createEmptyBranchInventory = (): BranchInventoryFields => ({
    supportsCs2: false,
    supportsFc25: false,
    supportsFc26: false,
    supportsTekken8: false,
    supportsFutsal: false,
    supportsIndoorCricket: false,
    supportsPadel: false,
    supportsPickleball: false,
    pricing: {},
    pcSpecs: {},
});

const countResources = (resources: any[] | undefined, assetType: string, tier: string) =>
    Array.isArray(resources)
        ? resources.filter((resource) =>
            resource?.isActive !== false &&
            String(resource?.assetType || "").toLowerCase() === assetType &&
            String(resource?.tier || "").toLowerCase() === tier,
        ).length
        : 0;

const mergeResourceCountsIntoPricing = (pricing: BranchPricing, resources?: any[]): BranchPricing => {
    if (!Array.isArray(resources) || resources.length === 0) return pricing || {};
    const nextPricing: BranchPricing = {
        ...(pricing || {}),
        pc: { ...(pricing?.pc || {}) },
        console: { ...(pricing?.console || {}) },
    };

    PC_TYPES.forEach((type) => {
        const tier = type.value;
        const pcCount = countResources(resources, "pc", tier);
        if (pcCount > 0) {
            nextPricing.pc![tier] = {
                ...(nextPricing.pc?.[tier] || {}),
                count: String(pcCount),
            };
        }
        const consoleCount = countResources(resources, "console", tier);
        if (consoleCount > 0) {
            nextPricing.console![tier] = {
                ...(nextPricing.console?.[tier] || {}),
                count: String(consoleCount),
            };
        }
    });

    return nextPricing;
};

export const normalizeBranchInventory = (branch?: any, resources?: any[]): BranchInventoryFields => {
    const pricing = mergeResourceCountsIntoPricing(branch?.pricing || {}, resources);
    const hasPcResources = Array.isArray(resources) && resources.some((resource) =>
        resource?.isActive !== false && String(resource?.assetType || "").toLowerCase() === "pc",
    );
    const hasConsoleResources = Array.isArray(resources) && resources.some((resource) =>
        resource?.isActive !== false && String(resource?.assetType || "").toLowerCase() === "console",
    );

    return {
        supportsCs2: Boolean(branch?.supportsCs2 || hasPcResources),
        supportsFc25: Boolean(branch?.supportsFc25 || branch?.supportsFc26 || branch?.supportsTekken8 || hasConsoleResources),
        supportsFc26: Boolean(branch?.supportsFc26 || branch?.supportsFc25 || branch?.supportsTekken8 || hasConsoleResources),
        supportsTekken8: Boolean(branch?.supportsTekken8),
        supportsFutsal: false,
        supportsIndoorCricket: false,
        supportsPadel: false,
        supportsPickleball: false,
        pricing,
        pcSpecs: branch?.pcSpecs || {},
    };
};

const sanitizeSpecs = (specs?: PcTierSpecs) => {
    const cleaned: PcTierSpecs = {};
    PC_SPEC_FIELDS.forEach((field) => {
        const value = String(specs?.[field.key] || "").trim();
        if (value) cleaned[field.key] = value;
    });
    return Object.keys(cleaned).length ? cleaned : undefined;
};

export const sanitizeBranchInventory = (inventory: BranchInventoryFields): BranchInventoryFields => {
    const pcSpecs: BranchInventoryFields["pcSpecs"] = {};
    const supportsConsole = Boolean(inventory.supportsFc25 || inventory.supportsFc26 || inventory.supportsTekken8);

    PC_TYPES.forEach((type) => {
        const tier = type.value;
        const count = toPositiveNumber(inventory.pricing.pc?.[tier]?.count);
        const price = toPositiveNumber(inventory.pricing.pc?.[tier]?.price);
        const cleaned = count > 0 && price > 0 ? sanitizeSpecs(inventory.pcSpecs?.[tier]) : undefined;
        if (cleaned) pcSpecs[tier] = cleaned;
    });

    return {
        ...inventory,
        supportsFc25: supportsConsole,
        supportsFc26: supportsConsole,
        supportsTekken8: supportsConsole,
        pcSpecs: Object.keys(pcSpecs).length ? pcSpecs : {},
    };
};

export const validateBranchInventory = (
    branchName: string,
    inventory: BranchInventoryFields,
) => {
    const label = branchName.trim() || "Branch";

    if (!inventory.supportsCs2 && !inventory.supportsFc25 && !inventory.supportsTekken8) {
        return `${label}: select at least one inventory type.`;
    }

    if (inventory.supportsCs2) {
        const regularCount = toPositiveNumber(inventory.pricing.pc?.regular?.count);
        const premiumCount = toPositiveNumber(inventory.pricing.pc?.premium?.count);
        const eliteCount = toPositiveNumber(inventory.pricing.pc?.elite?.count);

        if (regularCount + premiumCount + eliteCount === 0) {
            return `${label}: add at least one PC setup count.`;
        }

        const pcRows = [
            ["Regular PCs", regularCount, toPositiveNumber(inventory.pricing.pc?.regular?.price)],
            ["Premium PCs", premiumCount, toPositiveNumber(inventory.pricing.pc?.premium?.price)],
            ["Elite PCs", eliteCount, toPositiveNumber(inventory.pricing.pc?.elite?.price)],
        ] as const;

        const missingPcPrice = pcRows.find(([, count, price]) => count > 0 && price <= 0);
        if (missingPcPrice) {
            return `${label}: enter a price for ${missingPcPrice[0]}.`;
        }
    }

    if (inventory.supportsFc25 || inventory.supportsTekken8) {
        const regularCount = toPositiveNumber(inventory.pricing.console?.regular?.count);
        const premiumCount = toPositiveNumber(inventory.pricing.console?.premium?.count);
        const eliteCount = toPositiveNumber(inventory.pricing.console?.elite?.count);
        const ps5Count = toPositiveNumber(inventory.pricing.console?.ps5?.count);
        const xboxCount = toPositiveNumber(inventory.pricing.console?.xbox?.count);

        if (regularCount + premiumCount + eliteCount + ps5Count + xboxCount === 0) {
            return `${label}: add at least one console unit.`;
        }

        const consoleRows = [
            [
                "Regular consoles",
                regularCount,
                toPositiveNumber(inventory.pricing.console?.regular?.price1v1),
                toPositiveNumber(inventory.pricing.console?.regular?.price2v2),
            ],
            [
                "Premium consoles",
                premiumCount,
                toPositiveNumber(inventory.pricing.console?.premium?.price1v1),
                toPositiveNumber(inventory.pricing.console?.premium?.price2v2),
            ],
            [
                "Elite consoles",
                eliteCount,
                toPositiveNumber(inventory.pricing.console?.elite?.price1v1),
                toPositiveNumber(inventory.pricing.console?.elite?.price2v2),
            ],
            [
                "PS5",
                ps5Count,
                toPositiveNumber(inventory.pricing.console?.ps5?.price1v1),
                toPositiveNumber(inventory.pricing.console?.ps5?.price2v2),
            ],
            [
                "Xbox",
                xboxCount,
                toPositiveNumber(inventory.pricing.console?.xbox?.price1v1),
                toPositiveNumber(inventory.pricing.console?.xbox?.price2v2),
            ],
        ] as const;

        const missingConsolePrice = consoleRows.find(
            ([, count, price1v1, price2v2]) => count > 0 && (price1v1 <= 0 || price2v2 <= 0),
        );
        if (missingConsolePrice) {
            return `${label}: enter both 1v1 and 2v2 prices for ${missingConsolePrice[0]}.`;
        }
    }

    return null;
};

export const buildZoneGamesFromBranches = (branches: any[]) => {
    const games = new Set<string>();

    branches.forEach((branch) => {
        if (branch?.supportsCs2 || branch?.supportsCs16 || branch?.supportsValorant) {
            games.add("cs2");
            games.add("cs16");
            games.add("valorant");
        }
        if (branch?.supportsFc25 || branch?.supportsFc26) games.add("fc26");
        if (branch?.supportsTekken8) games.add("tekken8");
    });

    return Array.from(games);
};

export default function BranchInventoryPricingForm({
    value,
    onChange,
    validationError,
}: BranchInventoryPricingFormProps) {
    const [pcExpanded, setPcExpanded] = useState(false);
    const [consoleExpanded, setConsoleExpanded] = useState(false);
    const updatePricing = (
        category: keyof BranchPricing,
        subKey: string,
        field: string,
        nextValue: string,
    ) => {
        const currentPricing = value.pricing || {};
        const categoryPricing = currentPricing[category] || {};

        onChange({
            ...value,
            pricing: {
                ...currentPricing,
                [category]: {
                    ...categoryPricing,
                    [subKey]: {
                        ...(categoryPricing as any)[subKey],
                        [field]: nextValue,
                    },
                },
            },
        });
    };

    const updatePcSpec = (
        tier: "regular" | "premium" | "elite",
        field: keyof PcTierSpecs,
        nextValue: string,
    ) => {
        onChange({
            ...value,
            pcSpecs: {
                ...(value.pcSpecs || {}),
                [tier]: {
                    ...(value.pcSpecs?.[tier] || {}),
                    [field]: nextValue,
                },
            },
        });
    };

    const toggleSupport = (field: keyof BranchInventoryFields) => {
        const nextEnabled = !value[field];
        onChange({
            ...value,
            [field]: nextEnabled,
            ...(field === "supportsFc25"
                ? {
                    supportsFc26: nextEnabled,
                    supportsTekken8: nextEnabled,
                }
                : {}),
        });
    };

    return (
        <>
            <View style={registerStyles.fieldGroup}>
                <RegistrationFieldLabel label="Available inventory" required />
                <View style={registerStyles.chipRow}>
                    {inventoryOptions.map((item) => {
                        const enabled = Boolean(value[item.key]);
                        return (
                            <Pressable
                                key={item.key}
                                onPress={() => toggleSupport(item.key)}
                                style={({ pressed }) => [
                                    registerStyles.optionChip,
                                    enabled && registerStyles.optionChipActive,
                                    pressed && { opacity: 0.9 },
                                ]}
                            >
                                <AppIcon
                                    name={item.icon as AppIconName}
                                    size={18}
                                    color={enabled ? "#fff" : COLORS.muted}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={[registerStyles.optionChipText, enabled && registerStyles.optionChipTextActive]}>
                                    {item.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>

            {value.supportsCs2 ? (
                <View style={registerStyles.card}>
                    <Pressable
                        onPress={() => setPcExpanded((prev) => !prev)}
                        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                    >
                        <View>
                            <Text style={registerStyles.cardTitle}>PC setups</Text>
                            <Text style={[registerStyles.helperText, { color: COLORS.textSecondary }]}>
                                Regular, premium, and elite PCs
                            </Text>
                        </View>
                        <AppIcon name={pcExpanded ? "expand-less" : "chevron-right"} size={22} color={COLORS.muted} />
                    </Pressable>
                    {pcExpanded ? PC_TYPES.map((type) => {
                        const tier = type.value;
                        const showSpecs =
                            toPositiveNumber(value.pricing.pc?.[tier]?.count) > 0 &&
                            toPositiveNumber(value.pricing.pc?.[tier]?.price) > 0;

                        return (
                            <View key={tier} style={registerStyles.fieldGroup}>
                                    <Text style={{ color: COLORS.accent, fontWeight: "600", marginBottom: 8 }}>
                                        {type.label}
                                    </Text>
                                    <View style={registerStyles.row}>
                                        <View style={{ flex: 1 }}>
                                            <RegistrationFieldLabel label="Count" required />
                                            <View style={registerStyles.inputBox}>
                                                <TextInput
                                                    style={registerStyles.input}
                                                    keyboardType="numeric"
                                                    placeholder="e.g. 10"
                                                    placeholderTextColor={COLORS.muted}
                                                    value={toInputValue(value.pricing.pc?.[tier]?.count)}
                                                    onChangeText={(text) => updatePricing("pc", tier, "count", text)}
                                                    selectionColor={COLORS.accent}
                                                />
                                            </View>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <RegistrationFieldLabel label="Price / hour" required />
                                            <View style={registerStyles.inputBox}>
                                                <TextInput
                                                    style={registerStyles.input}
                                                    keyboardType="numeric"
                                                    placeholder="e.g. 250"
                                                    placeholderTextColor={COLORS.muted}
                                                    value={toInputValue(value.pricing.pc?.[tier]?.price)}
                                                    onChangeText={(text) => updatePricing("pc", tier, "price", text)}
                                                    selectionColor={COLORS.accent}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                    {showSpecs ? (
                                        <View style={[registerStyles.reviewSectionCard, { marginTop: 10 }]}>
                                            <Text style={registerStyles.reviewSectionTitle}>Optional specs</Text>
                                            {PC_SPEC_FIELDS.map((field) => (
                                                <View key={field.key} style={{ marginTop: 10 }}>
                                                    <RegistrationFieldLabel label={field.label} />
                                                    <View style={registerStyles.inputBox}>
                                                        <TextInput
                                                            style={registerStyles.input}
                                                            placeholder={field.placeholder}
                                                            placeholderTextColor={COLORS.muted}
                                                            value={toInputValue(value.pcSpecs?.[tier]?.[field.key])}
                                                            onChangeText={(text) => updatePcSpec(tier, field.key, text)}
                                                            selectionColor={COLORS.accent}
                                                        />
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}
                            </View>
                        );
                    }) : null}
                </View>
            ) : null}

            {value.supportsFc25 || value.supportsTekken8 ? (
                <View style={registerStyles.card}>
                    <Pressable
                        onPress={() => setConsoleExpanded((prev) => !prev)}
                        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
                    >
                        <View>
                            <Text style={registerStyles.cardTitle}>Consoles</Text>
                            <Text style={[registerStyles.helperText, { color: COLORS.textSecondary }]}>
                                PS5 and Xbox units with 1v1 / 2v2 pricing
                            </Text>
                        </View>
                        <AppIcon name={consoleExpanded ? "expand-less" : "chevron-right"} size={22} color={COLORS.muted} />
                    </Pressable>

                    {consoleExpanded ? CONSOLE_TYPES.map((type) => (
                        <View key={type.value} style={registerStyles.fieldGroup}>
                            <Text style={{ color: COLORS.accent, fontWeight: "600", marginBottom: 8 }}>
                                {type.label}
                            </Text>
                            <View style={{ marginBottom: 8 }}>
                                <RegistrationFieldLabel label="Total units" required />
                                <View style={registerStyles.inputBox}>
                                    <TextInput
                                        style={registerStyles.input}
                                        keyboardType="numeric"
                                        placeholder="e.g. 4"
                                        placeholderTextColor={COLORS.muted}
                                        value={toInputValue(value.pricing.console?.[type.value]?.count)}
                                        onChangeText={(text) => updatePricing("console", type.value, "count", text)}
                                        selectionColor={COLORS.accent}
                                    />
                                </View>
                            </View>
                            <View style={registerStyles.row}>
                                <View style={{ flex: 1 }}>
                                    <RegistrationFieldLabel label="Price (1v1)" required />
                                    <View style={registerStyles.inputBox}>
                                        <TextInput
                                            style={registerStyles.input}
                                            keyboardType="numeric"
                                            placeholder="e.g. 800"
                                            placeholderTextColor={COLORS.muted}
                                            value={toInputValue(value.pricing.console?.[type.value]?.price1v1)}
                                            onChangeText={(text) => updatePricing("console", type.value, "price1v1", text)}
                                            selectionColor={COLORS.accent}
                                        />
                                    </View>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <RegistrationFieldLabel label="Price (2v2)" required />
                                    <View style={registerStyles.inputBox}>
                                        <TextInput
                                            style={registerStyles.input}
                                            keyboardType="numeric"
                                            placeholder="e.g. 1200"
                                            placeholderTextColor={COLORS.muted}
                                            value={toInputValue(value.pricing.console?.[type.value]?.price2v2)}
                                            onChangeText={(text) => updatePricing("console", type.value, "price2v2", text)}
                                            selectionColor={COLORS.accent}
                                        />
                                    </View>
                                </View>
                            </View>
                        </View>
                    )) : null}
                </View>
            ) : null}

            {validationError ? (
                <Text style={[registerStyles.helperText, registerStyles.helperWarning, { marginBottom: 8 }]}>
                    {validationError}
                </Text>
            ) : null}
        </>
    );
}
