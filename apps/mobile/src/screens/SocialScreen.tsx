import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import {
  useAuthStore,
  FeedItem,
  TasteMatch,
  getDiscoveryFeed,
  subscribeToDiscoveryFeed,
  getTasteMatches,
  getMyFollowingIds,
  followUser,
  unfollowUser,
  getMyListeningLog,
  ListeningLogWithAlbum,
  getSpinSocialSummary,
  SpinSocialSummary,
  getUnreadNotificationCount,
  subscribeToNotifications,
} from '@vinyla/core-api';
import { VinylSocialModal } from '../components/Modal/VinylSocialModal';
import { SpinSocialModal } from '../components/Modal/SpinSocialModal';
import { useTabBarHeight } from '../constants/layout';

const PAGE_SIZE = 30;
const DIARY_PAGE_SIZE = 20;

// 웹의 '소셜' 메뉴(피드+다이어리 탭)와 동일한 구성의 모바일 화면.
export const SocialScreen = () => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const navigation = useNavigation<NavigationProp<any>>();
  const { user } = useAuthStore();

  const [tab, setTab] = useState<'feed' | 'diary'>('feed');
  const [unread, setUnread] = useState(0);

  // ── 피드 상태 ──
  const [items, setItems] = useState<FeedItem[]>([]);
  const [matches, setMatches] = useState<TasteMatch[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [feedLoading, setFeedLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedFeedItem, setSelectedFeedItem] = useState<FeedItem | null>(null);
  const seenIds = useRef<Set<number>>(new Set());

  // ── 다이어리 상태 ──
  const [entries, setEntries] = useState<ListeningLogWithAlbum[] | null>(null);
  const [diaryHasMore, setDiaryHasMore] = useState(false);
  const [diaryLoadingMore, setDiaryLoadingMore] = useState(false);
  const [socialMap, setSocialMap] = useState<Record<number, SpinSocialSummary>>({});
  const [socialEntry, setSocialEntry] = useState<ListeningLogWithAlbum | null>(null);

  // 알림 미읽음 배지 — 포커스 시 갱신 + Realtime
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      getUnreadNotificationCount().then(setUnread);
      const unsubscribe = subscribeToNotifications(() => {
        getUnreadNotificationCount().then(setUnread);
      });
      return unsubscribe;
    }, [user?.id])
  );

  // 피드 최초 로드 + Realtime 구독 (화면 포커스 동안만 — 백그라운드 소켓 유지 방지)
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [feed, taste, following] = await Promise.all([
          getDiscoveryFeed({ limit: PAGE_SIZE }).catch(() => [] as FeedItem[]),
          getTasteMatches(10).catch(() => [] as TasteMatch[]),
          getMyFollowingIds().catch(() => new Set<string>()),
        ]);
        if (cancelled) return;
        seenIds.current = new Set(feed.map((i) => i.USER_VINYL_ID));
        setItems(feed);
        setHasMore(feed.length === PAGE_SIZE);
        setMatches(taste);
        setFollowingIds(following);
        setFeedLoading(false);
      })();
      const unsubscribe = subscribeToDiscoveryFeed((item) => {
        if (cancelled || seenIds.current.has(item.USER_VINYL_ID)) return;
        seenIds.current.add(item.USER_VINYL_ID);
        setItems((prev) => [item, ...prev]);
      });
      return () => {
        cancelled = true;
        unsubscribe();
      };
    }, [])
  );

  const loadMoreFeed = async () => {
    const oldest = items[items.length - 1];
    if (!oldest || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await getDiscoveryFeed({ limit: PAGE_SIZE, beforeAddedAt: oldest.ADDED_AT });
      const fresh = page.filter((i) => !seenIds.current.has(i.USER_VINYL_ID));
      fresh.forEach((i) => seenIds.current.add(i.USER_VINYL_ID));
      setItems((prev) => [...prev, ...fresh]);
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleFollow = async (targetUserId: string) => {
    const isFollowing = followingIds.has(targetUserId);
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (isFollowing) next.delete(targetUserId);
      else next.add(targetUserId);
      return next;
    });
    try {
      if (isFollowing) await unfollowUser(targetUserId);
      else await followUser(targetUserId);
    } catch {
      setFollowingIds((prev) => {
        const next = new Set(prev);
        if (isFollowing) next.add(targetUserId);
        else next.delete(targetUserId);
        return next;
      });
    }
  };

  // 다이어리 로드 (탭 첫 진입 시)
  useEffect(() => {
    if (tab !== 'diary' || entries !== null || !user?.id) return;
    (async () => {
      try {
        const data = await getMyListeningLog(user.id, { limit: DIARY_PAGE_SIZE });
        setEntries(data);
        setDiaryHasMore(data.length === DIARY_PAGE_SIZE);
        if (data.length > 0) {
          const map = await getSpinSocialSummary(data.map((e) => e.LOG_ID));
          setSocialMap((prev) => ({ ...prev, ...map }));
        }
      } catch {
        setEntries([]);
      }
    })();
  }, [tab, entries, user?.id]);

  const loadMoreDiary = async () => {
    if (!user?.id || !entries || entries.length === 0 || diaryLoadingMore || !diaryHasMore) return;
    setDiaryLoadingMore(true);
    try {
      const last = entries[entries.length - 1];
      const more = await getMyListeningLog(user.id, { limit: DIARY_PAGE_SIZE, beforeLogId: last.LOG_ID });
      setEntries((prev) => [...(prev || []), ...more]);
      setDiaryHasMore(more.length === DIARY_PAGE_SIZE);
      if (more.length > 0) {
        const map = await getSpinSocialSummary(more.map((e) => e.LOG_ID));
        setSocialMap((prev) => ({ ...prev, ...map }));
      }
    } finally {
      setDiaryLoadingMore(false);
    }
  };

  const relativeTime = (iso: string): string => {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return t('feed.justNow');
    if (m < 60) return t('feed.minutesAgo', { m });
    const h = Math.floor(m / 60);
    if (h < 24) return t('feed.hoursAgo', { h });
    return t('feed.daysAgo', { d: Math.floor(h / 24) });
  };

  const openProfile = (userId: string, name: string | null) => {
    if (user?.id === userId) return;
    navigation.navigate('UserProfile', { userId, name });
  };

  const styles = getStyles(themeColors);

  const renderFeedHeader = () => (
    <View>
      {/* 오늘의 스토리 배너 */}
      <TouchableOpacity style={styles.storyBanner} onPress={() => navigation.navigate('Story')}>
        <Feather name="book-open" size={16} color={themeColors.accent} />
        <Text style={[styles.storyBannerText, { color: themeColors.textPrimary }]}>{t('story.title')}</Text>
        <Feather name="chevron-right" size={16} color={themeColors.textSecondary} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      {matches.length > 0 && (
        <View style={{ marginBottom: 16 }}>
          <Text style={[styles.railTitle, { color: themeColors.textPrimary }]}>{t('feed.matchesTitle')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
            {matches.map((m) => {
              const name = m.DISPLAY_NAME || t('feed.anonymous');
              const isFollowing = followingIds.has(m.USER_ID);
              return (
                <View key={m.USER_ID} style={[styles.matchCard, { borderColor: themeColors.border }]}>
                  <TouchableOpacity onPress={() => openProfile(m.USER_ID, m.DISPLAY_NAME)} style={{ alignItems: 'center' }}>
                    <View style={[styles.matchAvatar, { backgroundColor: 'rgba(212,175,55,0.15)' }]}>
                      <Text style={{ color: themeColors.accent, fontWeight: '700' }}>{name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <Text style={{ color: themeColors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 6 }} numberOfLines={1}>{name}</Text>
                  </TouchableOpacity>
                  <Text style={{ color: themeColors.accent, fontSize: 12, marginTop: 2 }}>{t('feed.matchPercent', { percent: m.MATCH_PERCENT })}</Text>
                  <TouchableOpacity
                    onPress={() => toggleFollow(m.USER_ID)}
                    style={[styles.followBtn, isFollowing ? { backgroundColor: 'transparent', borderColor: themeColors.border } : { backgroundColor: themeColors.accent, borderColor: themeColors.accent }]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: isFollowing ? themeColors.textSecondary : '#1a1814' }}>
                      {isFollowing ? t('feed.following') : t('feed.follow')}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const renderFeedItem = ({ item }: { item: FeedItem }) => {
    const name = item.DISPLAY_NAME || t('feed.anonymous');
    return (
      <TouchableOpacity style={[styles.feedItem, { borderColor: themeColors.border }]} onPress={() => setSelectedFeedItem(item)}>
        {item.ALBUM?.IMAGE_URL ? (
          <Image source={{ uri: item.ALBUM.IMAGE_URL }} style={styles.feedCover} />
        ) : (
          <View style={[styles.feedCover, { backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }]}>
            <Feather name="disc" size={20} color={themeColors.textSecondary} />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: themeColors.textSecondary, fontSize: 12 }} numberOfLines={1}>
            <Text style={{ color: themeColors.accent, fontWeight: '700' }} onPress={() => openProfile(item.USER_ID, item.DISPLAY_NAME)}>{name}</Text>
            {t('feed.addedSuffix')}
          </Text>
          <Text style={{ color: themeColors.textPrimary, fontSize: 14, fontWeight: '700', marginTop: 3 }} numberOfLines={1}>{item.ALBUM?.TITLE}</Text>
          <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{item.ALBUM?.ARTIST}</Text>
        </View>
        <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>{relativeTime(item.ADDED_AT)}</Text>
      </TouchableOpacity>
    );
  };

  const renderDiaryItem = ({ item }: { item: ListeningLogWithAlbum }) => {
    const s = socialMap[item.LOG_ID];
    return (
      <TouchableOpacity style={[styles.feedItem, { borderColor: themeColors.border }]} onPress={() => setSocialEntry(item)}>
        {item.ALBUM_MASTER?.IMAGE_URL ? (
          <Image source={{ uri: item.ALBUM_MASTER.IMAGE_URL }} style={styles.feedCover} />
        ) : (
          <View style={[styles.feedCover, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: themeColors.textPrimary, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{item.ALBUM_MASTER?.TITLE}</Text>
          <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
            {new Date(item.LISTENED_AT).toLocaleDateString()} {item.MOOD ? `· ${item.MOOD}` : ''} {!item.IS_PUBLIC ? `· ${t('log.private')}` : ''}
          </Text>
          {!!item.NOTE && (
            <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 3 }} numberOfLines={2}>{item.NOTE}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>♥ {s?.likeCount ?? 0}</Text>
          <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>💬 {s?.commentCount ?? 0}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      {/* 헤더: 타이틀 + 알림 벨 */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>{t('nav.social')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={{ padding: 6 }}>
          <Feather name="bell" size={22} color={themeColors.textPrimary} />
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 피드 | 다이어리 탭 */}
      <View style={[styles.tabRow, { borderBottomColor: themeColors.border }]}>
        {(['feed', 'diary'] as const).map((key) => (
          <TouchableOpacity key={key} onPress={() => setTab(key)} style={[styles.tabBtn, tab === key && { borderBottomColor: themeColors.accent, borderBottomWidth: 2 }]}>
            <Text style={{ color: tab === key ? themeColors.textPrimary : themeColors.textSecondary, fontWeight: '600', fontSize: 15 }}>
              {key === 'feed' ? t('nav.feed') : t('nav.log')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'feed' ? (
        feedLoading ? (
          <ActivityIndicator color={themeColors.accent} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => String(i.USER_VINYL_ID)}
            renderItem={renderFeedItem}
            ListHeaderComponent={renderFeedHeader}
            ListEmptyComponent={<Text style={{ color: themeColors.textSecondary, textAlign: 'center', marginTop: 40 }}>{t('feed.empty')}</Text>}
            contentContainerStyle={{ paddingBottom: tabBarHeight + 20 }}
            onEndReached={loadMoreFeed}
            onEndReachedThreshold={0.4}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={themeColors.accent} style={{ marginVertical: 16 }} /> : null}
          />
        )
      ) : entries === null ? (
        <ActivityIndicator color={themeColors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(i) => String(i.LOG_ID)}
          renderItem={renderDiaryItem}
          ListEmptyComponent={<Text style={{ color: themeColors.textSecondary, textAlign: 'center', marginTop: 40 }}>{t('log.empty')}</Text>}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 20 }}
          onEndReached={loadMoreDiary}
          onEndReachedThreshold={0.4}
          ListFooterComponent={diaryLoadingMore ? <ActivityIndicator color={themeColors.accent} style={{ marginVertical: 16 }} /> : null}
        />
      )}

      {selectedFeedItem && (
        <VinylSocialModal
          entry={selectedFeedItem}
          isVisible={!!selectedFeedItem}
          onClose={() => setSelectedFeedItem(null)}
        />
      )}
      {socialEntry && (
        <SpinSocialModal
          entry={socialEntry}
          isVisible={!!socialEntry}
          onClose={() => setSocialEntry(null)}
          onSummaryChange={(logId, s) => setSocialMap((prev) => ({ ...prev, [logId]: s }))}
        />
      )}
    </View>
  );
};

const getStyles = (themeColors: any) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  badge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 15, height: 15, paddingHorizontal: 3,
    borderRadius: 8, backgroundColor: '#ff4d6d',
    alignItems: 'center', justifyContent: 'center',
  },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 4 },
  tabBtn: { paddingVertical: 12, paddingHorizontal: 20 },
  storyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginVertical: 12, padding: 14,
    borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)',
  },
  storyBannerText: { fontSize: 14, fontWeight: '700' },
  railTitle: { fontSize: 15, fontWeight: '700', marginLeft: 16, marginBottom: 10 },
  matchCard: {
    width: 130, alignItems: 'center', padding: 12,
    borderWidth: 1, borderRadius: 14,
  },
  matchAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  followBtn: { marginTop: 8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  feedItem: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 5, padding: 12,
    borderWidth: 1, borderRadius: 14,
  },
  feedCover: { width: 52, height: 52, borderRadius: 8 },
});
