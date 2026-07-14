import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, NavigationProp, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import {
  useAuthStore,
  getUserVinyls,
  mapToFrontendModel,
  getProfileInfo,
  getFollowCounts,
  getMyFollowingIds,
  getMyOutgoingRequestIds,
  followUser,
  unfollowUser,
  requestFollow,
  cancelFollowRequest,
  getPublicListeningLog,
  ListeningLogWithAlbum,
} from '@vinyla/core-api';
import { SpinSocialModal } from '../components/Modal/SpinSocialModal';

const { width } = Dimensions.get('window');
const itemSize = (width - 48) / 3;

type FollowStatus = 'none' | 'requested' | 'following';

// 다른 수집가 프로필 — 웹 /user/[id]/dashboard의 모바일 버전.
// 컬렉션/다이어리 탭 + 팔로우 버튼(공개=즉시, 비공개=요청) + 비공개 잠금.
export const UserProfileScreen = () => {
  const { themeColors } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<any>>();
  const route = useRoute<RouteProp<Record<string, { userId: string; name?: string | null }>, string>>();
  const { userId, name } = route.params || ({} as any);
  const { user } = useAuthStore();

  const [displayName, setDisplayName] = useState<string | null>(name || null);
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null);
  const [followStatus, setFollowStatus] = useState<FollowStatus>('none');
  const [tab, setTab] = useState<'collection' | 'diary'>('collection');
  const [albums, setAlbums] = useState<any[] | null>(null);
  const [diary, setDiary] = useState<ListeningLogWithAlbum[] | null>(null);
  const [socialEntry, setSocialEntry] = useState<ListeningLogWithAlbum | null>(null);
  const [matchPercent, setMatchPercent] = useState<number | null>(null);

  const isMe = user?.id === userId;
  const isAdmin = user?.app_metadata?.role === 'admin';
  const canView = isMe || isAdmin || isPublic === true || followStatus === 'following';

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      (async () => {
        const [profile, followCounts] = await Promise.all([
          getProfileInfo(userId).catch(() => ({ DISPLAY_NAME: null, IS_PUBLIC: false })),
          getFollowCounts(userId).catch(() => null),
        ]);
        if (cancelled) return;
        if (profile.DISPLAY_NAME) setDisplayName(profile.DISPLAY_NAME);
        setIsPublic(profile.IS_PUBLIC);
        setCounts(followCounts);
        if (user?.id && user.id !== userId) {
          const [following, requested] = await Promise.all([getMyFollowingIds(), getMyOutgoingRequestIds()]);
          if (cancelled) return;
          setFollowStatus(following.has(userId) ? 'following' : requested.has(userId) ? 'requested' : 'none');
        }
      })();
      return () => { cancelled = true; };
    }, [userId, user?.id])
  );

  // 열람 가능해지면 컬렉션 로드 (RLS가 실제 차단 담당 — 실패/빈 결과는 그대로 노출)
  useFocusEffect(
    useCallback(() => {
      if (!userId || !canView || albums !== null) return;
      getUserVinyls(userId)
        .then((data) => {
          const mapped = (data || []).map((v: any) => mapToFrontendModel(v, null)).filter((v: any) => v.STATUS === 'OWNED');
          setAlbums(mapped);
        })
        .catch(() => setAlbums([]));
    }, [userId, canView, albums])
  );

  // 취향 일치율 배지 — 웹 PublicGrid와 동일한 정의:
  // 겹치는 OWNED 앨범 수 ÷ min(내 수집 수, 상대 수집 수) × 100 (겹침 0이면 미표시).
  useFocusEffect(
    useCallback(() => {
      if (!user?.id || isMe || albums === null || albums.length === 0 || matchPercent !== null) return;
      let cancelled = false;
      getUserVinyls(user.id)
        .then((mine) => {
          if (cancelled) return;
          const myOwned = new Set(
            (mine || []).filter((v: any) => v.STATUS !== 'WISH').map((v: any) => String(v.ALBUM_ID))
          );
          const overlap = albums.filter((a: any) => myOwned.has(String(a.ALBUM_ID))).length;
          if (overlap > 0) {
            setMatchPercent(Math.round((100 * overlap) / Math.max(Math.min(myOwned.size, albums.length), 1)));
          }
        })
        .catch(() => {});
      return () => { cancelled = true; };
    }, [user?.id, isMe, albums, matchPercent])
  );

  const loadDiary = useCallback(() => {
    if (!userId || diary !== null) return;
    getPublicListeningLog(userId, { limit: 30 })
      .then(setDiary)
      .catch(() => setDiary([]));
  }, [userId, diary]);

  const toggleFollow = async () => {
    if (!user?.id || isMe) return;
    const prev = followStatus;
    try {
      if (prev === 'following') {
        setFollowStatus('none');
        setCounts((c) => (c ? { ...c, followers: Math.max(0, c.followers - 1) } : c));
        await unfollowUser(userId);
      } else if (prev === 'requested') {
        setFollowStatus('none');
        await cancelFollowRequest(userId);
      } else if (isPublic === false) {
        setFollowStatus('requested');
        await requestFollow(userId);
      } else {
        setFollowStatus('following');
        setCounts((c) => (c ? { ...c, followers: c.followers + 1 } : c));
        await followUser(userId);
      }
    } catch {
      setFollowStatus(prev);
      getFollowCounts(userId).then(setCounts).catch(() => {});
    }
  };

  const followLabel =
    followStatus === 'following' ? t('feed.following')
    : followStatus === 'requested' ? t('feed.requested')
    : isPublic === false ? t('feed.requestFollow')
    : t('feed.follow');

  const styles = getStyles(themeColors);

  const header = (
    <View>
      <View style={{ alignItems: 'center', paddingVertical: 20 }}>
        <View style={[styles.avatar, { backgroundColor: 'rgba(212,175,55,0.15)' }]}>
          <Text style={{ color: themeColors.accent, fontSize: 26, fontWeight: '800' }}>
            {(displayName || '?').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <Text style={{ color: themeColors.textPrimary, fontSize: 20, fontWeight: '800', marginTop: 10 }}>
          {displayName || t('feed.anonymous')}
        </Text>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
          <Text style={{ color: themeColors.textSecondary, fontSize: 13 }}>
            <Text style={{ color: themeColors.textPrimary, fontWeight: '700' }}>{counts?.followers ?? 0}</Text> {t('publicGrid.followers')}
          </Text>
          <Text style={{ color: themeColors.textSecondary, fontSize: 13 }}>
            <Text style={{ color: themeColors.textPrimary, fontWeight: '700' }}>{counts?.following ?? 0}</Text> {t('publicGrid.following')}
          </Text>
        </View>
        {!isMe && matchPercent !== null && (
          <View style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(233,195,73,0.4)', backgroundColor: 'rgba(233,195,73,0.1)' }}>
            <Text style={{ color: themeColors.accent, fontSize: 12, fontWeight: '700' }}>
              {t('feed.matchPercent', { percent: matchPercent })}
            </Text>
          </View>
        )}
        {!isMe && user?.id && (
          <TouchableOpacity
            onPress={toggleFollow}
            style={[
              styles.followBtn,
              followStatus === 'none'
                ? { backgroundColor: themeColors.accent, borderColor: themeColors.accent }
                : { backgroundColor: 'transparent', borderColor: themeColors.border },
            ]}
          >
            <Text style={{ fontWeight: '700', fontSize: 13, color: followStatus === 'none' ? '#1a1814' : themeColors.textSecondary }}>
              {followLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {canView && (
        <View style={[styles.tabRow, { borderBottomColor: themeColors.border }]}>
          {(['collection', 'diary'] as const).map((key) => (
            <TouchableOpacity
              key={key}
              onPress={() => { setTab(key); if (key === 'diary') loadDiary(); }}
              style={[styles.tabBtn, tab === key && { borderBottomColor: themeColors.accent, borderBottomWidth: 2 }]}
            >
              <Text style={{ color: tab === key ? themeColors.textPrimary : themeColors.textSecondary, fontWeight: '600' }}>
                {key === 'collection' ? t('nav.collection') : t('nav.log')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Feather name="chevron-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
          {displayName || ''}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      {isPublic === null ? (
        <ActivityIndicator color={themeColors.accent} style={{ marginTop: 40 }} />
      ) : !canView ? (
        <View style={{ flex: 1 }}>
          {header}
          <View style={{ alignItems: 'center', paddingTop: 30, paddingHorizontal: 32 }}>
            <Feather name="lock" size={30} color={themeColors.accent} />
            <Text style={{ color: themeColors.textPrimary, fontSize: 17, fontWeight: '700', marginTop: 14 }}>{t('publicGrid.privateTitle')}</Text>
            <Text style={{ color: themeColors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>{t('publicGrid.privateDesc')}</Text>
          </View>
        </View>
      ) : tab === 'collection' ? (
        <FlatList
          key="collection"
          data={albums || []}
          keyExtractor={(a, i) => String(a.ALBUM_ID) + '-' + i}
          numColumns={3}
          columnWrapperStyle={{ gap: 8, paddingHorizontal: 16 }}
          ListHeaderComponent={header}
          ListEmptyComponent={
            albums === null
              ? <ActivityIndicator color={themeColors.accent} style={{ marginTop: 30 }} />
              : <Text style={{ color: themeColors.textSecondary, textAlign: 'center', marginTop: 30 }}>{t('collection.emptyTitle')}</Text>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => (
            <Image
              source={item.IMAGE_URL ? { uri: item.IMAGE_URL } : undefined}
              style={{ width: itemSize, height: itemSize, borderRadius: 8, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.06)' }}
            />
          )}
        />
      ) : (
        <FlatList
          key="diary"
          data={diary || []}
          keyExtractor={(e) => String(e.LOG_ID)}
          ListHeaderComponent={header}
          ListEmptyComponent={
            diary === null
              ? <ActivityIndicator color={themeColors.accent} style={{ marginTop: 30 }} />
              : <Text style={{ color: themeColors.textSecondary, textAlign: 'center', marginTop: 30 }}>{t('log.empty')}</Text>
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSocialEntry(item)}
              style={[styles.diaryItem, { borderColor: themeColors.border }]}
            >
              {item.ALBUM_MASTER?.IMAGE_URL ? (
                <Image source={{ uri: item.ALBUM_MASTER.IMAGE_URL }} style={{ width: 48, height: 48, borderRadius: 8 }} />
              ) : (
                <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' }} />
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: themeColors.textPrimary, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{item.ALBUM_MASTER?.TITLE}</Text>
                <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {new Date(item.LISTENED_AT).toLocaleDateString()} {item.MOOD ? `· ${item.MOOD}` : ''}
                </Text>
                {!!item.NOTE && (
                  <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 3 }} numberOfLines={2}>{item.NOTE}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {socialEntry && (
        <SpinSocialModal
          entry={socialEntry}
          ownerName={displayName}
          isVisible={!!socialEntry}
          onClose={() => setSocialEntry(null)}
        />
      )}
    </View>
  );
};

const getStyles = (themeColors: any) => StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  avatar: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  followBtn: { marginTop: 12, paddingHorizontal: 22, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 8 },
  tabBtn: { paddingVertical: 12, paddingHorizontal: 20 },
  diaryItem: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginVertical: 5, padding: 12,
    borderWidth: 1, borderRadius: 14,
  },
});
