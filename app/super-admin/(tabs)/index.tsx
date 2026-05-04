import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AppHeader from "../../../src/components/AppHeader";
import {
  AdminEmptyStateCard,
  AdminInfoLine,
  AdminListCard,
  AdminMetricCard,
  AdminQuickActionCard,
  AdminSectionHeader,
} from "../../../src/components/AdminSurface";
import { AppIcon } from "../../../src/components/AppIcon";
import { AppButton } from "../../../src/components/AppPrimitives";
import Screen from "../../../src/components/Screen";
import SegmentedTabs from "../../../src/components/SegmentedTabs";
import { useToast } from "../../../src/hooks/useToast";
import { useEntrance } from "../../../src/motion/useEntrance";
import { signOutUser } from "../../../src/services/convex/authService";
import {
  approveZone,
  getDashboardSummary,
  getReports,
  getUsers,
  getZones,
  reactivateZone,
  retryZoneMigration,
  SuperAdminReport,
  SuperAdminSummary,
  SuperAdminUser,
  suspendZone,
  updateUserRole,
} from "../../../src/services/convex/superAdminService";
import { logFlowEvent, useRouteLogger } from "../../../src/hooks/useRouteLogger";
import { Zone } from "../../../src/services/convex/zoneService";
import { COLORS, SPACING } from "../../../src/theme";
import { getZoneMigrationLabel } from "../../../src/utils/zoneLifecycle";
import {
  getReportStatusLabel,
  getReportStatusTone,
  getZoneStatusLabel,
  getZoneStatusTone,
} from "../../../src/utils/statusLabels";
import styles from "./index.styles";

type AdminTab = "overview" | "venues" | "users" | "reports";
type ZoneStatusFilter = "pending-review" | "approved_pending_migration" | "active" | "rejected" | "suspended";
type UserFilter = "all" | "player" | "zone";
type ReportFilter = "pending" | "reviewed" | "resolved";

function formatDate(value?: number) {
  if (!value) return "N/A";
  return new Date(value).toLocaleDateString();
}

export default function SuperAdminDashboard() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [zoneFilter, setZoneFilter] = useState<ZoneStatusFilter>("pending-review");
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [reportFilter, setReportFilter] = useState<ReportFilter>("pending");
  const [summary, setSummary] = useState<SuperAdminSummary | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [reports, setReports] = useState<SuperAdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { showToast } = useToast();
  const { animatedStyle: entranceStyle } = useEntrance({ axis: "y", distance: 12 });
  useRouteLogger("SuperAdminDashboard", { tab, zoneFilter, userFilter, reportFilter });

  const loadSummary = useCallback(async () => {
    const summaryRes = await getDashboardSummary();
    if (!summaryRes.ok) throw new Error(summaryRes.message);
    setSummary(summaryRes.data);
  }, []);

  const loadCurrentTabData = useCallback(async () => {
    if (tab === "overview") return;

    if (tab === "venues") {
      const zonesRes = await getZones(zoneFilter);
      if (!zonesRes.ok) throw new Error(zonesRes.message);
      setZones(zonesRes.data);
      return;
    }

    if (tab === "users") {
      const usersRes = await getUsers(userFilter === "all" ? undefined : userFilter);
      if (!usersRes.ok) throw new Error(usersRes.message);
      setUsers(usersRes.data);
      return;
    }

    const reportsRes = await getReports(reportFilter);
    if (!reportsRes.ok) throw new Error(reportsRes.message);
    setReports(reportsRes.data);
  }, [reportFilter, tab, userFilter, zoneFilter]);

  const refresh = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    logFlowEvent("SuperAdmin", "Refreshing dashboard data", {
      mode,
      tab,
      zoneFilter,
      userFilter,
      reportFilter,
    });
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);

    try {
      await Promise.all([loadSummary(), loadCurrentTabData()]);
    } catch (error: any) {
      showToast({
        type: "error",
        title: "Admin data failed",
        message: error?.message || "Unable to load super admin data.",
      });
    } finally {
      if (mode === "initial") setLoading(false);
      else setRefreshing(false);
    }
  }, [loadCurrentTabData, loadSummary, reportFilter, showToast, tab, userFilter, zoneFilter]);

  useEffect(() => {
    void refresh("initial");
  }, [refresh]);

  const tabItems = useMemo(() => ([
    { key: "overview" as const, label: "Overview" },
    { key: "venues" as const, label: "Venues", badge: (summary?.zones.pending || 0) + (summary?.zones.pendingMigration || 0) },
    { key: "users" as const, label: "Users", badge: summary?.counts.users || 0 },
    { key: "reports" as const, label: "Reports", badge: summary?.reports.pending || 0 },
  ]), [summary]);

  const handleLogout = async () => {
    await signOutUser();
    router.replace("/auth/login");
  };

  const handleZoneAction = async (
    zoneId: string,
    action: "approve" | "suspend" | "reactivate" | "reject" | "retry_migration",
  ) => {
    if (action === "reject") {
      logFlowEvent("SuperAdmin", "Opening venue rejection detail", { zoneId });
      router.push({ pathname: "/super-admin/request/[id]", params: { id: zoneId } });
      return;
    }

    if (action === "retry_migration") {
      setBusyKey(zoneId);
      logFlowEvent("SuperAdmin", "Retrying venue migration", { zoneId });
      const res = await retryZoneMigration(zoneId);
      setBusyKey(null);

      if (!res.ok) {
        showToast({ type: "error", title: "Retry failed", message: res.message });
        return;
      }

      showToast({
        type: "success",
        title: "Migration retried",
        message: "Venue migration ran again and the lifecycle has been refreshed.",
      });
      await refresh("refresh");
      return;
    }

    setBusyKey(zoneId);
    logFlowEvent("SuperAdmin", "Updating venue status", { zoneId, action });
    const res =
      action === "approve"
        ? await approveZone(zoneId)
        : action === "suspend"
          ? await suspendZone(zoneId)
          : await reactivateZone(zoneId);
    setBusyKey(null);

    if (!res.ok) {
      showToast({ type: "error", title: "Update failed", message: res.message });
      return;
    }

    showToast({
      type: "success",
      title: "Venue updated",
      message: action === "approve" || action === "reactivate"
        ? "Venue approval has been processed."
        : "Venue has been suspended.",
    });
    await refresh("refresh");
  };

  const handleUserRoleToggle = async (user: SuperAdminUser) => {
    setBusyKey(user.id);
    const nextRole = user.role === "super-admin" ? undefined : "super-admin";
    logFlowEvent("SuperAdmin", "Toggling user role", {
      userId: user.id,
      currentRole: user.role,
      nextRole: nextRole || "default",
    });
    const res = await updateUserRole(user.id, nextRole);
    setBusyKey(null);

    if (!res.ok) {
      showToast({ type: "error", title: "Role update failed", message: res.message });
      return;
    }

    showToast({
      type: "success",
      title: "Role updated",
      message: nextRole ? "User promoted to super admin." : "Super admin access removed.",
    });
    await refresh("refresh");
  };

  const rightAction = (
    <AppButton variant="ghost" size="sm" onPress={handleLogout} leadingIcon="logout" iconTone="danger">
      Sign Out
    </AppButton>
  );

  return (
    <Screen style={styles.screen} scroll={false}>
      <AppHeader
        title="Super Admin"
        subtitle="Moderate venues, users, and reports from one control plane."
        inlineTitle
        rightAction={rightAction}
      />

      <SegmentedTabs items={tabItems} value={tab} onChange={setTab} />

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      ) : (
        <ScrollView
          style={entranceStyle}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: SPACING.xxl + 24 + Math.max(insets.bottom, 18) },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => refresh("refresh")}
              tintColor={COLORS.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {tab === "overview" && summary ? (
            <OverviewTab
              summary={summary}
              onOpenPaymentsDebug={() => router.push("/super-admin/easypaisa")}
            />
          ) : null}
          {tab === "venues" ? (
            <VenuesTab
              filter={zoneFilter}
              onFilterChange={setZoneFilter}
              zones={zones}
              onOpen={(zoneId) =>
                router.push({ pathname: "/super-admin/request/[id]", params: { id: zoneId } })
              }
              onAction={handleZoneAction}
              busyKey={busyKey}
            />
          ) : null}
          {tab === "users" ? (
            <UsersTab
              filter={userFilter}
              onFilterChange={setUserFilter}
              users={users}
              onToggleRole={handleUserRoleToggle}
              busyKey={busyKey}
            />
          ) : null}
          {tab === "reports" ? (
            <ReportsTab
              filter={reportFilter}
              onFilterChange={setReportFilter}
              reports={reports}
            />
          ) : null}
        </ScrollView>
      )}
    </Screen>
  );
}

function OverviewTab({
  summary,
  onOpenPaymentsDebug,
}: {
  summary: SuperAdminSummary;
  onOpenPaymentsDebug: () => void;
}) {
  const cards = [
    { label: "Users", value: summary.counts.users, icon: "group" as const },
    { label: "Venues", value: summary.counts.zones, icon: "storefront" as const },
    { label: "Pending", value: summary.zones.pending, icon: "hourglass-top" as const },
    { label: "Reports", value: summary.reports.pending, icon: "report-problem" as const },
  ];

  return (
    <View style={styles.sectionStack}>
      <AdminQuickActionCard
        title="Payments Debug"
        description="Inspect Easypaisa REST, IPN, and hosted fallback payloads."
        icon="receipt-long"
        badgeLabel="Internal"
        onPress={onOpenPaymentsDebug}
      />

      <View style={styles.metricGrid}>
        {cards.map((card) => (
          <AdminMetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            style={styles.metricCard}
          />
        ))}
      </View>

      <AdminListCard title="User mix" subtitle="Account distribution across the live system.">
        <View style={styles.infoStack}>
          <AdminInfoLine label="Players" value={String(summary.users.players)} />
          <AdminInfoLine label="Zone admins" value={String(summary.users.zoneAdmins)} />
          <AdminInfoLine label="Super admins" value={String(summary.users.superAdmins)} />
        </View>
      </AdminListCard>

      <AdminListCard title="Venue lifecycle" subtitle="Moderation pipeline and migration readiness.">
        <View style={styles.infoStack}>
          <AdminInfoLine label="Pending review" value={String(summary.zones.pending)} />
          <AdminInfoLine label="Pending migration" value={String(summary.zones.pendingMigration)} />
          <AdminInfoLine label="Active" value={String(summary.zones.active)} />
          <AdminInfoLine label="Rejected" value={String(summary.zones.rejected)} />
          <AdminInfoLine label="Suspended" value={String(summary.zones.suspended)} />
        </View>
      </AdminListCard>

      <AdminListCard title="Moderation load" subtitle="Open operational work across reports and live matchrooms.">
        <View style={styles.infoStack}>
          <AdminInfoLine label="Pending reports" value={String(summary.reports.pending)} />
          <AdminInfoLine label="Reviewed reports" value={String(summary.reports.reviewed)} />
          <AdminInfoLine label="Resolved reports" value={String(summary.reports.resolved)} />
          <AdminInfoLine label="Open matchrooms" value={String(summary.matchrooms.open)} />
        </View>
      </AdminListCard>
    </View>
  );
}

function VenuesTab({
  filter,
  onFilterChange,
  zones,
  onOpen,
  onAction,
  busyKey,
}: {
  filter: ZoneStatusFilter;
  onFilterChange: (value: ZoneStatusFilter) => void;
  zones: Zone[];
  onOpen: (zoneId: string) => void;
  onAction: (zoneId: string, action: "approve" | "suspend" | "reactivate" | "reject" | "retry_migration") => void;
  busyKey: string | null;
}) {
  return (
    <View style={styles.sectionStack}>
      <AdminSectionHeader
        title="Venues"
        subtitle="Moderate onboarding, migration, and lifecycle state."
        compact
      />
      <SegmentedTabs
        items={[
          { key: "pending-review", label: "Pending" },
          { key: "approved_pending_migration", label: "Migrating" },
          { key: "active", label: "Active" },
          { key: "rejected", label: "Rejected" },
          { key: "suspended", label: "Suspended" },
        ]}
        value={filter}
        onChange={onFilterChange}
        compact
        style={styles.listTabs}
      />

      {zones.length === 0 ? (
        <AdminEmptyStateCard
          title="No venues here"
          description="Switch the status filter or wait for new submissions."
          icon="storefront"
        />
      ) : null}

      {zones.map((zone) => {
        const isBusy = busyKey === zone.id;
        const approveLabel = zone.status === "suspended" ? "Reactivate" : "Approve";
        return (
          <AdminListCard
            key={zone.id}
            title={zone.venueBrandName}
            subtitle={`${zone.ownerFullName || "Unknown owner"} • ${zone.primaryBranch?.city || zone.contactPhone || "No city"}`}
            statusLabel={getZoneStatusLabel(zone.status)}
            statusTone={getZoneStatusTone(zone.status)}
            onPress={() => onOpen(zone.id)}
            actions={
              <>
                <AppButton
                  variant="secondary"
                  size="sm"
                  onPress={(event) => {
                    event.stopPropagation();
                    onOpen(zone.id);
                  }}
                >
                  Review
                </AppButton>
                {zone.status !== "active" && zone.status !== "approved_pending_migration" ? (
                  <AppButton
                    size="sm"
                    loading={isBusy}
                    onPress={(event) => {
                      event.stopPropagation();
                      onAction(zone.id, zone.status === "suspended" ? "reactivate" : "approve");
                    }}
                  >
                    {approveLabel}
                  </AppButton>
                ) : null}
                {zone.status === "approved_pending_migration" ? (
                  <AppButton
                    size="sm"
                    loading={isBusy}
                    onPress={(event) => {
                      event.stopPropagation();
                      onAction(zone.id, "retry_migration");
                    }}
                  >
                    Retry Migration
                  </AppButton>
                ) : null}
                {zone.status === "active" ? (
                  <AppButton
                    variant="danger"
                    size="sm"
                    loading={isBusy}
                    onPress={(event) => {
                      event.stopPropagation();
                      onAction(zone.id, "suspend");
                    }}
                  >
                    Suspend
                  </AppButton>
                ) : null}
                {zone.status !== "rejected" ? (
                  <AppButton
                    variant="danger"
                    size="sm"
                    onPress={(event) => {
                      event.stopPropagation();
                      onAction(zone.id, "reject");
                    }}
                  >
                    Reject
                  </AppButton>
                ) : null}
              </>
            }
          >
            <View style={styles.infoStack}>
              <AdminInfoLine label="Submitted" value={formatDate(zone.createdAt)} />
              <AdminInfoLine label="Contact" value={zone.contactEmail || zone.contactPhone || "N/A"} />
              <AdminInfoLine label="Branches" value={String(zone.branches?.length || 0)} />
              <AdminInfoLine label="Migration" value={getZoneMigrationLabel(zone)} />
              {zone.migration?.lastError ? (
                <AdminInfoLine label="Last error" value={zone.migration.lastError} />
              ) : null}
            </View>
          </AdminListCard>
        );
      })}
    </View>
  );
}

function UsersTab({
  filter,
  onFilterChange,
  users,
  onToggleRole,
  busyKey,
}: {
  filter: UserFilter;
  onFilterChange: (value: UserFilter) => void;
  users: SuperAdminUser[];
  onToggleRole: (user: SuperAdminUser) => void;
  busyKey: string | null;
}) {
  return (
    <View style={styles.sectionStack}>
      <AdminSectionHeader
        title="Users"
        subtitle="Promote or revoke super-admin access without leaving the control plane."
        compact
      />
      <SegmentedTabs
        items={[
          { key: "all", label: "All" },
          { key: "player", label: "Players" },
          { key: "zone", label: "Zone Admins" },
        ]}
        value={filter}
        onChange={onFilterChange}
        compact
        style={styles.listTabs}
      />

      {users.length === 0 ? (
        <AdminEmptyStateCard
          title="No users found"
          description="There are no users for this filter yet."
          icon="group"
        />
      ) : null}

      {users.map((user) => {
        const isBusy = busyKey === user.id;
        const roleLabel = user.role === "super-admin"
          ? "Super Admin"
          : user.accountType === "zone"
            ? "Zone Admin"
            : "Player";
        const roleTone = user.role === "super-admin"
          ? "info"
          : user.accountType === "zone"
            ? "neutral"
            : "neutral";

        return (
          <AdminListCard
            key={user.id}
            title={user.fullName}
            subtitle={`@${user.username} • ${user.email}`}
            statusLabel={roleLabel}
            statusTone={roleTone}
            actions={
              <AppButton
                variant="secondary"
                size="sm"
                loading={isBusy}
                onPress={() => onToggleRole(user)}
              >
                {user.role === "super-admin" ? "Revoke Admin" : "Make Admin"}
              </AppButton>
            }
          >
            <View style={styles.infoStack}>
              <AdminInfoLine label="Phone" value={user.phone || "N/A"} />
              <AdminInfoLine label="Joined" value={formatDate(user.createdAt)} />
            </View>
          </AdminListCard>
        );
      })}
    </View>
  );
}

function ReportsTab({
  filter,
  onFilterChange,
  reports,
}: {
  filter: ReportFilter;
  onFilterChange: (value: ReportFilter) => void;
  reports: SuperAdminReport[];
}) {
  return (
    <View style={styles.sectionStack}>
      <AdminSectionHeader
        title="Reports"
        subtitle="Open moderation detail to move reports through the final workflow."
        compact
      />
      <SegmentedTabs
        items={[
          { key: "pending", label: "Pending" },
          { key: "reviewed", label: "Reviewed" },
          { key: "resolved", label: "Resolved" },
        ]}
        value={filter}
        onChange={onFilterChange}
        compact
        style={styles.listTabs}
      />

      {reports.length === 0 ? (
        <AdminEmptyStateCard
          title="No reports here"
          description="The moderation queue is empty for this status."
          icon="report-problem"
        />
      ) : null}

      {reports.map((report) => (
        <AdminListCard
          key={report.id}
          title={report.reason}
          subtitle={`${report.reporterName} • ${formatDate(report.createdAt)}`}
          statusLabel={getReportStatusLabel(report.status)}
          statusTone={getReportStatusTone(report.status)}
          onPress={() => router.push({ pathname: "/super-admin/report/[id]", params: { id: report.id } })}
          actions={
            <AppButton
              variant="secondary"
              size="sm"
              onPress={(event) => {
                event.stopPropagation();
                router.push({ pathname: "/super-admin/report/[id]", params: { id: report.id } });
              }}
            >
              Open Moderation
            </AppButton>
          }
        >
          <View style={styles.infoStack}>
            <AdminInfoLine label="Type" value={report.type.replaceAll("_", " ")} />
            {report.zoneName ? <AdminInfoLine label="Zone" value={report.zoneName} /> : null}
            {report.branchLabel ? <AdminInfoLine label="Branch" value={report.branchLabel} /> : null}
            {report.reportedUserName ? <AdminInfoLine label="User" value={report.reportedUserName} /> : null}
            {report.description ? <AdminInfoLine label="Detail" value={report.description} /> : null}
            {report.reviewerNote ? <AdminInfoLine label="Review note" value={report.reviewerNote} /> : null}
            {report.resolutionSummary ? <AdminInfoLine label="Resolution" value={report.resolutionSummary} /> : null}
          </View>
        </AdminListCard>
      ))}
    </View>
  );
}
