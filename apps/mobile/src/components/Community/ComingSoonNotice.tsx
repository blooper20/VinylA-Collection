import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';

// "로케이션" 카테고리 전용 안내 — 지도 SDK가 아직 없어 실제 글쓰기/목록
// 기능은 만들지 않고, 나중에 지도 기능이 붙으면 열릴 게시판이라는 걸
// 알리는 자리표시 화면만 둔다(웹 ComingSoonNotice와 동일 문구).
export const ComingSoonNotice = () => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  return (
    <View style={styles.wrap}>
      <Feather name="map" size={36} color={themeColors.textSecondary} />
      <Text style={[styles.title, { color: themeColors.accent }]}>{t('communityBoard.comingSoonTitle')}</Text>
      <Text style={[styles.desc, { color: themeColors.textSecondary }]}>{t('communityBoard.comingSoonDesc')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24, gap: 8 },
  title: { fontSize: 17, fontWeight: '700', marginTop: 8 },
  desc: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
