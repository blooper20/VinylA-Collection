import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@vinyla/ui';
import { SortMode, SORT_OPTIONS } from '../utils/sortVinyls';

interface SortChipRowProps {
  value: SortMode;
  onChange: (mode: SortMode) => void;
}

export const SortChipRow = ({ value, onChange }: SortChipRowProps) => {
  const { themeColors } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {SORT_OPTIONS.map((opt) => {
        const active = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.chip,
              {
                borderColor: active ? themeColors.accent : themeColors.border,
                backgroundColor: active ? 'rgba(212,175,55,0.12)' : 'transparent',
              },
            ]}
            onPress={() => onChange(opt.key)}
          >
            <Text style={[styles.chipText, { color: active ? themeColors.accent : themeColors.textSecondary }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 12,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
