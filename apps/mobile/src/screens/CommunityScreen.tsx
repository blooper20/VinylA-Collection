import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { getCommunityPosts, CommunityPostWithMeta } from '@vinyla/core-api';
import { CommunityPostCategory } from '@vinyla/shared-types';
import { ComingSoonNotice } from '../components/Community/ComingSoonNotice';

// LOCATION은 실제 DB 카테고리가 아니다 — 지도 SDK 도입 전까지 "준비 중" 안내만 보여준다.
type CategoryChoice = CommunityPostCategory | 'ALL' | 'LOCATION';
const CATEGORIES: CategoryChoice[] = ['ALL', 'FREE', 'ARRIVAL', 'LISTENING_ROOM', 'INFO', 'TIP', 'QNA', 'LOCATION'];
const PAGE_SIZE = 20;

// 커뮤니티 게시판 목록 — 웹 /community의 모바일 버전. 카테고리 탭 + 커서
// 페이지네이션. 포커스될 때마다 새로고침해 방금 작성한 글이 바로 보이게 한다.
export const CommunityScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { themeColors } = useTheme();
  const { t } = useLocale();

  const [category, setCategory] = useState<CategoryChoice>('ALL');
  const [posts, setPosts] = useState<CommunityPostWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const isLocationPlaceholder = category === 'LOCATION';

  const load = useCallback((cat: CategoryChoice) => {
    if (cat === 'LOCATION') { setIsLoading(false); return; }
    setIsLoading(true);
    getCommunityPosts({ category: cat === 'ALL' ? undefined : cat, limit: PAGE_SIZE })
      .then((rows) => {
        setPosts(rows);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(category); }, [category, load]));

  const loadMore = async () => {
    if (posts.length === 0 || !hasMore || category === 'LOCATION') return;
    const more = await getCommunityPosts({
      category: category === 'ALL' ? undefined : category,
      limit: PAGE_SIZE,
      beforeCreatedAt: posts[posts.length - 1].CREATED_AT,
    });
    setPosts((prev) => [...prev, ...more]);
    setHasMore(more.length === PAGE_SIZE);
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: themeColors.border }]}>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>{t('communityBoard.pageTitle')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CommunityNewPost')} style={{ padding: 6 }}>
          <Feather name="edit" size={20} color={themeColors.accent} />
        </TouchableOpacity>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={CATEGORIES}
        keyExtractor={(c) => c}
        style={styles.tabsList}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
        renderItem={({ item: c }) => (
          <TouchableOpacity
            onPress={() => setCategory(c)}
            style={[
              styles.tab,
              { borderColor: category === c ? themeColors.accent : themeColors.border },
              category === c && { backgroundColor: `${themeColors.accent}20` },
            ]}
          >
            <Text style={{ color: category === c ? themeColors.accent : themeColors.textSecondary, fontSize: 12, fontWeight: '600' }}>
              {c === 'ALL' ? t('communityBoard.tabs.ALL') : t(`communityBoard.categories.${c}` as any)}
            </Text>
          </TouchableOpacity>
        )}
      />

      {!isLocationPlaceholder && (
        <Text style={[styles.categoryHint, { color: themeColors.textSecondary }]}>
          {category === 'ALL' ? t('communityBoard.tabHints.ALL') : t(`communityBoard.categoryHint.${category}` as any)}
        </Text>
      )}

      {isLocationPlaceholder && <ComingSoonNotice />}

      {!isLocationPlaceholder && isLoading && <ActivityIndicator color={themeColors.accent} style={{ marginTop: 24 }} />}
      {!isLocationPlaceholder && !isLoading && posts.length === 0 && (
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>{t('communityBoard.empty')}</Text>
      )}

      {!isLocationPlaceholder && (
      <FlatList
        data={posts}
        keyExtractor={(p) => String(p.POST_ID)}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        renderItem={({ item: p }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: themeColors.border }]}
            onPress={() => navigation.navigate('CommunityPost', { postId: p.POST_ID })}
          >
            {p.MEDIA_ITEMS[0] ? (
              p.MEDIA_ITEMS[0].type === 'video' ? (
                <View style={[styles.thumb, styles.thumbVideo, { backgroundColor: themeColors.border }]}>
                  <Feather name="video" size={18} color={themeColors.textSecondary} />
                </View>
              ) : (
                <Image source={{ uri: p.MEDIA_ITEMS[0].url }} style={styles.thumb} />
              )
            ) : (
              <View style={[styles.thumb, { backgroundColor: themeColors.border }]} />
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: themeColors.accent, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>
                {t(`communityBoard.categories.${p.CATEGORY}` as any)}
              </Text>
              <Text style={[styles.rowTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>{p.TITLE}</Text>
              <Text style={[styles.rowMeta, { color: themeColors.textSecondary }]} numberOfLines={1}>
                {p.AUTHOR_NAME || t('communityBoard.authorFallback')} · {new Date(p.CREATED_AT).toLocaleDateString()}
                {' · '}{t('communityBoard.commentCount', { count: p.COMMENT_COUNT })}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  tabsList: { flexGrow: 0, paddingVertical: 10 },
  categoryHint: { fontSize: 12, paddingHorizontal: 16, marginBottom: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  emptyText: { textAlign: 'center', fontSize: 14, marginTop: 24 },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  thumbVideo: { alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  rowMeta: { fontSize: 11, marginTop: 2 },
});
