import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    Switch,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import AppHeader from "../../../src/components/AppHeader";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import Screen from "../../../src/components/Screen";
import { useAuth } from "../../../src/context/AuthContext";
import { useZoneData } from "../../../src/hooks/useZoneData";
import {
    createZonePricingRule,
    deleteZonePricingRule,
    setZonePricingRuleEnabled,
    subscribeZonePricingRules,
    type PricingRule,
    type PricingRuleAssetType,
    type PricingRuleType,
} from "../../../src/services/pricingRuleService";
import { subscribeZoneBranches, type ZoneBranch } from "../../../src/services/zoneAdminResourceService";
import { COLORS } from "../../../src/theme";
import styles from "./pricing.styles";

const ASSET_TYPES: PricingRuleAssetType[] = [
    "pc",
    "console",
    "futsal",
    "indoor_cricket",
    "padel",
    "pickleball",
];

const RULE_TYPES: PricingRuleType[] = ["percentage_discount", "fixed_override"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export default function ZonePricingModule() {
    const router = useRouter();
    const { user } = useAuth();
    const { zone } = useZoneData();

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
    const [showFilters, setShowFilters] = useState(true);
    const [priority, setPriority] = useState("0");
    const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
    const [viewMode, setViewMode] = useState<"create" | "rules">("create");
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [dateTarget, setDateTarget] = useState<null | "valid_from" | "valid_to">(null);
    const [timeTarget, setTimeTarget] = useState<null | "start_time" | "end_time">(null);
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
    const pricingEngineReady = Boolean(zone?.migration?.perBranchSeatModel);

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
        if (!zone?.id || !user?.uid) return;
        if (!pricingEngineReady) {
            Alert.alert("Migration required", "Run branch migration before creating pricing rules.");
            return;
        }
        if (!name.trim()) {
            Alert.alert("Missing name", "Enter a pricing rule name.");
            return;
        }

        const parsedValue = Number.parseFloat(value);
        const parsedPriority = Number.parseInt(priority, 10);
        if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
            Alert.alert("Invalid value", "Enter a valid numeric rule value.");
            return;
        }
        if (validFromAt && validToAt && validFromAt.getTime() > validToAt.getTime()) {
            Alert.alert("Invalid dates", "From date must be before or equal to To date.");
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
                daysOfWeek,
                timeStart: toTimeValue(timeStartAt),
                timeEnd: toTimeValue(timeEndAt),
                validFrom: validFromAt ? toDateValue(validFromAt) : null,
                validTo: validToAt ? toDateValue(validToAt) : null,
                priority: Number.isFinite(parsedPriority) ? parsedPriority : 0,
            },
            user.uid,
        );
        setSaving(false);

        if (!result.ok) {
            Alert.alert("Create failed", result.message);
            return;
        }

        setName("");
        setTier("");
        setSurface("");
        setValue("");
        setValidFromAt(null);
        setValidToAt(null);
        setPriority("0");
        Alert.alert("Rule created", "Pricing rule is now active.");
    };

    const toggleRule = async (rule: PricingRule, enabled: boolean) => {
        if (!zone?.id) return;
        const result = await setZonePricingRuleEnabled(zone.id, rule.id, enabled);
        if (!result.ok) {
            Alert.alert("Update failed", result.message);
        }
    };

    const removeRule = async (rule: PricingRule) => {
        if (!zone?.id) return;
        Alert.alert("Delete rule", `Delete "${rule.name}"?`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    const result = await deleteZonePricingRule(zone.id, rule.id);
                    if (!result.ok) {
                        Alert.alert("Delete failed", result.message);
                    }
                },
            },
        ]);
    };

    const summary = useMemo(() => {
        const enabled = rules.filter((item) => item.isEnabled).length;
        return { total: rules.length, enabled };
    }, [rules]);
    const migrationNotice = !pricingEngineReady
        ? "Run branch migration in Venue Settings to enable live pricing rules."
        : null;
    const hours12 = useMemo(() => Array.from({ length: 12 }).map((_, index) => index + 1), []);
    const minutes = useMemo(() => [0, 30], []);
    const periods: Array<"AM" | "PM"> = ["AM", "PM"];
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
                    { key: "rules", label: "Rules", badge: rules.length },
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
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryValue}>{summary.enabled}/{summary.total}</Text>
                    <Text style={styles.summaryLabel}>Enabled rules</Text>
                </View>

                {viewMode === "create" ? (
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Create Rule</Text>
                        <Pressable
                            style={styles.filtersToggle}
                            onPress={() => setShowFilters((prev) => !prev)}
                        >
                            <View style={styles.filtersToggleLeft}>
                                <MaterialIcons name="tune" size={16} color={COLORS.accent} />
                                <Text style={styles.filtersToggleText}>Rule Scope & Schedule</Text>
                            </View>
                            <MaterialIcons
                                name={showFilters ? "expand-less" : "expand-more"}
                                size={18}
                                color={COLORS.textSecondary}
                            />
                        </Pressable>

                        <Text style={styles.fieldLabel}>Rule name</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            style={styles.input}
                            placeholder="Off-peak Courts"
                            placeholderTextColor={COLORS.muted}
                        />

                        {showFilters ? (
                            <>
                                <Text style={styles.fieldLabel}>Asset type</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                                    {ASSET_TYPES.map((item) => (
                                        <Pressable
                                            key={item}
                                            onPress={() => setAssetType(item)}
                                            style={[styles.chip, assetType === item && styles.chipActive]}
                                        >
                                            <Text style={[styles.chipText, assetType === item && styles.chipTextActive]}>
                                                {item}
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
                                                {item}
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
                            </>
                        ) : null}

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
                        <TextInput
                            value={tier}
                            onChangeText={setTier}
                            style={styles.input}
                            placeholder="regular"
                            placeholderTextColor={COLORS.muted}
                        />
                        <Text style={styles.fieldLabel}>Surface / Mode</Text>
                        <TextInput
                            value={surface}
                            onChangeText={setSurface}
                            style={styles.input}
                            placeholder="5v5"
                            placeholderTextColor={COLORS.muted}
                        />

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
                                    <MaterialIcons name="schedule" size={16} color={COLORS.accent} />
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
                                    <MaterialIcons name="schedule" size={16} color={COLORS.accent} />
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
                                    <MaterialIcons name="event" size={16} color={COLORS.accent} />
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
                                    <MaterialIcons name="event" size={16} color={COLORS.accent} />
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
                                <MaterialIcons name="close" size={14} color={COLORS.accent} />
                                <Text style={styles.clearDateText}>Clear from</Text>
                            </Pressable>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.clearDateButton,
                                    pressed && styles.clearDateButtonPressed,
                                ]}
                                onPress={() => setValidToAt(null)}
                            >
                                <MaterialIcons name="close" size={14} color={COLORS.accent} />
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

                        <Text style={styles.fieldLabel}>Active days</Text>
                        <View style={styles.daysWrap}>
                            {DAY_LABELS.map((label, dayIndex) => {
                                const selected = daysOfWeek.includes(dayIndex);
                                return (
                                    <Pressable
                                        key={label}
                                        style={[styles.dayChip, selected && styles.dayChipActive]}
                                        onPress={() =>
                                            setDaysOfWeek((prev) =>
                                                prev.includes(dayIndex)
                                                    ? prev.filter((item) => item !== dayIndex)
                                                    : [...prev, dayIndex].sort((a, b) => a - b),
                                            )
                                        }
                                    >
                                        <Text style={[styles.dayChipText, selected && styles.dayChipTextActive]}>
                                            {label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

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
                        ) : rules.length === 0 ? (
                            <Text style={styles.emptyText}>No pricing rules yet.</Text>
                        ) : (
                            rules.map((rule) => (
                                <View key={rule.id} style={styles.ruleRow}>
                                    <View style={styles.ruleBody}>
                                        <Text style={styles.ruleName}>{rule.name}</Text>
                                        <Text style={styles.ruleMeta}>
                                            {rule.assetType} | {rule.ruleType} | value {rule.value}
                                        </Text>
                                        <Text style={styles.ruleMeta}>
                                            {rule.timeStart}-{rule.timeEnd} | priority {rule.priority}
                                        </Text>
                                        {rule.branchId ? (
                                            <Text style={styles.ruleMeta}>branch: {rule.branchId}</Text>
                                        ) : (
                                            <Text style={styles.ruleMeta}>branch: all</Text>
                                        )}
                                    </View>
                                    <View style={styles.ruleActions}>
                                        <Switch
                                            value={rule.isEnabled}
                                            onValueChange={(enabled) => toggleRule(rule, enabled)}
                                            thumbColor={rule.isEnabled ? COLORS.accent : COLORS.muted}
                                            trackColor={{ false: COLORS.cardBorder, true: "rgba(66, 165, 245, 0.4)" }}
                                        />
                                        <Pressable onPress={() => removeRule(rule)} style={styles.deleteButton}>
                                            <Text style={styles.deleteText}>Delete</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                ) : null}
            </ScrollView>

            <Modal
                visible={showDatePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDatePicker(false)}
            >
                <View style={styles.pickerOverlay}>
                    <TouchableWithoutFeedback onPress={() => setShowDatePicker(false)}>
                        <View style={styles.pickerBackdrop} />
                    </TouchableWithoutFeedback>
                    <View style={styles.pickerSheet}>
                        <View style={styles.pickerHandle} />
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
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showTimePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowTimePicker(false)}
            >
                <View style={styles.pickerOverlay}>
                    <TouchableWithoutFeedback onPress={() => setShowTimePicker(false)}>
                        <View style={styles.pickerBackdrop} />
                    </TouchableWithoutFeedback>
                    <View style={styles.pickerSheet}>
                        <View style={styles.pickerHandle} />
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
                            <View style={styles.timeColumn}>
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
                            </View>
                            <View style={styles.timeColumn}>
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
                            </View>
                            <View style={styles.timeColumn}>
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
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>
        </Screen>
    );
}
