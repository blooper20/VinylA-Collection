import React from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { SortMode, SORT_OPTIONS } from '../utils/sortVinyls';

interface SortChipRowProps {
  value: SortMode;
  onChange: (mode: SortMode) => void;
}

export const SortChipRow = ({ value, onChange }: SortChipRowProps) => {
  const { themeColors } = useTheme();
  const { t } = useLocale();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
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
              {t(`sort.${opt.key}`)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  container: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    paddingBottom: 14,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
