import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Image, Dimensions, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { getCommunityAlbums, CommunityAlbum } from '@vinyla/core-api';
import { MockVinylData } from '@vinyla/shared-types';
import { DetailModal } from '../components/Modal/DetailModal';

const { width } = Dimensions.get('window');
const itemSize = (width - 40 - 16) / 2;
const PAGE_SIZE = 30;

// Discogs 카탈로그에 없어 유저가 직접 등록한 앨범 목록 — 메인 검색과는 완전히
// 분리된 위키형 브라우즈 화면(웹 /community-albums의 모바일 버전).
export const CommunityAlbumsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { themeColors } = useTheme();
  const { t } = useLocale();

  const [query, setQuery] = useState('');
  const [albums, setAlbums] = useState<CommunityAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(true);
      getCommunityAlbums({ query, limit: PAGE_SIZE })
        .then((rows) => {
          setAlbums(rows);
          setHasMore(rows.length === PAGE_SIZE);
        })
        .finally(() => setIsLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  const loadMore = async () => {
    const oldest = albums[albums.length - 1];
    if (!oldest || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const more = await getCommunityAlbums({ query, limit: PAGE_SIZE, before: oldest.CREATED_AT });
      setAlbums((prev) => [...prev, ...more]);
      setHasMore(more.length === PAGE_SIZE);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const openAlbum = (a: CommunityAlbum) => {
    setSelectedAlbum({
      ALBUM_ID: a.ALBUM_ID,
      TITLE: a.TITLE,
      ARTIST: a.ARTIST,
      // 커버가 없을 때 앱 전역에서 쓰는 것과 동일한 플레이스홀더로 대체
      // (packages/core-api/src/supabaseDb.ts의 mapToFrontendModel과 동일한 URL) —
      // 빈 문자열은 웹 next/image 쪽에서 콘솔 에러를 던지는 것으로 확인됨.
      IMAGE_URL: a.IMAGE_URL || 'https://images.unsplash.com/photo-1518655048521-f130df041f66?q=80&w=400',
      RELEASE_YEAR: a.RELEASE_YEAR || undefined,
      SOURCE: a.SOURCE,
      SUBMITTED_BY: a.SUBMITTED_BY,
      COMMUNITY_TRACKS: a.TRACKS,
    } as MockVinylData);
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Feather name="chevron-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>{t('community.tabTitle')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CommunityAlbumRegister')} style={{ padding: 6 }}>
          <Feather name="plus" size={22} color={themeColors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}>
        <TextInput
          style={[styles.searchInput, { color: themeColors.textPrimary, borderColor: themeColors.border }]}
          placeholder={t('community.searchPlaceholder')}
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={query}
          onChangeText={setQuery}
        />

        {isLoading && <ActivityIndicator color={themeColors.accent} style={{ marginTop: 24 }} />}
        {!isLoading && albums.length === 0 && (
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>{t('community.empty')}</Text>
        )}

        <View style={styles.grid}>
          {albums.map((a) => (
            <TouchableOpacity key={a.ALBUM_ID} style={styles.card} onPress={() => openAlbum(a)}>
              {a.IMAGE_URL ? (
                <Image source={{ uri: a.IMAGE_URL }} style={styles.cover} resizeMode="cover" />
              ) : (
                <View style={[styles.cover, { backgroundColor: '#161616' }]} />
              )}
              <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>{a.TITLE}</Text>
              <Text style={[styles.cardArtist, { color: themeColors.textSecondary }]} numberOfLines={1}>{a.ARTIST}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {hasMore && !isLoading && (
          <TouchableOpacity style={[styles.loadMoreBtn, { borderColor: themeColors.border }]} onPress={loadMore} disabled={isLoadingMore}>
            {isLoadingMore ? (
              <ActivityIndicator color={themeColors.accent} size="small" />
            ) : (
              <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '600' }}>{t('communityBoard.loadMore')}</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <DetailModal
        album={selectedAlbum}
        visible={!!selectedAlbum}
        onClose={() => setSelectedAlbum(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 20,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    width: itemSize,
  },
  cover: {
    width: itemSize,
    height: itemSize,
    borderRadius: 8,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardArtist: {
    fontSize: 12,
    marginTop: 2,
  },
  loadMoreBtn: {
    alignSelf: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
});
