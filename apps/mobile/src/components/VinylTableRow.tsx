import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { MockVinylData } from '@vinyla/shared-types';
import { isValidEditionColor, findDiscKind } from '@vinyla/core-api';

interface VinylTableRowProps {
  item: MockVinylData;
  onPress: () => void;
}

export const VinylTableRow = ({ item, onPress }: VinylTableRowProps) => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const tags = item.GENRES && Array.isArray(item.GENRES) ? item.GENRES : [];
  // 목록에는 디스크가 보이지 않으니, 라벨이 없으면 LP 종류 이름으로라도 알려준다.
  const discKind = findDiscKind(item.EDITION_STYLE as any);
  const editionText =
    item.EDITION_LABEL?.trim() ||
    (discKind ? t(`detail.editionPresets.${discKind.key}` as any) : null);

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
        {editionText ? (
          <View style={styles.editionRow}>
            {/* 썸네일이 작아 디스크 칩을 얹으면 읽히지 않으므로, 목록에서는
                텍스트를 유지하고 앞에 실물 디스크 색을 점으로 보여준다 */}
            {isValidEditionColor(item.EDITION_COLOR) ? (
              <View style={[styles.editionDot, { backgroundColor: item.EDITION_COLOR as string }]} />
            ) : null}
            <Text style={[styles.editionLabel, { color: themeColors.accent }]} numberOfLines={1}>
              {isValidEditionColor(item.EDITION_COLOR) ? '' : '✨ '}
              {editionText}
            </Text>
          </View>
        ) : null}
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
  editionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  editionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  editionLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.3,
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
