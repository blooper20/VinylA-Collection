import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@vinyla/ui';
import { MockVinylData } from '@vinyla/shared-types';

interface VinylTableRowProps {
  item: MockVinylData;
  onPress: () => void;
}

export const VinylTableRow = ({ item, onPress }: VinylTableRowProps) => {
  const { themeColors } = useTheme();
  const tags = item.GENRES && Array.isArray(item.GENRES) ? item.GENRES : [];

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: themeColors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image
        source={item.IMAGE_URL ? { uri: item.IMAGE_URL } : require('../../assets/logo_real_transparent.png')}
        style={styles.cover}
        resizeMode={item.IMAGE_URL ? 'cover' : 'contain'}
      />
      <View style={styles.info}>
        <Text style={[styles.title, { color: themeColors.textPrimary }]} numberOfLines={1}>
          {item.TITLE}
        </Text>
        <Text style={[styles.artist, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {item.ARTIST}
        </Text>
      </View>
      <Text style={[styles.year, { color: themeColors.textSecondary }]}>{item.RELEASE_YEAR || '—'}</Text>
      <View style={styles.tagsWrap}>
        <Text style={[styles.tagText, { color: tags.length > 0 ? themeColors.accent : themeColors.textSecondary }]} numberOfLines={1}>
          {tags.length > 0 ? tags.slice(0, 2).join(', ') : '—'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 6,
  },
  info: {
    flex: 1.3,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  artist: {
    fontSize: 11,
    marginTop: 2,
  },
  year: {
    width: 42,
    fontSize: 11,
    textAlign: 'center',
  },
  tagsWrap: {
    flex: 1,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'right',
  },
});
