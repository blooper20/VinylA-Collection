import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { getTodayVinylStory, getVinylStoryArchive } from '@vinyla/core-api';
import type { VINYL_STORY } from '@vinyla/shared-types';

// 오늘의 바이닐 스토리 — 웹 /story의 모바일 버전. 생성은 웹 서버 라우트가 담당.
export const StoryScreen = () => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [today, setToday] = useState<VINYL_STORY | null>(null);
  const [archive, setArchive] = useState<VINYL_STORY[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const story = await getTodayVinylStory();
        setToday(story);
        const past = await getVinylStoryArchive(10);
        setArchive(past.filter((s) => s.STORY_ID !== story?.STORY_ID));
      } catch {
        setFailed(true);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const styles = getStyles(themeColors);

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Feather name="chevron-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>{t('story.title')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {isLoading ? (
          <View style={{ paddingVertical: 60 }}>
            <ActivityIndicator color={themeColors.accent} />
            <Text style={{ color: themeColors.textSecondary, textAlign: 'center', marginTop: 12 }}>{t('story.loading')}</Text>
          </View>
        ) : failed || !today ? (
          <Text style={{ color: themeColors.textSecondary, textAlign: 'center', paddingVertical: 60 }}>{t('story.empty')}</Text>
        ) : (
          <View style={[styles.card, { borderColor: themeColors.border }]}>
            {today.COVER_IMAGE_URL && (
              <Image source={{ uri: today.COVER_IMAGE_URL }} style={styles.cover} resizeMode="cover" />
            )}
            <View style={{ padding: 16 }}>
              <Text style={{ color: themeColors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }}>{t('story.eyebrow')}</Text>
              <Text style={{ color: themeColors.textPrimary, fontSize: 20, fontWeight: '800', marginTop: 8, lineHeight: 28 }}>{today.HEADLINE}</Text>
              <Text style={{ color: themeColors.textSecondary, fontSize: 13, marginTop: 4 }}>
                {today.ALBUM_TITLE} · {today.ALBUM_ARTIST}
              </Text>
              <Text style={{ color: themeColors.textPrimary, fontSize: 14, lineHeight: 23, marginTop: 14 }}>{today.BODY}</Text>
              <Text style={{ color: themeColors.textSecondary, fontSize: 11, marginTop: 14 }}>{t('story.disclaimer')}</Text>
            </View>
          </View>
        )}

        {archive.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <Text style={{ color: themeColors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>{t('story.archiveTitle')}</Text>
            {archive.map((s) => (
              <View key={s.STORY_ID} style={[styles.archiveItem, { borderColor: themeColors.border }]}>
                {s.COVER_IMAGE_URL ? (
                  <Image source={{ uri: s.COVER_IMAGE_URL }} style={styles.archiveCover} />
                ) : (
                  <View style={[styles.archiveCover, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>{new Date(s.STORY_DATE).toLocaleDateString()}</Text>
                  <Text style={{ color: themeColors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 2 }} numberOfLines={2}>{s.HEADLINE}</Text>
                  <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {s.ALBUM_TITLE} · {s.ALBUM_ARTIST}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const getStyles = (themeColors: any) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  cover: { width: '100%', height: 260 },
  archiveItem: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10,
  },
  archiveCover: { width: 56, height: 56, borderRadius: 8 },
});
