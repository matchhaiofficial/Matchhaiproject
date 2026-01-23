import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { CS2_ROLES, INDOOR_CRICKET_BATTING_ORDER, INDOOR_CRICKET_BATTING_STYLES, INDOOR_CRICKET_BOWLING_ORDER, INDOOR_CRICKET_BOWLING_STYLES, INDOOR_CRICKET_ROLES, PADEL_ROLES, PICKLEBALL_ROLES } from '../../../../constants/profileOptions';
import { COLORS } from '../../../../src/theme';
import styles from '../create.styles';

// Import from userService - using the existing interface
import type { UserProfile } from '../../../../src/services/userService';

interface RoleAutoFillProps {
    gameKey: string;
    profile: UserProfile | null;
    selectedRole?: string | null;
    onRoleChange?: (role: string) => void;
    formData: Record<string, any>;
    onChange: (field: string, value: any) => void;
}

export default function RoleAutoFill({ gameKey, profile, selectedRole, onRoleChange, formData, onChange }: RoleAutoFillProps) {
    const [isEditing, setIsEditing] = useState(false);

    if (!profile) return null;

    // CS2 & Futsal & Indoor Cricket & Padel Specific Logic with Override
    if (gameKey === 'cs2' || gameKey === 'futsal' || gameKey === 'indoorCricket' || gameKey === 'padel' || gameKey === 'pickleball') {
        const hasRole = !!selectedRole;
        const showAll = isEditing || !hasRole;
        const rolesList = gameKey === 'cs2'
            ? CS2_ROLES
            : (gameKey === 'indoorCricket'
                ? INDOOR_CRICKET_ROLES
                : (gameKey === 'padel'
                    ? PADEL_ROLES
                    : (gameKey === 'pickleball'
                        ? PICKLEBALL_ROLES
                        : ['Goalkeeper', 'Defender', 'Midfielder', 'Winger', 'Striker'])));

        return (
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>Your role in this match</Text>

                {showAll ? (
                    <>
                        {!hasRole && (
                            <Text style={styles.creationHelperText}>
                                Pick what you'll mainly play this match
                            </Text>
                        )}
                        <View style={styles.chipRow}>
                            {rolesList.map((role) => {
                                const isActive = selectedRole === role;
                                return (
                                    <TouchableOpacity
                                        key={role}
                                        style={[styles.optionChip, isActive && styles.optionChipActive]}
                                        onPress={() => {
                                            onRoleChange?.(role);
                                            setIsEditing(false);
                                            // Reset sub-preferences when role changes
                                            onChange('battingOrder', '');
                                            onChange('bowlingStyle', '');
                                        }}
                                    >
                                        <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>
                                            {role}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </>
                ) : (
                    <View style={[styles.chipRow, styles.rolesContainer]}>
                        <View style={styles.roleChipReadOnly}>
                            <MaterialIcons name="check-circle" size={14} color={COLORS.accent} style={{ marginRight: 4 }} />
                            <Text style={styles.roleChipTextReadOnly}>{selectedRole}</Text>
                        </View>
                        {onRoleChange && (
                            <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.marginLeft8}>
                                <MaterialIcons name="edit" size={16} color={COLORS.accent} />
                            </TouchableOpacity>
                        )}
                    </View>
                )}


                {/* Indoor Cricket Sub-Preferences */}
                {gameKey === 'indoorCricket' && selectedRole && (
                    <View style={{ marginTop: 16 }}>
                        {/* Batting Order & Style: For Batsman AND All-rounder */}
                        {(selectedRole === 'Batsman' || selectedRole === 'All-rounder') && (
                            <>
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={styles.sectionLabel}>Preferred Batting Order</Text>
                                    <View style={styles.chipRow}>
                                        {INDOOR_CRICKET_BATTING_ORDER.map((pref) => {
                                            const isActive = formData.battingOrder === pref;
                                            return (
                                                <TouchableOpacity
                                                    key={pref}
                                                    style={[styles.optionChip, isActive && styles.optionChipActive]}
                                                    onPress={() => onChange('battingOrder', pref)}
                                                >
                                                    <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>
                                                        {pref}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                <View style={{ marginBottom: 16 }}>
                                    <Text style={styles.sectionLabel}>Batting Style</Text>
                                    <View style={styles.chipRow}>
                                        {INDOOR_CRICKET_BATTING_STYLES.map((style) => {
                                            const isActive = formData.battingStyle === style;
                                            return (
                                                <TouchableOpacity
                                                    key={style}
                                                    style={[styles.optionChip, isActive && styles.optionChipActive]}
                                                    onPress={() => onChange('battingStyle', style)}
                                                >
                                                    <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>
                                                        {style}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            </>
                        )}

                        {/* Bowling Style & Order: For Bowler AND All-rounder */}
                        {(selectedRole === 'Bowler' || selectedRole === 'All-rounder') && (
                            <>
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={styles.sectionLabel}>Bowling Style</Text>
                                    <View style={styles.chipRow}>
                                        {INDOOR_CRICKET_BOWLING_STYLES.map((style) => {
                                            const isActive = formData.bowlingStyle === style;
                                            return (
                                                <TouchableOpacity
                                                    key={style}
                                                    style={[styles.optionChip, isActive && styles.optionChipActive]}
                                                    onPress={() => onChange('bowlingStyle', style)}
                                                >
                                                    <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>
                                                        {style}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                <View>
                                    <Text style={styles.sectionLabel}>Preferred Bowling Order</Text>
                                    <View style={styles.chipRow}>
                                        {INDOOR_CRICKET_BOWLING_ORDER.map((order) => {
                                            const isActive = formData.bowlingOrder === order;
                                            return (
                                                <TouchableOpacity
                                                    key={order}
                                                    style={[styles.optionChip, isActive && styles.optionChipActive]}
                                                    onPress={() => onChange('bowlingOrder', order)}
                                                >
                                                    <Text style={[styles.optionChipText, isActive && styles.optionChipTextActive]}>
                                                        {order}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            </>
                        )}
                    </View>
                )}
            </View>
        );
    }

    // Fallback for other games (Read-only for now)
    const getRoleInfo = (): string[] => {
        switch (gameKey) {
            case 'futsal':
                return profile.futsalPosition ? [profile.futsalPosition] : [];
            case 'indoorCricket':
                const roles: string[] = [];
                if (profile.indoorCricketRole) roles.push(profile.indoorCricketRole);
                if (profile.indoorCricketBowlingStyle) roles.push(profile.indoorCricketBowlingStyle);
                if (profile.indoorCricketBattingStyle) roles.push(profile.indoorCricketBattingStyle);
                return roles;
            case 'padel':
                return profile.padelRole ? [profile.padelRole] : [];
            default:
                return [];
        }
    };

    const roles = getRoleInfo();
    if (roles.length === 0) return null;

    const getLabel = (): string => {
        return 'Your Profile';
    };

    return (
        <View style={styles.section}>
            <Text style={styles.sectionLabel}>{getLabel()}</Text>
            <View style={[styles.chipRow, styles.rolesContainer]}>
                {roles.map((role: string, index: number) => (
                    <View key={index} style={styles.roleChipReadOnly}>
                        <MaterialIcons name="check-circle" size={14} color={COLORS.accent} style={{ marginRight: 4 }} />
                        <Text style={styles.roleChipTextReadOnly}>{role}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}
