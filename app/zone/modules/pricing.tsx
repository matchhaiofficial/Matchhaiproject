import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
    ActivityIndicator,
    Dimensions,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppHeader from "../../../src/components/AppHeader";
import { AppIcon, type AppIconName } from "../../../src/components/AppIcon";
import {
    AppDialog,
    AppDrawer,
    AppModalBody,
    AppModalFooter,
    AppModalHeader,
    AppPickerSheet,
} from "../../../src/components/AppModalPrimitives";
import { AppButton } from "../../../src/components/AppPrimitives";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import Screen from "../../../src/components/Screen";
import { useAuth } from "../../../src/context/AuthContext";
import { useToast } from "../../../src/hooks/useToast";
import { useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { useZoneData } from "../../../src/hooks/useZoneData";
import {
    createZonePricingRule,
    deleteZonePricingRule,
    getEnabledPricingRulesForZone,
    setZonePricingRuleEnabled,
    subscribeZonePricingRules,
    type PricingRule,
    type PricingRuleAssetType,
    type PricingRuleType,
} from "../../../src/services/pricingRuleService";
import { subscribeZoneBranches, type ZoneBranch } from "../../../src/services/convex/zoneAdminResourceService";
import { COLORS, SPACING } from "../../../src/theme";
import { getZoneMigrationLabel, isZoneMigrationReady } from "../../../src/utils/zoneLifecycle";
import styles from "./pricing.styles";

const ASSET_TYPES: PricingRuleAssetType[] = ["pc", "console"];

const RULE_TYPES: PricingRuleType[] = ["percentage_discount", "fixed_override"];
const DRAWER_WIDTH = Math.min(420, Math.round(Dimensions.get("window").width * 0.94));
type RuleEnabledFilter = "all" | "enabled" | "disabled";
const ENABLED_FILTERS: Array<{ key: RuleEnabledFilter; label: string }> = [
    { key: "all", label: "All states" },
    { key: "enabled", label: "Enabled" },
    { key: "disabled", label: "Disabled" },
];
const TIER_OPTIONS_BY_ASSET: Partial<Record<PricingRuleAssetType, Array<{ key: string; label: string }>>> = {
    pc: [
        { key: "regular", label: "Regular PCs" },
        { key: "premium", label: "Premium PCs" },
        { key: "elite", label: "Elite PCs" },
    ],
    console: [
        { key: "ps5", label: "PS5" },
        { key: "xbox", label: "Xbox" },
    ],
};
const MODE_OPTIONS_BY_ASSET: Partial<Record<PricingRuleAssetType, Array<{ key: string; label: string }>>> = {
    pc: [{ key: "5v5", label: "5v5" }],
    console: [
        { key: "1v1", label: "1v1" },
        { key: "2v2", label: "2v2" },
    ],
};

const formatLabel = (value?: string | null) => {
    const raw = String(value || "").trim();
    if (!raw) return "All";
    const normalized = raw.toLowerCase();
    if (normalized === "pc") return "PCs";
    if (normalized === "cs2") return "CS2";
    if (normalized === "cs16") return "CS 1.6";
    if (normalized === "fc26") return "FC26";
    if (normalized === "ps5") return "PS5";
    return raw
        .split(/[_\s-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
};

const toMillis = (value: any) => {
    if (!value) return 0;
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    return 0;
};

const toTimeValue = (date: Date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const toDateValue = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const toDateDisplay = (date: Date) =>
    `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

const toTimeDisplay = (date: Date) =>
    date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });

const parseTimeToDraft = (timeStr: string | undefined) => {
    if (!timeStr) return { hour: 12, minute: 0, period: "AM" as const };
    const [h24, m] = timeStr.split(":").map(Number);
    const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
    const hour12 = h24 % 12 || 12;
    return { hour: hour12, minute: m || 0, period };
};

const draftToTimeString = (draft: { hour: number; minute: number; period: "AM" | "PM" }) => {
    const h12 = draft.hour % 12;
    const h24 = draft.period === "PM" ? h12 + 12 : h12;
    const hours = String(h24).padStart(2, "0");
    const minutes = String(draft.minute).padStart(2, "0");
    return `${hours}:${minutes}`;
};

const RULE_SWITCH_TRACK_COLOR = {
    false: COLORS.cardBorder,
    true: "rgba(66, 165, 245, 0.4)",
};

const PricingRuleRow = memo(function PricingRuleRow({
    rule,
    branchLabel,
    onToggle,
    onDelete,
}: {
    rule: PricingRule;
    branchLabel: string;
    onToggle: (rule: PricingRule, enabled: boolean) => void | Promise<void>;
    onDelete: (rule: PricingRule) => void | Promise<void>;
}) {
    return (
        <View style={styles.ruleRow}>
            <View style={styles.ruleBody}>
                <Text style={styles.ruleName}>{rule.name}</Text>
                <Text style={styles.ruleMeta}>
                    {formatLabel(rule.assetType)} | {formatLabel(rule.ruleType)} | value {rule.value}
                </Text>
                <Text style={styles.ruleMeta}>
                    {rule.timeStart}-{rule.timeEnd} | priority {rule.priority}
                </Text>
                <Text style={styles.ruleMeta}>
                    Branch: {branchLabel}
                    {rule.tier ? ` | Tier: ${formatLabel(rule.tier)}` : ""}
                    {rule.surface ? ` | Mode: ${formatLabel(rule.surface)}` : ""}
                </Text>
            </View>
            <View style={styles.ruleActions}>
                <Switch
                    value={rule.isEnabled}
                    onValueChange={(enabled) => onToggle(rule, enabled)}
                    thumbColor={rule.isEnabled ? COLORS.accent : COLORS.muted}
                    trackColor={RULE_SWITCH_TRACK_COLOR}
                />
                <Pressable onPress={() => onDelete(rule)} style={styles.deleteButton}>
                    <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
            </View>
        </View>
    );
});

export default function ZonePricingModule() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const { zone } = useZoneData();
    const { showToast } = useToast();
    useRouteLogger("ZonePricingModule", {
        zoneId: zone?.id,
        userId: user?._id,
    });

    const [branches, setBranches] = useState<ZoneBranch[]>([]);
    const [rules, setRules] = useState<PricingRule[]>([]);
    const [loadingRules, setLoadingRules] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [rulesBlocked, setRulesBlocked] = useState(false);

    const [name, setName] = useState("");
    const [assetType, setAssetType] = useState<PricingRuleAssetType>("pc");
    const [ruleType, setRuleType] = useState<PricingRuleType>("percentage_discount");
    const [value, setValue] = useState("");
    const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
    const [tier, setTier] = useState("");
    const [surface, setSurface] = useState("");
    const [timeStartAt, setTimeStartAt] = useState(() => {
        const seed = new Date();
        seed.setHours(8, 0, 0, 0);
        return seed;
    });
    const [timeEndAt, setTimeEndAt] = useState(() => {
        const seed = new Date();
        seed.setHours(13, 0, 0, 0);
        return seed;
    });
    const [validFromAt, setValidFromAt] = useState<Date | null>(null);
    const [validToAt, setValidToAt] = useState<Date | null>(null);
    const [showRuleFilters, setShowRuleFilters] = useState(false);
    const [ruleSearchQuery, setRuleSearchQuery] = useState("");
    const [ruleAssetFilter, setRuleAssetFilter] = useState<PricingRuleAssetType | "all">("all");
    const [ruleTypeFilter, setRuleTypeFilter] = useState<PricingRuleType | "all">("all");
    const [ruleEnabledFilter, setRuleEnabledFilter] = useState<RuleEnabledFilter>("all");
    const [ruleBranchFilter, setRuleBranchFilter] = useState("all");
    const [priority, setPriority] = useState("0");
    const [viewMode, setViewMode] = useState<"create" | "rules">("create");
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [dateTarget, setDateTarget] = useState<null | "valid_from" | "valid_to">(null);
    const [timeTarget, setTimeTarget] = useState<null | "start_time" | "end_time">(null);
    const [ruleToDelete, setRuleToDelete] = useState<PricingRule | null>(null);
    const [dateDraft, setDateDraft] = useState<Date | null>(null);
    const [monthCursor, setMonthCursor] = useState<Date>(() => {
        const base = new Date();
        base.setDate(1);
        base.setHours(0, 0, 0, 0);
        return base;
    });
    const [timeDraft, setTimeDraft] = useState<{ hour: number; minute: number; period: "AM" | "PM" }>({
        hour: 8,
        minute: 0,
        period: "AM",
    });
    const pricingEngineReady = isZoneMigrationReady(zone);

    useEffect(() => {
        if (!zone?.id) return;
        const unsub = subscribeZoneBranches(
            zone.id,
            (rows) => setBranches(rows),
            () => {
                // Form still works without branch list.
            },
        );
        return () => unsub();
    }, [zone?.id]);

    useEffect(() => {
        if (!zone?.id) {
            setLoadingRules(false);
            return;
        }
        if (!pricingEngineReady) {
            setRules([]);
            setErrorText(null);
            setLoadingRules(false);
            return;
        }
        if (rulesBlocked) {
            setLoadingRules(false);
            return;
        }

        const unsub = subscribeZonePricingRules(
            zone.id,
            (rows) => {
                setRules(rows.sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)));
                setLoadingRules(false);
            },
            (error) => {
                setLoadingRules(false);
                if (error?.code === "permission-denied") {
                    setRulesBlocked(true);
                    setErrorText("Pricing rules access denied by Firestore rules.");
                } else {
                    setErrorText("Failed to load pricing rules.");
                }
            },
        );

        return () => unsub();
    }, [pricingEngineReady, rulesBlocked, zone?.id]);

    const createRule = async () => {
        if (!zone?.id || !user?._id) return;
        if (!pricingEngineReady) {
            showToast({
                type: "warning",
                title: "Migration required",
                message: "Venue pricing stays locked until migration succeeds and the venue becomes active.",
            });
            return;
        }
        if (!name.trim()) {
            showToast({ type: "warning", title: "Missing name", message: "Enter a pricing rule name." });
            return;
        }

        const parsedValue = Number.parseFloat(value);
        const parsedPriority = Number.parseInt(priority, 10);
        if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
            showToast({ type: "warning", title: "Invalid value", message: "Enter a valid numeric rule value." });
            return;
        }
        if (validFromAt && validToAt && validFromAt.getTime() > validToAt.getTime()) {
            showToast({ type: "warning", title: "Invalid dates", message: "From date must be before or equal to To date." });
            return;
        }

        setSaving(true);
        const result = await createZonePricingRule(
            zone.id,
            {
                name: name.trim(),
                assetType,
                branchId: selectedBranchId === "all" ? null : selectedBranchId,
                tier: tier.trim() || null,
                surface: surface.trim() || null,
                ruleType,
                value: parsedValue,
                daysOfWeek: [],
                timeStart: toTimeValue(timeStartAt),
                timeEnd: toTimeValue(timeEndAt),
                validFrom: validFromAt ? toDateValue(validFromAt) : null,
                validTo: validToAt ? toDateValue(validToAt) : null,
                priority: Number.isFinite(parsedPriority) ? parsedPriority : 0,
            },
            user._id,
        );
        setSaving(false);

        if (!result.ok) {
            showToast({ type: "error", title: "Create failed", message: result.message });
            return;
        }

        setName("");
        setTier("");
        setSurface("");
        setValue("");
        setValidFromAt(null);
        setValidToAt(null);
        setPriority("0");
        const refreshedRules = await getEnabledPricingRulesForZone(zone.id, { forceRefresh: true });
        setRules(refreshedRules.sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)));
        showToast({ type: "success", title: "Rule created", message: "Pricing rule is now active." });
    };

    const toggleRule = useCallback(async (rule: PricingRule, enabled: boolean) => {
        if (!zone?.id || !user?._id) return;
        const result = await setZonePricingRuleEnabled(zone.id, rule.id, enabled, user._id);
        if (!result.ok) {
            showToast({ type: "error", title: "Update failed", message: result.message });
        }
    }, [showToast, user?._id, zone?.id]);

    const removeRule = useCallback(async (rule: PricingRule) => {
        if (!zone?.id || !user?._id) return;
        setRuleToDelete(rule);
    }, [user?._id, zone?.id]);

    const confirmRemoveRule = useCallback(async () => {
        if (!zone?.id || !user?._id || !ruleToDelete) return;
        const rule = ruleToDelete;
        setRuleToDelete(null);
        const result = await deleteZonePricingRule(zone.id, rule.id, user._id);
        if (!result.ok) {
            showToast({ type: "error", title: "Delete failed", message: result.message });
        }
    }, [ruleToDelete, showToast, user?._id, zone?.id]);

    const summary = useMemo(() => {
        const enabled = rules.filter((item) => item.isEnabled).length;
        return { total: rules.length, enabled, disabled: rules.length - enabled };
    }, [rules]);
    const filteredRules = useMemo(() => {
        const normalizedSearch = ruleSearchQuery.trim().toLowerCase();
        return rules.filter((rule) => {
            if (ruleAssetFilter !== "all" && rule.assetType !== ruleAssetFilter) return false;
            if (ruleTypeFilter !== "all" && rule.ruleType !== ruleTypeFilter) return false;
            if (ruleEnabledFilter === "enabled" && !rule.isEnabled) return false;
            if (ruleEnabledFilter === "disabled" && rule.isEnabled) return false;
            if (ruleBranchFilter !== "all" && String(rule.branchId || "all") !== ruleBranchFilter) return false;
            if (!normalizedSearch) return true;
            return [
                rule.name,
                rule.assetType,
                rule.ruleType,
                rule.tier,
                rule.surface,
                rule.branchId,
                rule.timeStart,
                rule.timeEnd,
                rule.validFrom,
                rule.validTo,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(normalizedSearch);
        });
    }, [ruleAssetFilter, ruleBranchFilter, ruleEnabledFilter, ruleSearchQuery, ruleTypeFilter, rules]);
    const activeRuleFilterCount = useMemo(
        () =>
            (ruleAssetFilter !== "all" ? 1 : 0) +
            (ruleTypeFilter !== "all" ? 1 : 0) +
            (ruleEnabledFilter !== "all" ? 1 : 0) +
            (ruleBranchFilter !== "all" ? 1 : 0),
        [ruleAssetFilter, ruleBranchFilter, ruleEnabledFilter, ruleTypeFilter],
    );
    const pricingMetrics = useMemo(
        () => [
            { key: "total", label: "Rules", value: summary.total, icon: "pricing" as AppIconName, color: COLORS.accent },
            { key: "enabled", label: "Enabled", value: summary.enabled, icon: "status" as AppIconName, color: COLORS.successBright },
            { key: "disabled", label: "Disabled", value: summary.disabled, icon: "cancel" as AppIconName, color: COLORS.warning },
            { key: "branches", label: "Branches", value: branches.length || 1, icon: "branch" as AppIconName, color: COLORS.textSecondary },
        ],
        [branches.length, summary.disabled, summary.enabled, summary.total],
    );
    const branchLabelById = useMemo(
        () => new Map(branches.map((branch) => [branch.id, branch.branchDisplayName] as const)),
        [branches],
    );
    const tierOptions = useMemo(
        () => TIER_OPTIONS_BY_ASSET[assetType] || [{ key: "", label: "All tiers" }],
        [assetType],
    );
    const modeOptions = useMemo(
        () => MODE_OPTIONS_BY_ASSET[assetType] || [{ key: "", label: "All modes" }],
        [assetType],
    );
    useEffect(() => {
        const tierValid = tierOptions.some((option) => option.key === tier);
        if (!tierValid) {
            setTier(tierOptions[0]?.key || "");
        }
        const modeValid = modeOptions.some((option) => option.key === surface);
        if (!modeValid) {
            setSurface(modeOptions[0]?.key || "");
        }
    }, [assetType, modeOptions, surface, tier, tierOptions]);
    const migrationNotice = !pricingEngineReady
        ? `Pricing stays locked until migration succeeds. Current state: ${getZoneMigrationLabel(zone)}. Open Migration Tools if you need to repair the venue setup.`
        : null;
    const hours12 = useMemo(() => Array.from({ length: 12 }).map((_, index) => index + 1), []);
    const minutes = useMemo(() => [0, 30], []);
    const periods: Array<"AM" | "PM"> = ["AM", "PM"];
    const timeColumnMaxHeight = Math.min(360, Math.max(220, Dimensions.get("window").height * 0.46));
    const monthYearLabel = useMemo(
        () => monthCursor.toLocaleString("en-US", { month: "long", year: "numeric" }),
        [monthCursor],
    );
    const daysInMonth = useMemo(
        () => new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate(),
        [monthCursor],
    );
    const firstWeekday = useMemo(
        () => new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay(),
        [monthCursor],
    );
    const isSameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    return (
        <Screen style={styles.screen} scroll={false}>
            <AppHeader
                title="Pricing & Promotions"
                subtitle="Rule documents + live player-side resolver"
                onBack={() => router.back()}
                inlineTitle
            />

            <SegmentedTabs
                items={[
                    { key: "create", label: "Create Rule" },
                    { key: "rules", label: "Rules", badge: filteredRules.length },
                ]}
                value={viewMode}
                onChange={(value) => setViewMode(value)}
                style={styles.segmentTabs}
            />

            {errorText ? (
                <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{errorText}</Text>
                </View>
            ) : null}
            {migrationNotice ? (
                <View style={styles.noticeBox}>
                    <Text style={styles.noticeText}>{migrationNotice}</Text>
                </View>
            ) : null}

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.summaryGrid}>
                    {pricingMetrics.map((metric, index) => (
                        <View
                            key={metric.key}
                            style={[
                                styles.summaryCard,
                                index % 2 === 0 && styles.summaryCardLeft,
                                index < 2 && styles.summaryCardTop,
                            ]}
                        >
                            <View style={[styles.summaryIconWrap, { backgroundColor: `${metric.color}12`, borderColor: `${metric.color}38` }]}>
                                <AppIcon name={metric.icon} size={16} color={metric.color} />
                            </View>
                            <View style={styles.summaryTextWrap}>
                                <Text style={styles.summaryLabel}>{metric.label}</Text>
                                <Text style={styles.summaryValue}>{metric.value}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {viewMode === "rules" ? (
                    <>
                        <View style={styles.searchRow}>
                            <View style={styles.searchBar}>
                                <AppIcon name="search" size={20} color={COLORS.muted} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search rules..."
                                    placeholderTextColor={COLORS.muted}
                                    value={ruleSearchQuery}
                                    onChangeText={setRuleSearchQuery}
                                />
                                {ruleSearchQuery.length > 0 ? (
                                    <Pressable onPress={() => setRuleSearchQuery("")} hitSlop={8}>
                                        <AppIcon name="close" size={18} color={COLORS.muted} />
                                    </Pressable>
                                ) : null}
                            </View>
                            <Pressable
                                onPress={() => setShowRuleFilters(true)}
                                style={({ pressed }) => [
                                    styles.filterButton,
                                    pressed && styles.filterButtonPressed,
                                ]}
                            >
                                <AppIcon name="filters" size={22} color={COLORS.text} />
                                {activeRuleFilterCount > 0 ? (
                                    <View style={styles.filterBadge}>
                                        <Text style={styles.filterBadgeText}>
                                            {activeRuleFilterCount > 9 ? "9+" : activeRuleFilterCount}
                                        </Text>
                                    </View>
                                ) : null}
                            </Pressable>
                        </View>

                        <AppDrawer
                            visible={showRuleFilters}
                            onClose={() => setShowRuleFilters(false)}
                            drawerStyle={[styles.filterDrawer, { width: DRAWER_WIDTH }]}
                        >
                            <View style={[styles.filterDrawerContent, { paddingTop: Math.max(insets.top, 16) }]}>
                                <AppModalHeader title="Filters" subtitle="Pricing rules" onClose={() => setShowRuleFilters(false)} compact />
                                <AppModalBody scroll contentContainerStyle={styles.filtersDrawerBody}>
                                    <View style={styles.filtersWrap}>
                                        <Text style={styles.filterSectionLabel}>State</Text>
                                        <View style={styles.filterChipWrap}>
                                            {ENABLED_FILTERS.map((filter) => (
                                                <Pressable
                                                    key={filter.key}
                                                    onPress={() => setRuleEnabledFilter(filter.key)}
                                                    style={[styles.chip, ruleEnabledFilter === filter.key && styles.chipActive]}
                                                >
                                                    <Text style={[styles.chipText, ruleEnabledFilter === filter.key && styles.chipTextActive]}>{filter.label}</Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                        <Text style={styles.filterSectionLabel}>Asset type</Text>
                                        <View style={styles.filterChipWrap}>
                                            {(["all", ...ASSET_TYPES] as Array<PricingRuleAssetType | "all">).map((item) => (
                                                <Pressable
                                                    key={item}
                                                    onPress={() => setRuleAssetFilter(item)}
                                            style={[styles.chip, ruleAssetFilter === item && styles.chipActive]}
                                        >
                                            <Text style={[styles.chipText, ruleAssetFilter === item && styles.chipTextActive]}>{formatLabel(item)}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                                        <Text style={styles.filterSectionLabel}>Rule type</Text>
                                        <View style={styles.filterChipWrap}>
                                            {(["all", ...RULE_TYPES] as Array<PricingRuleType | "all">).map((item) => (
                                                <Pressable
                                                    key={item}
                                                    onPress={() => setRuleTypeFilter(item)}
                                            style={[styles.chip, ruleTypeFilter === item && styles.chipActive]}
                                        >
                                            <Text style={[styles.chipText, ruleTypeFilter === item && styles.chipTextActive]}>{formatLabel(item)}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                                        <Text style={styles.filterSectionLabel}>Branch</Text>
                                        <View style={styles.filterChipWrap}>
                                            <Pressable
                                                onPress={() => setRuleBranchFilter("all")}
                                                style={[styles.chip, ruleBranchFilter === "all" && styles.chipActive]}
                                            >
                                                <Text style={[styles.chipText, ruleBranchFilter === "all" && styles.chipTextActive]}>All branches</Text>
                                            </Pressable>
                                            {branches.map((branch) => (
                                                <Pressable
                                                    key={branch.id}
                                                    onPress={() => setRuleBranchFilter(branch.id)}
                                                    style={[styles.chip, ruleBranchFilter === branch.id && styles.chipActive]}
                                                >
                                                    <Text style={[styles.chipText, ruleBranchFilter === branch.id && styles.chipTextActive]}>{branch.branchDisplayName}</Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                    </View>
                                </AppModalBody>
                                <AppModalFooter style={styles.filterDrawerFooter}>
                                    <AppButton
                                        variant="ghost"
                                        onPress={() => {
                                            setRuleAssetFilter("all");
                                            setRuleTypeFilter("all");
                                            setRuleEnabledFilter("all");
                                            setRuleBranchFilter("all");
                                        }}
                                    >
                                        Reset
                                    </AppButton>
                                    <AppButton onPress={() => setShowRuleFilters(false)}>Done</AppButton>
                                </AppModalFooter>
                            </View>
                        </AppDrawer>
                    </>
                ) : null}

                {viewMode === "create" ? (
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Create Rule</Text>

                        <Text style={styles.fieldLabel}>Rule name</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            style={styles.input}
                            placeholder="Off-peak Courts"
                            placeholderTextColor={COLORS.muted}
                        />

                        <Text style={styles.fieldLabel}>Resource</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                            {ASSET_TYPES.map((item) => (
                                <Pressable
                                    key={item}
                                    onPress={() => setAssetType(item)}
                                    style={[styles.chip, assetType === item && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, assetType === item && styles.chipTextActive]}>
                                        {formatLabel(item)}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        <Text style={styles.fieldLabel}>Rule type</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                            {RULE_TYPES.map((item) => (
                                <Pressable
                                    key={item}
                                    onPress={() => setRuleType(item)}
                                    style={[styles.chip, ruleType === item && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, ruleType === item && styles.chipTextActive]}>
                                        {formatLabel(item)}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        <Text style={styles.fieldLabel}>Branch scope</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                            <Pressable
                                onPress={() => setSelectedBranchId("all")}
                                style={[styles.chip, selectedBranchId === "all" && styles.chipActive]}
                            >
                                <Text style={[styles.chipText, selectedBranchId === "all" && styles.chipTextActive]}>
                                    All branches
                                </Text>
                            </Pressable>
                            {branches.map((branch) => (
                                <Pressable
                                    key={branch.id}
                                    onPress={() => setSelectedBranchId(branch.id)}
                                    style={[styles.chip, selectedBranchId === branch.id && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, selectedBranchId === branch.id && styles.chipTextActive]}>
                                        {branch.branchDisplayName}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        <Text style={styles.fieldLabel}>Rule value</Text>
                        <TextInput
                            value={value}
                            onChangeText={setValue}
                            keyboardType="numeric"
                            style={styles.input}
                            placeholder={ruleType === "percentage_discount" ? "20" : "1800"}
                            placeholderTextColor={COLORS.muted}
                        />
                        <Text style={styles.fieldLabel}>Tier</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                            {tierOptions.map((option) => (
                                <Pressable
                                    key={`tier_${option.key || "all"}`}
                                    onPress={() => setTier(option.key)}
                                    style={[styles.chip, tier === option.key && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, tier === option.key && styles.chipTextActive]}>
                                        {option.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                        <Text style={styles.fieldLabel}>Surface / Mode</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                            {modeOptions.map((option) => (
                                <Pressable
                                    key={`mode_${option.key || "all"}`}
                                    onPress={() => setSurface(option.key)}
                                    style={[styles.chip, surface === option.key && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, surface === option.key && styles.chipTextActive]}>
                                        {option.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </ScrollView>

                        <View style={styles.row}>
                            <View style={styles.fieldColumn}>
                                <Text style={styles.fieldLabel}>Start time</Text>
                                <Pressable
                                    style={styles.dateField}
                                    onPress={() => {
                                        setTimeTarget("start_time");
                                        setTimeDraft(parseTimeToDraft(toTimeValue(timeStartAt)));
                                        setShowTimePicker(true);
                                    }}
                                >
                                    <AppIcon name="schedule" size="sm" tone="accent" />
                                    <Text style={styles.dateFieldText}>{toTimeDisplay(timeStartAt)}</Text>
                                </Pressable>
                            </View>
                            <View style={styles.fieldColumn}>
                                <Text style={styles.fieldLabel}>End time</Text>
                                <Pressable
                                    style={styles.dateField}
                                    onPress={() => {
                                        setTimeTarget("end_time");
                                        setTimeDraft(parseTimeToDraft(toTimeValue(timeEndAt)));
                                        setShowTimePicker(true);
                                    }}
                                >
                                    <AppIcon name="schedule" size="sm" tone="accent" />
                                    <Text style={styles.dateFieldText}>{toTimeDisplay(timeEndAt)}</Text>
                                </Pressable>
                            </View>
                        </View>
                        <View style={styles.row}>
                            <View style={styles.fieldColumn}>
                                <Text style={styles.fieldLabel}>From date</Text>
                                <Pressable
                                    style={styles.dateField}
                                    onPress={() => {
                                        setDateTarget("valid_from");
                                        const targetDate = validFromAt || new Date();
                                        setDateDraft(targetDate);
                                        const monthStart = new Date(targetDate);
                                        monthStart.setDate(1);
                                        monthStart.setHours(0, 0, 0, 0);
                                        setMonthCursor(monthStart);
                                        setShowDatePicker(true);
                                    }}
                                >
                                    <AppIcon name="event" size="sm" tone="accent" />
                                    <Text style={styles.dateFieldText}>
                                        {validFromAt ? toDateDisplay(validFromAt) : "Valid from"}
                                    </Text>
                                </Pressable>
                            </View>
                            <View style={styles.fieldColumn}>
                                <Text style={styles.fieldLabel}>To date</Text>
                                <Pressable
                                    style={styles.dateField}
                                    onPress={() => {
                                        setDateTarget("valid_to");
                                        const targetDate = validToAt || validFromAt || new Date();
                                        setDateDraft(targetDate);
                                        const monthStart = new Date(targetDate);
                                        monthStart.setDate(1);
                                        monthStart.setHours(0, 0, 0, 0);
                                        setMonthCursor(monthStart);
                                        setShowDatePicker(true);
                                    }}
                                >
                                    <AppIcon name="event" size="sm" tone="accent" />
                                    <Text style={styles.dateFieldText}>
                                        {validToAt ? toDateDisplay(validToAt) : "Valid to"}
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                        <View style={styles.row}>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.clearDateButton,
                                    pressed && styles.clearDateButtonPressed,
                                ]}
                                onPress={() => setValidFromAt(null)}
                            >
                                <AppIcon name="close" size={14} tone="accent" />
                                <Text style={styles.clearDateText}>Clear from</Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.clearDateButton,
                                    pressed && styles.clearDateButtonPressed,
                                ]}
                                onPress={() => setValidToAt(null)}
                            >
                                <AppIcon name="close" size={14} tone="accent" />
                                <Text style={styles.clearDateText}>Clear to</Text>
                            </Pressable>
                        </View>
                        <Text style={styles.fieldLabel}>Priority</Text>
                        <TextInput
                            value={priority}
                            onChangeText={setPriority}
                            keyboardType="numeric"
                            style={styles.input}
                            placeholder="10"
                            placeholderTextColor={COLORS.muted}
                        />

                        <Pressable
                            onPress={createRule}
                            disabled={saving || !pricingEngineReady}
                            style={[styles.saveButton, (saving || !pricingEngineReady) && styles.saveButtonDisabled]}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={styles.saveButtonText}>Create pricing rule</Text>
                            )}
                        </Pressable>
                    </View>
                ) : null}

                {viewMode === "rules" ? (
                    <View style={styles.listCard}>
                        <Text style={styles.formTitle}>Existing Rules</Text>
                        {loadingRules ? (
                            <ActivityIndicator size="small" color={COLORS.accent} />
                        ) : filteredRules.length === 0 ? (
                            <Text style={styles.emptyText}>No pricing rules yet.</Text>
                        ) : (
                            filteredRules.map((rule) => (
                                <PricingRuleRow
                                    key={rule.id}
                                    rule={rule}
                                    branchLabel={
                                        rule.branchId
                                            ? branchLabelById.get(rule.branchId) || "Unknown branch"
                                            : "All branches"
                                    }
                                    onToggle={toggleRule}
                                    onDelete={removeRule}
                                />
                            ))
                        )}
                    </View>
                ) : null}
            </ScrollView>

            <AppPickerSheet
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                sheetStyle={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
            >
                <View style={styles.pickerHeader}>
                    <Pressable onPress={() => setShowDatePicker(false)}>
                        <Text style={styles.pickerAction}>Cancel</Text>
                    </Pressable>
                    <Text style={styles.pickerTitle}>Select Date</Text>
                    <Pressable
                        onPress={() => {
                            if (dateDraft && dateTarget === "valid_from") {
                                const nextFrom = new Date(dateDraft);
                                nextFrom.setHours(0, 0, 0, 0);
                                setValidFromAt(nextFrom);
                                setValidToAt((prev) => {
                                    if (!prev) return prev;
                                    const normalizedPrev = new Date(prev);
                                    normalizedPrev.setHours(0, 0, 0, 0);
                                    return normalizedPrev.getTime() < nextFrom.getTime() ? nextFrom : normalizedPrev;
                                });
                            }
                            if (dateDraft && dateTarget === "valid_to") {
                                const nextTo = new Date(dateDraft);
                                nextTo.setHours(0, 0, 0, 0);
                                const normalizedFrom = validFromAt ? new Date(validFromAt) : null;
                                if (normalizedFrom) normalizedFrom.setHours(0, 0, 0, 0);
                                setValidToAt(
                                    normalizedFrom && nextTo.getTime() < normalizedFrom.getTime()
                                        ? normalizedFrom
                                        : nextTo,
                                );
                            }
                            setShowDatePicker(false);
                        }}
                    >
                        <Text style={styles.pickerAction}>Done</Text>
                    </Pressable>
                </View>

                        <View style={styles.calendarContainer}>
                            <View style={styles.calendarHeader}>
                                <Pressable
                                    style={styles.calendarNavButton}
                                    onPress={() => {
                                        const prev = new Date(monthCursor);
                                        prev.setMonth(prev.getMonth() - 1);
                                        setMonthCursor(prev);
                                    }}
                                >
                                    <Text style={styles.calendarNavText}>{"<"}</Text>
                                </Pressable>
                                <Text style={styles.calendarTitle}>{monthYearLabel}</Text>
                                <Pressable
                                    style={styles.calendarNavButton}
                                    onPress={() => {
                                        const next = new Date(monthCursor);
                                        next.setMonth(next.getMonth() + 1);
                                        setMonthCursor(next);
                                    }}
                                >
                                    <Text style={styles.calendarNavText}>{">"}</Text>
                                </Pressable>
                            </View>
                            <View style={styles.weekdayRow}>
                                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                                    <Text key={label} style={styles.weekdayLabel}>{label}</Text>
                                ))}
                            </View>
                            <View style={styles.calendarGrid}>
                                {Array.from({ length: firstWeekday }).map((_, idx) => (
                                    <View key={`empty-${idx}`} style={styles.dayCell} />
                                ))}
                                {Array.from({ length: daysInMonth }).map((_, idx) => {
                                    const dayNumber = idx + 1;
                                    const date = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), dayNumber);
                                    const selected = dateDraft ? isSameDay(dateDraft, date) : false;
                                    return (
                                        <Pressable
                                            key={`day-${dayNumber}`}
                                            style={[styles.dayCell, selected && styles.dayCellSelected]}
                                            onPress={() => setDateDraft(date)}
                                        >
                                            <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                                                {dayNumber}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>
            </AppPickerSheet>

            <AppDialog visible={Boolean(ruleToDelete)} onClose={() => setRuleToDelete(null)}>
                <AppModalHeader title="Delete rule" onClose={() => setRuleToDelete(null)} />
                <AppModalBody contentContainerStyle={{ gap: SPACING.md }}>
                    <Text style={styles.ruleMeta}>Delete "{ruleToDelete?.name}"?</Text>
                </AppModalBody>
                <AppModalFooter>
                    <View style={{ flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md }}>
                        <AppButton variant="secondary" style={{ flex: 1 }} onPress={() => setRuleToDelete(null)}>
                            Cancel
                        </AppButton>
                        <AppButton variant="danger" style={{ flex: 1 }} onPress={confirmRemoveRule} disabled={!ruleToDelete}>
                            Delete
                        </AppButton>
                    </View>
                </AppModalFooter>
            </AppDialog>

            <AppPickerSheet
                visible={showTimePicker}
                onClose={() => setShowTimePicker(false)}
                sheetStyle={[styles.pickerSheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
            >
                <View style={styles.pickerHeader}>
                    <Pressable onPress={() => setShowTimePicker(false)}>
                        <Text style={styles.pickerAction}>Cancel</Text>
                    </Pressable>
                    <Text style={styles.pickerTitle}>Select Time</Text>
                    <Pressable
                        onPress={() => {
                            const selectedTime = draftToTimeString(timeDraft);
                            const [hours, minutesValue] = selectedTime.split(":").map(Number);
                            if (timeTarget === "start_time") {
                                setTimeStartAt((prev) => {
                                    const next = new Date(prev);
                                    next.setHours(hours, minutesValue, 0, 0);
                                    return next;
                                });
                            }
                            if (timeTarget === "end_time") {
                                setTimeEndAt((prev) => {
                                    const next = new Date(prev);
                                    next.setHours(hours, minutesValue, 0, 0);
                                    return next;
                                });
                            }
                            setShowTimePicker(false);
                        }}
                    >
                        <Text style={styles.pickerAction}>Done</Text>
                    </Pressable>
                </View>
                <View style={styles.timePickerRow}>
                            <ScrollView
                                style={[styles.timeColumnScroll, { maxHeight: timeColumnMaxHeight }]}
                                contentContainerStyle={styles.timeColumnContent}
                                showsVerticalScrollIndicator={false}
                            >
                                {hours12.map((hour) => {
                                    const selected = timeDraft.hour === hour;
                                    return (
                                        <Pressable
                                            key={`h-${hour}`}
                                            style={[styles.timeOption, selected && styles.timeOptionActive]}
                                            onPress={() => setTimeDraft((prev) => ({ ...prev, hour }))}
                                        >
                                            <Text style={[styles.timeOptionText, selected && styles.timeOptionTextActive]}>
                                                {String(hour).padStart(2, "0")}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                            <ScrollView
                                style={[styles.timeColumnScroll, { maxHeight: timeColumnMaxHeight }]}
                                contentContainerStyle={styles.timeColumnContent}
                                showsVerticalScrollIndicator={false}
                            >
                                {minutes.map((minute) => {
                                    const selected = timeDraft.minute === minute;
                                    return (
                                        <Pressable
                                            key={`m-${minute}`}
                                            style={[styles.timeOption, selected && styles.timeOptionActive]}
                                            onPress={() => setTimeDraft((prev) => ({ ...prev, minute }))}
                                        >
                                            <Text style={[styles.timeOptionText, selected && styles.timeOptionTextActive]}>
                                                {String(minute).padStart(2, "0")}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                            <ScrollView
                                style={[styles.timeColumnScroll, { maxHeight: timeColumnMaxHeight }]}
                                contentContainerStyle={styles.timeColumnContent}
                                showsVerticalScrollIndicator={false}
                            >
                                {periods.map((period) => {
                                    const selected = timeDraft.period === period;
                                    return (
                                        <Pressable
                                            key={`p-${period}`}
                                            style={[styles.timeOption, selected && styles.timeOptionActive]}
                                            onPress={() => setTimeDraft((prev) => ({ ...prev, period }))}
                                        >
                                            <Text style={[styles.timeOptionText, selected && styles.timeOptionTextActive]}>
                                                {period}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        </View>
            </AppPickerSheet>
        </Screen>
    );
}
