// app/matchrooms/create/components/GameDynamicFields.tsx
import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    FlatList,
    Modal,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { getGameFields } from '../../../../constants/matchConfig';
import {
    FC_FORMATIONS,
    FC_LEAGUES,
    INDOOR_CRICKET_COMPOSITIONS,
    TEKKEN_CHARACTERS,
} from '../../../../constants/profileOptions';
import { COLORS, FONTS } from '../../../../src/theme';
import styles from '../create.styles';

interface GameDynamicFieldsProps {
    gameKey: string;
    formData: Record<string, any>;
    onChange: (field: string, value: any) => void;
}

type ModalType =
    | 'formation'
    | 'club_league'
    | 'club_team'
    | 'tekken_character'
    | 'futsal_formation'
    | 'indoorCricketComposition'
    | null;

export default function GameDynamicFields({
    gameKey,
    formData,
    onChange,
}: GameDynamicFieldsProps) {
    const fields: any = getGameFields(gameKey as any);

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [modalType, setModalType] = useState<ModalType>(null);
    const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null);
    const [activeCharacterSlot, setActiveCharacterSlot] = useState<number>(0);
    const [searchQuery, setSearchQuery] = useState('');

    if (!fields) return null;

    const openModal = (type: ModalType) => {
        setModalType(type);
        setSearchQuery('');
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
        setModalType(null);
    };

    const renderChips = (
        label: string,
        fieldKey: string,
        options: string[],
        multiSelect = false
    ) => {
        if (!options) return null;
        return (
            <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                    {label}
                    {(fieldKey === 'format') && <Text style={styles.requiredAsterisk}>*</Text>}
                </Text>
                <View style={styles.chipRow}>
                    {options.map((opt) => {
                        const isSelected = multiSelect
                            ? (formData[fieldKey] || []).includes(opt)
                            : formData[fieldKey] === opt;
                        return (
                            <TouchableOpacity
                                key={opt}
                                style={[
                                    styles.optionChip,
                                    isSelected && styles.optionChipActive,
                                ]}
                                onPress={() => {
                                    if (multiSelect) {
                                        const current = formData[fieldKey] || [];
                                        if (current.includes(opt)) {
                                            onChange(
                                                fieldKey,
                                                current.filter((i: string) => i !== opt)
                                            );
                                        } else {
                                            onChange(fieldKey, [...current, opt]);
                                        }
                                    } else {
                                        onChange(fieldKey, opt);
                                    }
                                }}
                            >
                                <Text
                                    style={[
                                        styles.optionChipText,
                                        isSelected && styles.optionChipTextActive,
                                    ]}
                                >
                                    {opt}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        );
    };

    const renderModalContent = () => {
        let title = '';
        let data: readonly any[] = [];
        let renderItem: any = null;

        if (modalType === 'formation') {
            title = 'Select Formation';
            data = [...FC_FORMATIONS];
            renderItem = ({ item }: { item: string }) => (
                <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                        onChange('formation', item);
                        closeModal();
                    }}
                >
                    <Text
                        style={[
                            styles.modalItemText,
                            formData.formation === item && styles.modalItemTextActive
                        ]}
                    >
                        {item}
                    </Text>
                    {formData.formation === item && (
                        <MaterialIcons name="check" size={20} color={COLORS.accent} />
                    )}
                </TouchableOpacity>
            );
        } else if (modalType === 'club_league') {
            title = 'Select League';
            data = [...FC_LEAGUES];
            renderItem = ({ item }: { item: any }) => (
                <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                        setSelectedLeagueId(item.id);
                        setModalType('club_team');
                    }}
                >
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    <MaterialIcons
                        name="chevron-right"
                        size={24}
                        color={COLORS.muted}
                    />
                </TouchableOpacity>
            );
        } else if (modalType === 'club_team') {
            const league = FC_LEAGUES.find((l) => l.id === selectedLeagueId);
            title = league ? `${league.name} Teams` : 'Select Team';
            data = league ? [...league.teams] : [];

            if (searchQuery) {
                data = data.filter((team: string) =>
                    team.toLowerCase().includes(searchQuery.toLowerCase())
                );
            }

            renderItem = ({ item }: { item: string }) => (
                <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                        onChange('favouriteClub', item);
                        closeModal();
                    }}
                >
                    <Text
                        style={[
                            styles.modalItemText,
                            formData.favouriteClub === item && {
                                color: COLORS.accent,
                                fontWeight: 'bold',
                            },
                        ]}
                    >
                        {item}
                    </Text>
                    {formData.favouriteClub === item && (
                        <MaterialIcons name="check" size={20} color={COLORS.accent} />
                    )}
                </TouchableOpacity>
            );
        } else if (modalType === 'indoorCricketComposition') {
            title = 'Select Team Composition';
            data = [...INDOOR_CRICKET_COMPOSITIONS];
            renderItem = ({ item }: { item: any }) => (
                <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                        onChange('composition', item.name);
                        closeModal();
                    }}
                >
                    <View style={styles.flex1}>
                        <Text
                            style={[
                                styles.modalItemText,
                                formData.composition === item.name && styles.modalItemTextActive,
                            ]}
                        >
                            {item.name}
                        </Text>
                        <Text style={styles.modalItemSubtitle}>
                            {item.description}
                        </Text>
                    </View>
                    {formData.composition === item.name && (
                        <MaterialIcons name="check" size={20} color={COLORS.accent} />
                    )}
                </TouchableOpacity>
            );
        } else if (modalType === 'tekken_character') {
            title = 'Select Character';
            data = [...TEKKEN_CHARACTERS];

            if (searchQuery) {
                data = data.filter((char: string) =>
                    char.toLowerCase().includes(searchQuery.toLowerCase())
                );
            }

            renderItem = ({ item }: { item: string }) => (
                <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                        // Assuming simple character selection for now, or specific based on activeCharacterSlot if needed
                        // Since external usage isn't fully clear, we'll just set it to a generic 'character' field or similar
                        // Use activeCharacterSlot to decide field if applicable, or default
                        // In the snippet, 'activeCharacterSlot' was present but usage was not visible.
                        // For safety, I'll update 'character' field.
                        onChange('character', item);
                        closeModal();
                    }}
                >
                    <Text style={styles.modalItemText}>{item}</Text>
                    {formData.character === item && (
                        <MaterialIcons name="check" size={20} color={COLORS.accent} />
                    )}
                </TouchableOpacity>
            );
        }

        return (
            <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <TouchableOpacity onPress={closeModal}>
                        <MaterialIcons name="close" size={24} color={COLORS.text} />
                    </TouchableOpacity>
                </View>

                {(modalType === 'club_team' ||
                    modalType === 'tekken_character') && (
                        <View style={styles.modalSearchBox}>
                            <MaterialIcons name="search" size={20} color={COLORS.muted} />
                            <TextInput
                                style={styles.modalSearchInput}
                                placeholder="Search..."
                                placeholderTextColor={COLORS.muted}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    )}

                <FlatList
                    data={data}
                    renderItem={renderItem}
                    keyExtractor={(item, index) =>
                        typeof item === 'string' ? item : index.toString()
                    }
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            </View>
        );
    };

    // FC26 Fields
    if (gameKey === 'fc26') {
        return (
            <>
                {renderChips('Format', 'format', fields.formats, false)}

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Favourite Club</Text>
                    <TouchableOpacity
                        style={[styles.inputBox, styles.inputPicker]}
                        onPress={() => openModal('club_league')}
                    >
                        <Text
                            style={[
                                styles.input,
                                !formData.favouriteClub && styles.mutedText,
                            ]}
                        >
                            {formData.favouriteClub || 'Select Club'}
                        </Text>
                        <MaterialIcons
                            name="arrow-drop-down"
                            size={24}
                            color={COLORS.muted}
                        />
                    </TouchableOpacity>
                    <Text style={styles.italicHelper}>
                        Note: You can choose any team in the actual match. This is just your preferred club.
                    </Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Preferred Formation</Text>
                    <TouchableOpacity
                        style={[
                            styles.inputBox,
                            {
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            },
                        ]}
                        onPress={() => openModal('formation')}
                    >
                        <Text
                            style={[
                                styles.input,
                                !formData.formation && { color: '#757575' },
                            ]}
                        >
                            {formData.formation || 'Select Formation'}
                        </Text>
                        <MaterialIcons
                            name="arrow-drop-down"
                            size={24}
                            color={COLORS.muted}
                        />
                    </TouchableOpacity>
                </View>

                <Modal
                    visible={modalVisible}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={closeModal}
                >
                    <TouchableWithoutFeedback onPress={closeModal}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                {renderModalContent()}
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>
            </>
        );
    }

    // Indoor Cricket Fields
    if (gameKey === 'indoor_cricket') {
        return (
            <>
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Format</Text>
                    <View style={[styles.chipRow, { justifyContent: 'flex-start' }]}>
                        <View style={[styles.optionChip, styles.optionChipActive]}>
                            <Text
                                style={[styles.optionChipText, styles.optionChipTextActive]}
                            >
                                8-a-side (16 players)
                            </Text>
                        </View>
                    </View>
                </View>

                {renderChips('Overs', 'overs', fields.overs.map(String), false)}

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Series Type</Text>
                    <View style={[styles.chipRow, { justifyContent: 'flex-start' }]}>
                        <View style={[styles.optionChip, styles.optionChipActive]}>
                            <Text
                                style={[styles.optionChipText, styles.optionChipTextActive]}
                            >
                                Best of 3
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Team Composition</Text>
                    <Text
                        style={{
                            color: COLORS.muted,
                            fontSize: 12,
                            marginBottom: 8,
                            fontFamily: FONTS.interRegular,
                        }}
                    >
                        Define the team structure to ensure balanced matches
                    </Text>

                    <TouchableOpacity
                        style={[
                            styles.inputBox,
                            {
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            },
                        ]}
                        onPress={() => openModal('indoorCricketComposition')}
                    >
                        <Text
                            style={[
                                styles.input,
                                !formData.composition && { color: '#757575' },
                            ]}
                        >
                            {formData.composition || 'Select Composition'}
                        </Text>
                        <MaterialIcons
                            name="arrow-drop-down"
                            size={24}
                            color={COLORS.muted}
                        />
                    </TouchableOpacity>

                    {formData.composition && (
                        <View
                            style={{
                                marginTop: 12,
                                padding: 12,
                                backgroundColor: 'rgba(66, 165, 245, 0.1)',
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: 'rgba(66, 165, 245, 0.3)',
                            }}
                        >
                            <Text
                                style={{
                                    color: COLORS.text,
                                    fontSize: 12,
                                    fontFamily: FONTS.interMedium,
                                    marginBottom: 4,
                                }}
                            >
                                {
                                    INDOOR_CRICKET_COMPOSITIONS.find(
                                        (c) => c.name === formData.composition
                                    )?.description
                                }
                            </Text>
                            <Text
                                style={{
                                    color: COLORS.muted,
                                    fontSize: 11,
                                    fontFamily: FONTS.interRegular,
                                }}
                            >
                                Required:{' '}
                                {Object.entries(
                                    INDOOR_CRICKET_COMPOSITIONS.find(
                                        (c) => c.name === formData.composition
                                    )?.positions || {}
                                )
                                    .filter(([_, count]) => (count as number) > 0)
                                    .map(
                                        ([pos, count]) =>
                                            `${count as number} ${pos}${(count as number) > 1 ? 's' : ''
                                            }`
                                    )
                                    .join(', ')}
                            </Text>
                        </View>
                    )}
                </View>

                <Modal
                    visible={modalVisible}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={closeModal}
                >
                    <TouchableWithoutFeedback onPress={closeModal}>
                        <View style={styles.modalOverlay}>
                            <TouchableWithoutFeedback>
                                {renderModalContent()}
                            </TouchableWithoutFeedback>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>
            </>
        );
    }

    // Padel Fields - Series Type Selection
    if (gameKey === 'padel') {
        return (
            <>
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>
                        Format<Text style={styles.requiredAsterisk}>*</Text>
                    </Text>
                    <View style={[styles.chipRow, { justifyContent: 'flex-start' }]}>
                        <View style={[styles.optionChip, styles.optionChipActive]}>
                            <Text
                                style={[styles.optionChipText, styles.optionChipTextActive]}
                            >
                                2v2 (Doubles)
                            </Text>
                        </View>
                    </View>
                </View>
            </>
        );
    }

    // Pickleball Fields
    if (gameKey === 'pickleball') {
        return (
            <>
                {renderChips('Format', 'format', fields.formats, false)}
            </>
        );
    }

    return null;
}
