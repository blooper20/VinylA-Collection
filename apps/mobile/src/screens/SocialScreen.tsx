import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, SectionList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, Alert } from 'react-native';
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
  updateSpinLog,
  deleteSpinLog,
  ListeningLogWithAlbum,
  getSpinSocialSummary,
  SpinSocialSummary,
  getUnreadNotificationCount,
  subscribeToNotifications,
  getErrorMessage,
  deleteUserVinyl,
  getPinnedNotices,
  getNotices,
} from '@vinyla/core-api';
import type { NOTICE } from '@vinyla/shared-types';
import { VinylSocialModal } from '../components/Modal/VinylSocialModal';
import { SpinSocialModal } from '../components/Modal/SpinSocialModal';
import { SpinLogEditorModal } from '../components/Modal/SpinLogEditorModal';
import { useTabBarHeight } from '../constants/layout';

const PAGE_SIZE = 30;
const DIARY_PAGE_SIZE = 20;
const NOTICE_PAGE_SIZE = 20;

const groupByDate = (entries: ListeningLogWithAlbum[]) => {
  const groups = new Map<string, ListeningLogWithAlbum[]>();
  for (const entry of entries) {
    const key = new Date(entry.LISTENED_AT).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }
  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
};

const groupByAlbum = (entries: ListeningLogWithAlbum[]) => {
  const groups = new Map<number, { album: ListeningLogWithAlbum['ALBUM_MASTER']; data: ListeningLogWithAlbum[] }>();
  for (const entry of entries) {
    if (!groups.has(entry.ALBUM_ID)) {
      groups.set(entry.ALBUM_ID, { album: entry.ALBUM_MASTER, data: [] });
    }
    groups.get(entry.ALBUM_ID)!.data.push(entry);
  }
  return Array.from(groups.values()).map(g => ({ ...g, title: g.album?.TITLE || '' }));
};

// 웹의 '소셜' 메뉴(피드+다이어리 탭)와 동일한 구성의 모바일 화면.
export const SocialScreen = () => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const navigation = useNavigation<NavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const { user } = useAuthStore();

  const [tab, setTab] = useState<'feed' | 'diary' | 'notice'>('feed');
  const [viewMode, setViewMode] = useState<'date' | 'album'>('date');
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
  const [editingEntry, setEditingEntry] = useState<ListeningLogWithAlbum | null>(null);

  // ── 공지사항 상태 ──
  const [pinnedNotices, setPinnedNotices] = useState<NOTICE[]>([]);
  const [noticeItems, setNoticeItems] = useState<NOTICE[] | null>(null);
  const [noticeHasMore, setNoticeHasMore] = useState(false);
  const [noticeLoadingMore, setNoticeLoadingMore] = useState(false);

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

  // 공지사항 로드 (탭 첫 진입 시)
  useEffect(() => {
    if (tab !== 'notice' || noticeItems !== null) return;
    (async () => {
      const [pinnedRows, rows] = await Promise.all([
        getPinnedNotices().catch(() => []),
        getNotices({ limit: NOTICE_PAGE_SIZE }).catch(() => []),
      ]);
      setPinnedNotices(pinnedRows);
      setNoticeItems(rows);
      setNoticeHasMore(rows.length === NOTICE_PAGE_SIZE);
    })();
  }, [tab, noticeItems]);

  const loadMoreNotices = async () => {
    if (!noticeItems || noticeItems.length === 0 || noticeLoadingMore || !noticeHasMore) return;
    setNoticeLoadingMore(true);
    try {
      const last = noticeItems[noticeItems.length - 1];
      const more = await getNotices({ limit: NOTICE_PAGE_SIZE, beforeCreatedAt: last.CREATED_AT });
      setNoticeItems((prev) => [...(prev || []), ...more]);
      setNoticeHasMore(more.length === NOTICE_PAGE_SIZE);
    } finally {
      setNoticeLoadingMore(false);
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

  // 다이어리 수정/삭제 — 이 탭은 getMyListeningLog(본인 것만)라 소유권 체크가
  // 필요 없다(웹 /log 페이지와 동일한 전제, RLS도 본인만 update/delete 허용).
  // 기존 리스트 내부에 있던 액션(openEntryActions) 대신 상세 모달 내부에서 수정/삭제를 처리하도록 변경됨.
  const handleEditEntry = (entry: ListeningLogWithAlbum) => {
    setEditingEntry(entry);
  };

  const styles = getStyles(themeColors);

  const renderNoticeItem = (n: NOTICE, isPinned: boolean) => {
    const thumb = n.MEDIA_ITEMS?.find((m) => m.type === 'image');
    return (
      <TouchableOpacity
        key={n.NOTICE_ID}
        style={[styles.noticeItem, { borderColor: isPinned ? 'rgba(212,175,55,0.35)' : themeColors.border }]}
        onPress={() => navigation.navigate('NoticeDetail', { noticeId: n.NOTICE_ID })}
      >
        {thumb ? (
          <Image source={{ uri: thumb.url }} style={styles.noticeThumb} />
        ) : (
          <View style={[styles.noticeThumb, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            {isPinned && (
              <View style={styles.noticePinBadge}>
                <Text style={{ color: themeColors.accent, fontSize: 10, fontWeight: '700' }}>{t('notice.pinned')}</Text>
              </View>
            )}
            <Text style={{ color: themeColors.textPrimary, fontSize: 14, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>{n.TITLE}</Text>
          </View>
          <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 4 }}>
            {new Date(n.CREATED_AT).toLocaleDateString()} · {t('notice.views', { count: n.VIEW_COUNT })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

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
                    {m.PROFILE_IMAGE_URL ? (
                      <Image source={{ uri: m.PROFILE_IMAGE_URL }} style={[styles.matchAvatar, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
                    ) : (
                      <View style={[styles.matchAvatar, { backgroundColor: 'rgba(212,175,55,0.15)' }]}>
                        <Text style={{ color: themeColors.accent, fontWeight: '700' }}>{name.slice(0, 1).toUpperCase()}</Text>
                      </View>
                    )}
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
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>{relativeTime(item.ADDED_AT)}</Text>
          {item.IS_PUBLIC ? (
            <Feather name="globe" size={12} color={themeColors.textSecondary} style={{ opacity: 0.6 }} />
          ) : (
            <Feather name="lock" size={12} color={themeColors.textSecondary} style={{ opacity: 0.6 }} />
          )}
        </View>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1, gap: 4 }}>
            <Text style={{ color: themeColors.textSecondary, fontSize: 12 }} numberOfLines={1}>
              {new Date(item.LISTENED_AT).toLocaleDateString()} {item.MOOD ? `· ${item.MOOD}` : ''} {!item.IS_PUBLIC ? `· ${t('log.private')}` : ''}
            </Text>
            {item.IS_PUBLIC ? (
              <Feather name="globe" size={10} color={themeColors.textSecondary} />
            ) : (
              <Feather name="lock" size={10} color={themeColors.textSecondary} />
            )}
          </View>
          {!!item.NOTE && (
            <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 3 }} numberOfLines={2}>{item.NOTE}</Text>
          )}
          {!!item.MEDIA_URL && (
            item.MEDIA_TYPE === 'video' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <Feather name="film" size={11} color={themeColors.accent} />
                <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>{t('detail.spinLogVideoAttached')}</Text>
              </View>
            ) : (
              <Image source={{ uri: item.MEDIA_URL }} style={{ width: 64, height: 64, borderRadius: 8, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            )
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4, paddingLeft: 10, paddingVertical: 6 }}>
          <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>♥ {s?.likeCount ?? 0}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Feather name="message-circle" size={12} color={themeColors.textSecondary} />
            <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>{s?.commentCount ?? 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderAlbumDiaryItem = ({ item }: { item: ListeningLogWithAlbum }) => {
    const s = socialMap[item.LOG_ID];
    return (
      <TouchableOpacity style={[styles.feedItem, { borderColor: themeColors.border, marginVertical: 4, paddingVertical: 10 }]} onPress={() => setSocialEntry(item)}>
        <View style={{ flex: 1, marginLeft: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>
              {new Date(item.LISTENED_AT).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              {item.MOOD ? ` · ${item.MOOD}` : ''}
            </Text>
            {item.IS_PUBLIC ? (
              <Feather name="globe" size={10} color={themeColors.textSecondary} style={{ opacity: 0.6 }} />
            ) : (
              <Feather name="lock" size={10} color={themeColors.textSecondary} style={{ opacity: 0.6 }} />
            )}
          </View>
          {!!item.NOTE && (
            <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 4 }} numberOfLines={2}>{item.NOTE}</Text>
          )}
          {!!item.MEDIA_URL && (
            item.MEDIA_TYPE === 'video' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <Feather name="film" size={11} color={themeColors.accent} />
                <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>{t('detail.spinLogVideoAttached')}</Text>
              </View>
            ) : (
              <Image source={{ uri: item.MEDIA_URL }} style={{ width: 64, height: 64, borderRadius: 8, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            )
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4, paddingLeft: 10, paddingVertical: 6 }}>
          <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>♥ {s?.likeCount ?? 0}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Feather name="message-circle" size={12} color={themeColors.textSecondary} />
            <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>{s?.commentCount ?? 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDateHeader = ({ section }: any) => (
    <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, backgroundColor: themeColors.background }}>
      <Text style={{ color: themeColors.textPrimary, fontSize: 16, fontWeight: '800' }}>{section.title}</Text>
    </View>
  );

  const renderAlbumHeader = ({ section }: any) => (
    <View style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: themeColors.background }}>
      {section.album?.IMAGE_URL ? (
        <Image source={{ uri: section.album.IMAGE_URL }} style={{ width: 44, height: 44, borderRadius: 6 }} />
      ) : (
        <View style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="disc" size={20} color={themeColors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ color: themeColors.textPrimary, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>{section.album?.TITLE}</Text>
        <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 2 }}>{section.album?.ARTIST}</Text>
      </View>
      <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
        <Text style={{ color: themeColors.textPrimary, fontSize: 11, fontWeight: '700' }}>{t('log.playCount', { count: section.data.length })}</Text>
      </View>
    </View>
  );

  const dateSections = useMemo(() => entries ? groupByDate(entries) : [], [entries]);
  const albumSections = useMemo(() => entries ? groupByAlbum(entries) : [], [entries]);

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

      {/* 피드 | 다이어리 | 공지사항 탭 */}
      <View style={[styles.tabRow, { borderBottomColor: themeColors.border }]}>
        {(['feed', 'diary', 'notice'] as const).map((key) => (
          <TouchableOpacity key={key} onPress={() => setTab(key)} style={[styles.tabBtn, tab === key && { borderBottomColor: themeColors.accent, borderBottomWidth: 2 }]}>
            <Text style={{ color: tab === key ? themeColors.textPrimary : themeColors.textSecondary, fontWeight: '600', fontSize: 15 }}>
              {key === 'feed' ? t('nav.feed') : key === 'diary' ? t('nav.log') : t('notice.title')}
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
            contentContainerStyle={{ paddingBottom: tabBarHeight + 48 }}
            onEndReached={loadMoreFeed}
            onEndReachedThreshold={0.4}
            ListFooterComponent={loadingMore ? <ActivityIndicator color={themeColors.accent} style={{ marginVertical: 16 }} /> : null}
          />
        )
      ) : tab === 'diary' ? (
        entries === null ? (
          <ActivityIndicator color={themeColors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 }}>
              <TouchableOpacity onPress={() => setViewMode('date')} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: viewMode === 'date' ? themeColors.accent : 'rgba(255,255,255,0.06)' }}>
                <Text style={{ color: viewMode === 'date' ? '#000' : themeColors.textSecondary, fontSize: 13, fontWeight: '600' }}>{t('log.viewByDate')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setViewMode('album')} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: viewMode === 'album' ? themeColors.accent : 'rgba(255,255,255,0.06)' }}>
                <Text style={{ color: viewMode === 'album' ? '#000' : themeColors.textSecondary, fontSize: 13, fontWeight: '600' }}>{t('log.viewByAlbum')}</Text>
              </TouchableOpacity>
            </View>
            <SectionList
              sections={viewMode === 'date' ? dateSections : albumSections}
              keyExtractor={(i) => String(i.LOG_ID)}
              renderItem={viewMode === 'date' ? renderDiaryItem : renderAlbumDiaryItem}
              renderSectionHeader={viewMode === 'date' ? renderDateHeader : renderAlbumHeader}
              ListEmptyComponent={<Text style={{ color: themeColors.textSecondary, textAlign: 'center', marginTop: 40 }}>{t('log.empty')}</Text>}
              contentContainerStyle={{ paddingBottom: tabBarHeight + 48 }}
              onEndReached={loadMoreDiary}
              onEndReachedThreshold={0.4}
              ListFooterComponent={diaryLoadingMore ? <ActivityIndicator color={themeColors.accent} style={{ marginVertical: 16 }} /> : null}
              stickySectionHeadersEnabled={false}
            />
          </>
        )
      ) : noticeItems === null ? (
        <ActivityIndicator color={themeColors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={noticeItems}
          keyExtractor={(n) => String(n.NOTICE_ID)}
          contentContainerStyle={{ padding: 16, paddingBottom: tabBarHeight + 48 }}
          onEndReached={loadMoreNotices}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            pinnedNotices.length > 0 ? (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 10 }}>{t('notice.pinnedSection')}</Text>
                {pinnedNotices.map((n) => renderNoticeItem(n, true))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            pinnedNotices.length === 0 ? <Text style={{ color: themeColors.textSecondary, textAlign: 'center', marginTop: 40 }}>{t('notice.empty')}</Text> : null
          }
          renderItem={({ item }) => renderNoticeItem(item, false)}
          ListFooterComponent={noticeLoadingMore ? <ActivityIndicator color={themeColors.accent} style={{ marginVertical: 16 }} /> : null}
        />
      )}

      {selectedFeedItem && (
        <VinylSocialModal
          entry={selectedFeedItem}
          isVisible={!!selectedFeedItem}
          onClose={() => setSelectedFeedItem(null)}
          onUpdate={(updated) => {
            setItems((prev) => prev.map((e) => e.USER_VINYL_ID === updated.USER_VINYL_ID ? updated : e));
            setSelectedFeedItem(updated);
          }}
        />
      )}
      {socialEntry && (
        <SpinSocialModal
          entry={socialEntry}
          ownerName={user?.user_metadata?.displayName}
          isVisible={true}
          onClose={() => setSocialEntry(null)}
          onEdit={handleEditEntry}
          onUpdate={(updated) => {
            setEntries((prev) => prev ? prev.map((e) => e.LOG_ID === updated.LOG_ID ? updated : e) : []);
            setSocialEntry(updated);
          }}
          onDelete={async (logId) => {
            try {
              await deleteSpinLog(logId);
              setEntries((prev) => prev ? prev.filter((e) => e.LOG_ID !== logId) : []);
              setSocialEntry(null);
            } catch (e) {
              Alert.alert('', getErrorMessage(e, t));
            }
          }}
          onSummaryChange={(logId, newSummary) => {
            setSocialMap((prev) => ({ ...prev, [logId]: newSummary }));
          }}
        />
      )}
      {editingEntry && (
        <SpinLogEditorModal
          visible={!!editingEntry}
          title={t('detail.spinLogTitle')}
          hint={editingEntry.ALBUM_MASTER ? `${editingEntry.ALBUM_MASTER.TITLE} · ${editingEntry.ALBUM_MASTER.ARTIST}` : undefined}
          submitLabel={t('log.editSave')}
          submittingLabel={t('log.editSaving')}
          initial={{
            mood: editingEntry.MOOD,
            note: editingEntry.NOTE,
            isPublic: editingEntry.IS_PUBLIC,
            mediaUrl: editingEntry.MEDIA_URL,
            mediaType: editingEntry.MEDIA_TYPE,
          }}
          onClose={() => setEditingEntry(null)}
          onSubmit={async (values) => {
            const updated = await updateSpinLog(editingEntry.LOG_ID, {
              mood: values.mood,
              note: values.note,
              mediaUrl: values.media?.url ?? null,
              mediaType: values.media?.type ?? null,
              isPublic: values.isPublic,
            });
            setEntries((prev) => (prev || []).map((e) => (e.LOG_ID === editingEntry.LOG_ID ? { ...e, ...updated } : e)));
            setEditingEntry(null);
          }}
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
  noticeItem: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10,
  },
  noticeThumb: { width: 52, height: 52, borderRadius: 8 },
  noticePinBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, marginRight: 6, backgroundColor: 'rgba(212,175,55,0.15)' },
});
