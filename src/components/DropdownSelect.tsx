import { MaterialIcons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleProp,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import styles from './DropdownSelect.styles';

export type DropdownOption = {
  label: string;
  value: string;
};

type DropdownSelectProps = {
  value: string | null;
  placeholder: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  label?: string;
  error?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function DropdownSelect({
  value,
  placeholder,
  options,
  onSelect,
  label,
  error,
  containerStyle,
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => options.find(option => option.value === value) ?? null,
    [options, value]
  );

  const handleSelect = (option: DropdownOption) => {
    onSelect(option.value);
    setOpen(false);
  };

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          pressed && { opacity: 0.92 },
        ]}
      >
        <Text style={selected ? styles.valueText : styles.placeholderText}>
          {selected ? selected.label : placeholder}
        </Text>
        <MaterialIcons
          name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={22}
          style={styles.chevron}
          color="#bdbdbd"
        />
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.modalCard}>
          {label ? <Text style={styles.modalTitle}>{label}</Text> : null}
          <FlatList
            data={options}
            keyExtractor={item => item.value}
            renderItem={({ item }) => {
              const isSelected = item.value === selected?.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => handleSelect(item)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    isSelected && styles.optionRowSelected,
                    pressed && { opacity: 0.92 },
                  ]}
                >
                  <Text style={styles.optionLabel}>{item.label}</Text>
                  {isSelected ? (
                    <MaterialIcons
                      name="check"
                      size={18}
                      color="#42a5f5"
                    />
                  ) : null}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.optionsContainer}
          />
        </View>
      </Modal>
    </View>
  );
}
