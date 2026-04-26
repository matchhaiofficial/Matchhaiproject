import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton } from "../../../components/AppPrimitives";
import {
  AppDrawer,
  AppModalBody,
  AppModalFooter,
  AppModalHeader,
} from "../../../components/AppModalPrimitives";
import { COLORS, FONTS, SPACING, TEXT_SIZES } from "../../../theme";
import {
  COMPETITIVE_LEVEL_OPTIONS,
  CS2_SKILL_LEVELS,
  DISCOVER_GAMES,
  DISCOVER_VENUE_TYPES,
  getDrawerSubtitle,
  getMatchroomFormatOptions,
  getMatchroomSeriesOptions,
  getPlayerSkillOptions,
  getRoleOptions,
  getTimelineOptions,
  getZoneGameOptions,
  hasCs2SkillFilter,
  hasMatchroomFormatFilter,
  hasMatchroomOversFilter,
  hasMatchroomRoleFilter,
  hasMatchroomSeriesFilter,
  hasPlatformFilter,
  hasPlayerRoleFilter,
  hasQuestionnaireSkillFilter,
  LOCATION_OPTIONS,
  OVERS_OPTIONS,
  PLATFORM_OPTIONS,
  PLAYER_AVAILABILITY_OPTIONS,
  PLAYER_COMPETITIVE_INTENT_OPTIONS,
  PROXIMITY_OPTIONS,
  QUESTIONNAIRE_SKILL_LEVELS,
  ROOM_PRICE_RANGE_OPTIONS,
  ROOM_SLOT_OPTIONS,
  SKILL_LEVEL_OPTIONS,
  TEAM_AVAILABILITY_OPTIONS,
  TEAM_SIZE_OPTIONS,
  VENUE_PRICE_RANGE_OPTIONS,
  type DiscoverFiltersState,
  type MatchroomFilters,
  type PlayerFilters,
  type TeamFilters,
  type ZoneFilters,
} from "../filterConfig";
import type { DiscoverSegment } from "../types";
import { DiscoverFilterRow } from "./DiscoverShared";

const DRAWER_WIDTH = Math.min(420, Math.round(Dimensions.get("window").width * 0.94));

type DiscoverFilterDrawerProps = {
  activeCount: number;
  activeSegment: DiscoverSegment;
  filters: DiscoverFiltersState;
  onClose: () => void;
  onReset: () => void;
  onUpdateMatchrooms: (patch: Partial<MatchroomFilters>) => void;
  onUpdatePlayers: (patch: Partial<PlayerFilters>) => void;
  onUpdateTeams: (patch: Partial<TeamFilters>) => void;
  onUpdateZones: (patch: Partial<ZoneFilters>) => void;
  visible: boolean;
};

function FilterSummary({ count }: { count: number }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>Active filters</Text>
      <View style={[styles.summaryBadge, count === 0 && styles.summaryBadgeMuted]}>
        <Text style={[styles.summaryBadgeText, count === 0 && styles.summaryBadgeTextMuted]}>
          {count}
        </Text>
      </View>
    </View>
  );
}

export default function DiscoverFilterDrawer({
  activeCount,
  activeSegment,
  filters,
  onClose,
  onReset,
  onUpdateMatchrooms,
  onUpdatePlayers,
  onUpdateTeams,
  onUpdateZones,
  visible,
}: DiscoverFilterDrawerProps) {
  const insets = useSafeAreaInsets();
  const subtitle = getDrawerSubtitle(activeSegment, filters);

  return (
    <AppDrawer visible={visible} onClose={onClose} drawerStyle={styles.drawer}>
      <View style={[styles.drawerContent, { paddingTop: Math.max(insets.top, SPACING.lg) }]}>
        <AppModalHeader title="Filters" subtitle={subtitle} onClose={onClose} compact />
        <AppModalBody scroll contentContainerStyle={styles.bodyContent}>
          <FilterSummary count={activeCount} />

          {activeSegment === "matchrooms" ? (
            <MatchroomFiltersView
              filters={filters.matchrooms}
              onChange={onUpdateMatchrooms}
            />
          ) : null}

          {activeSegment === "players" ? (
            <PlayerFiltersView filters={filters.players} onChange={onUpdatePlayers} />
          ) : null}

          {activeSegment === "teams" ? (
            <TeamFiltersView filters={filters.teams} onChange={onUpdateTeams} />
          ) : null}

          {activeSegment === "zones" ? (
            <ZoneFiltersView filters={filters.zones} onChange={onUpdateZones} />
          ) : null}
        </AppModalBody>
        <AppModalFooter style={styles.footer}>
          <View style={styles.footerRow}>
            <AppButton
              variant="secondary"
              style={styles.footerButton}
              onPress={onReset}
              disabled={activeCount === 0}
            >
              Reset
            </AppButton>
            <AppButton style={styles.footerButton} onPress={onClose}>
              Done
            </AppButton>
          </View>
        </AppModalFooter>
      </View>
    </AppDrawer>
  );
}

function MatchroomFiltersView({
  filters,
  onChange,
}: {
  filters: MatchroomFilters;
  onChange: (patch: Partial<MatchroomFilters>) => void;
}) {
  return (
    <>
      <DiscoverFilterRow
        label="Game"
        options={DISCOVER_GAMES}
        selected={filters.game}
        onSelect={(value) => onChange({ game: value as MatchroomFilters["game"] })}
      />
      <DiscoverFilterRow
        label="Area"
        options={LOCATION_OPTIONS}
        selected={filters.area}
        onSelect={(value) => onChange({ area: value })}
      />
      <DiscoverFilterRow
        label="Timeline"
        options={getTimelineOptions()}
        selected={filters.timeline}
        onSelect={(value) => onChange({ timeline: value as MatchroomFilters["timeline"] })}
      />
      <DiscoverFilterRow
        label="Availability"
        options={ROOM_SLOT_OPTIONS}
        selected={filters.openSlots}
        onSelect={(value) => onChange({ openSlots: value })}
      />
      <DiscoverFilterRow
        label="Price Range"
        options={ROOM_PRICE_RANGE_OPTIONS}
        selected={filters.priceRange}
        onSelect={(value) => onChange({ priceRange: value })}
      />
      <DiscoverFilterRow
        label="Skill Level"
        options={SKILL_LEVEL_OPTIONS}
        selected={filters.skillLevel}
        onSelect={(value) => onChange({ skillLevel: value })}
      />
      {hasCs2SkillFilter(filters.game) ? (
        <DiscoverFilterRow
          label="FACEIT Level"
          options={CS2_SKILL_LEVELS}
          selected={filters.skill}
          onSelect={(value) => onChange({ skill: value })}
        />
      ) : null}
      {hasQuestionnaireSkillFilter(filters.game) ? (
        <DiscoverFilterRow
          label="Skill"
          options={QUESTIONNAIRE_SKILL_LEVELS}
          selected={filters.skill}
          onSelect={(value) => onChange({ skill: value })}
        />
      ) : null}
      {hasMatchroomFormatFilter(filters.game) ? (
        <DiscoverFilterRow
          label="Format"
          options={getMatchroomFormatOptions(filters.game)}
          selected={filters.format}
          onSelect={(value) => onChange({ format: value })}
        />
      ) : null}
      {hasMatchroomRoleFilter(filters.game) ? (
        <DiscoverFilterRow
          label={filters.game === "futsal" ? "Position" : "Role"}
          options={getRoleOptions(filters.game)}
          selected={filters.role}
          onSelect={(value) => onChange({ role: value })}
        />
      ) : null}
      {hasMatchroomSeriesFilter(filters.game) ? (
        <DiscoverFilterRow
          label="Series"
          options={getMatchroomSeriesOptions(filters.game)}
          selected={filters.series}
          onSelect={(value) => onChange({ series: value })}
        />
      ) : null}
      {hasMatchroomOversFilter(filters.game) ? (
        <DiscoverFilterRow
          label="Overs"
          options={OVERS_OPTIONS}
          selected={filters.overs}
          onSelect={(value) => onChange({ overs: value })}
        />
      ) : null}
    </>
  );
}

function PlayerFiltersView({
  filters,
  onChange,
}: {
  filters: PlayerFilters;
  onChange: (patch: Partial<PlayerFilters>) => void;
}) {
  const skillOptions = getPlayerSkillOptions(filters.game);

  return (
    <>
      <DiscoverFilterRow
        label="Game"
        options={DISCOVER_GAMES}
        selected={filters.game}
        onSelect={(value) => onChange({ game: value as PlayerFilters["game"] })}
      />
      <DiscoverFilterRow
        label="Availability"
        options={PLAYER_AVAILABILITY_OPTIONS}
        selected={filters.availability}
        onSelect={(value) => onChange({ availability: value })}
      />
      <DiscoverFilterRow
        label="Area"
        options={LOCATION_OPTIONS}
        selected={filters.area}
        onSelect={(value) => onChange({ area: value })}
      />
      <DiscoverFilterRow
        label="Competitive Intent"
        options={PLAYER_COMPETITIVE_INTENT_OPTIONS}
        selected={filters.competitiveIntent}
        onSelect={(value) => onChange({ competitiveIntent: value })}
      />
      {skillOptions.length > 0 ? (
        <DiscoverFilterRow
          label={filters.game === "cs2" ? "Skill (FACEIT)" : "Skill"}
          options={skillOptions}
          selected={filters.skill}
          onSelect={(value) => onChange({ skill: value })}
        />
      ) : null}
      {hasPlayerRoleFilter(filters.game) ? (
        <DiscoverFilterRow
          label={filters.game === "futsal" ? "Position" : "Role"}
          options={getRoleOptions(filters.game)}
          selected={filters.role}
          onSelect={(value) => onChange({ role: value })}
        />
      ) : null}
      {hasPlatformFilter(filters.game) ? (
        <DiscoverFilterRow
          label="Platform"
          options={PLATFORM_OPTIONS}
          selected={filters.platform}
          onSelect={(value) => onChange({ platform: value })}
        />
      ) : null}
    </>
  );
}

function TeamFiltersView({
  filters,
  onChange,
}: {
  filters: TeamFilters;
  onChange: (patch: Partial<TeamFilters>) => void;
}) {
  if (filters.mode === "my") {
    return (
      <View style={styles.emptyState}>
        <DiscoverFilterRow
          label="Game"
          options={DISCOVER_GAMES}
          selected={filters.game}
          onSelect={(value) => onChange({ game: value as TeamFilters["game"] })}
        />
        <Text style={styles.emptyTitle}>No additional filters for My Teams</Text>
        <Text style={styles.emptyText}>
          My Teams only keeps game selection here. Secondary team filters stay disabled in this mode.
        </Text>
      </View>
    );
  }

  return (
    <>
      <DiscoverFilterRow
        label="Game"
        options={DISCOVER_GAMES}
        selected={filters.game}
        onSelect={(value) => onChange({ game: value as TeamFilters["game"] })}
      />
      <DiscoverFilterRow
        label="Availability"
        options={TEAM_AVAILABILITY_OPTIONS}
        selected={filters.availability}
        onSelect={(value) => onChange({ availability: value })}
      />
      <DiscoverFilterRow
        label="Area"
        options={LOCATION_OPTIONS}
        selected={filters.area}
        onSelect={(value) => onChange({ area: value })}
      />
      <DiscoverFilterRow
        label="Team Size"
        options={TEAM_SIZE_OPTIONS}
        selected={filters.teamSize}
        onSelect={(value) => onChange({ teamSize: value })}
      />
      <DiscoverFilterRow
        label="Competitive Intent"
        options={COMPETITIVE_LEVEL_OPTIONS}
        selected={filters.competitiveIntent}
        onSelect={(value) => onChange({ competitiveIntent: value })}
      />
    </>
  );
}

function ZoneFiltersView({
  filters,
  onChange,
}: {
  filters: ZoneFilters;
  onChange: (patch: Partial<ZoneFilters>) => void;
}) {
  const gameOptions = getZoneGameOptions(filters.venueType);

  return (
    <>
      <DiscoverFilterRow
        label="Venue Type"
        options={DISCOVER_VENUE_TYPES}
        selected={filters.venueType}
        onSelect={(value) => onChange({ venueType: value as ZoneFilters["venueType"] })}
      />
      <DiscoverFilterRow
        label="Location"
        options={PROXIMITY_OPTIONS}
        selected={filters.proximity}
        onSelect={(value) => onChange({ proximity: value })}
      />
      <DiscoverFilterRow
        label="Area"
        options={LOCATION_OPTIONS}
        selected={filters.area}
        onSelect={(value) => onChange({ area: value })}
      />
      <DiscoverFilterRow
        label="Price Range"
        options={VENUE_PRICE_RANGE_OPTIONS}
        selected={filters.priceRange}
        onSelect={(value) => onChange({ priceRange: value })}
      />
      {filters.venueType !== "all" ? (
        <>
          <DiscoverFilterRow
            label={filters.venueType === "zones" ? "Game" : "Sport"}
            options={gameOptions}
            selected={filters.gameOrSport}
            onSelect={(value) => onChange({ gameOrSport: value })}
          />
          {hasPlatformFilter(filters.gameOrSport) ? (
            <DiscoverFilterRow
              label="Platform"
              options={PLATFORM_OPTIONS}
              selected={filters.platform}
              onSelect={(value) => onChange({ platform: value })}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  drawer: {
    width: DRAWER_WIDTH,
    flex: 1,
  },
  drawerContent: {
    flex: 1,
  },
  bodyContent: {
    gap: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.overlayLight,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.body,
  },
  summaryBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(66,165,245,0.16)",
    borderWidth: 1,
    borderColor: "rgba(66,165,245,0.28)",
    paddingHorizontal: SPACING.sm,
  },
  summaryBadgeMuted: {
    backgroundColor: COLORS.overlayMedium,
    borderColor: COLORS.cardBorder,
  },
  summaryBadgeText: {
    color: COLORS.accent,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.label,
  },
  summaryBadgeTextMuted: {
    color: COLORS.textSecondary,
  },
  footer: {
    backgroundColor: COLORS.cardDark,
  },
  footerRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  footerButton: {
    flex: 1,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.overlayLight,
    borderRadius: 16,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  emptyTitle: {
    color: COLORS.text,
    fontFamily: FONTS.heading,
    fontSize: TEXT_SIZES.subheading,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontFamily: FONTS.body,
    fontSize: TEXT_SIZES.body,
    lineHeight: 20,
  },
});
