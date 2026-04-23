import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import AppHeader from "../../src/components/AppHeader";
import {
  AdminEmptyStateCard,
  AdminInfoLine,
  AdminListCard,
  AdminSectionHeader,
} from "../../src/components/AdminSurface";
import { AppButton, AppCard } from "../../src/components/AppPrimitives";
import Screen from "../../src/components/Screen";
import { useToast } from "../../src/hooks/useToast";
import {
  EasypaisaAdminTransaction,
  getEasypaisaTransactions,
} from "../../src/services/convex/superAdminService";
import { COLORS } from "../../src/theme";
import styles from "./easypaisa.styles";

function formatDateTime(value?: number | null) {
  if (!value) return "N/A";
  return new Date(value).toLocaleString();
}

function formatPayload(value: unknown) {
  if (!value) return "No data";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Unable to render payload";
  }
}

function getStatusTone(status?: string | null): "neutral" | "info" | "success" | "warning" | "danger" {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid") return "success";
  if (normalized === "pending" || normalized === "created") return "warning";
  if (normalized === "expired" || normalized === "failed" || normalized === "cancelled") return "danger";
  return "neutral";
}

export default function EasypaisaDebugScreen() {
  const [transactions, setTransactions] = useState<EasypaisaAdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const { showToast } = useToast();

  const loadTransactions = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);

    try {
      const result = await getEasypaisaTransactions(searchValue || undefined);
      if (!result.ok) {
        throw new Error(result.message);
      }
      setTransactions(result.data);
    } catch (error: any) {
      showToast({
        type: "error",
        title: "Debug load failed",
        message: error?.message || "Unable to load Easypaisa transactions.",
      });
    } finally {
      if (mode === "initial") setLoading(false);
      else setRefreshing(false);
    }
  }, [searchValue, showToast]);

  useEffect(() => {
    void loadTransactions("initial");
  }, [loadTransactions]);

  const summaryText = useMemo(() => {
    if (!transactions.length) return "No Easypaisa transactions match the current filter.";
    return `${transactions.length} recent transaction${transactions.length === 1 ? "" : "s"} loaded.`;
  }, [transactions]);

  return (
    <Screen style={styles.screen} scroll={false}>
      <AppHeader
        title="Easypaisa Debug"
        subtitle="Inspect REST, IPN, and hosted fallback payloads for recent payment transactions."
        onBack={() => router.back()}
        rightAction={
          <AppButton
            variant="secondary"
            size="sm"
            onPress={() => loadTransactions("refresh")}
            leadingIcon="refresh"
          >
            Refresh
          </AppButton>
        }
      />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadTransactions("refresh")}
              tintColor={COLORS.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <AppCard variant="elevated" style={styles.controlsCard}>
            <AdminSectionHeader
              title="Filters"
              subtitle={summaryText}
              compact
            />
            <TextInput
              value={searchInput}
              onChangeText={setSearchInput}
              placeholder="Filter by orderRefNum"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.searchInput}
            />
            <View style={styles.actionsRow}>
              <AppButton
                size="sm"
                onPress={() => {
                  setSearchValue(searchInput.trim());
                }}
              >
                Apply Filter
              </AppButton>
              <AppButton
                variant="secondary"
                size="sm"
                onPress={() => {
                  setSearchInput("");
                  setSearchValue("");
                }}
              >
                Clear
              </AppButton>
            </View>
            <Text style={styles.helperText}>
              This view reads the latest `providerPayload.rest`, `providerPayload.ipn`, and `providerPayload.hosted`
              slices for each payment transaction.
            </Text>
          </AppCard>

          {transactions.length === 0 ? (
            <AdminEmptyStateCard
              title="No Easypaisa transactions"
              description="Try a different order reference or refresh after a new payment attempt."
              icon="receipt-long"
            />
          ) : null}

          {transactions.map((transaction) => (
            <AdminListCard
              key={transaction.id}
              title={transaction.orderRefNum}
              subtitle={`${transaction.kind.replace("_", " ")} • ${transaction.amount} ${transaction.currency}`}
              statusLabel={transaction.status}
              statusTone={getStatusTone(transaction.status)}
            >
              <View style={styles.infoStack}>
                <AdminInfoLine label="Internal status" value={transaction.status} />
                <AdminInfoLine label="Provider status" value={transaction.providerStatus || "N/A"} />
                <AdminInfoLine label="Provider description" value={transaction.providerDescription || "N/A"} />
                <AdminInfoLine label="Provider reference" value={transaction.providerReference || "N/A"} />
                <AdminInfoLine label="Processed at" value={formatDateTime(transaction.processedAt)} />
                <AdminInfoLine label="Last error" value={transaction.lastError || "None"} />
                <AdminInfoLine label="Callbacks" value={String(transaction.callbackCount || 0)} />
                <AdminInfoLine label="Last sync" value={formatDateTime(transaction.providerPayload?.lastSyncAt)} />
                <AdminInfoLine label="Flow" value={transaction.providerPayload?.flow || "N/A"} />
                <AdminInfoLine label="Created" value={formatDateTime(transaction.createdAt)} />
                <AdminInfoLine label="Updated" value={formatDateTime(transaction.updatedAt)} />
              </View>

              <View style={styles.payloadSection}>
                <Text style={styles.payloadLabel}>providerPayload.rest</Text>
                <View style={styles.payloadBox}>
                  <Text selectable style={styles.payloadText}>
                    {formatPayload(transaction.providerPayload?.rest)}
                  </Text>
                </View>
              </View>

              <View style={styles.payloadSection}>
                <Text style={styles.payloadLabel}>providerPayload.ipn</Text>
                <View style={styles.payloadBox}>
                  <Text selectable style={styles.payloadText}>
                    {formatPayload(transaction.providerPayload?.ipn)}
                  </Text>
                </View>
              </View>

              <View style={styles.payloadSection}>
                <Text style={styles.payloadLabel}>providerPayload.hosted</Text>
                <View style={styles.payloadBox}>
                  <Text selectable style={styles.payloadText}>
                    {formatPayload(transaction.providerPayload?.hosted)}
                  </Text>
                </View>
              </View>
            </AdminListCard>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
