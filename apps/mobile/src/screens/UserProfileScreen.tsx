import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions, Animated, Easing, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, NavigationProp, RouteProp } from '@react-navigation/native';
import { DetailModal } from '../components/Modal/DetailModal';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
const IS_NARROW_SCREEN = width < 380;
const AVATAR_SIZE = IS_NARROW_SCREEN ? 92 : 120;
const FEATURED_FRAME_WIDTH = IS_NARROW_SCREEN ? 130 : 155;
const FEATURED_FRAME_HEIGHT = IS_NARROW_SCREEN ? 100 : 120;
const FEATURED_SCALE = FEATURED_FRAME_WIDTH / 155;
const ALBUM_INNER_SIZE = Math.round(88 * FEATURED_SCALE);
const VINYL_DISC_SIZE = Math.round(86 * FEATURED_SCALE);
const VINYL_DISC_LEFT = Math.round(45 * FEATURED_SCALE);
const VINYL_GROOVE_1_SIZE = Math.round(74 * FEATURED_SCALE);
const VINYL_GROOVE_2_SIZE = Math.round(60 * FEATURED_SCALE);
const VINYL_LABEL_SIZE = Math.round(30 * FEATURED_SCALE);
const VINYL_HOLE_SIZE = Math.round(4 * FEATURED_SCALE);

type FollowStatus = 'none' | 'requested' | 'following';

const AnalyticsCard = ({ title, value, unit, sub, themeColors, isSpent, isSpentPublic, glassIntensity }: any) => {
  const { t } = useLocale();
  const content = (
    <BlurView
      intensity={glassIntensity || 30}
      tint="dark"
      style={[
        stylesStatic.card,
        {
          borderColor: themeColors.border,
          backgroundColor: 'rgba(20,20,20,0.4)',
          overflow: 'hidden',
        },
      ]}
    >
      <View>
        <Text style={[stylesStatic.cardTitle, { color: themeColors.textSecondary }]} numberOfLines={1}>{title}</Text>
        <Text
          style={[stylesStatic.cardValue, { color: themeColors.textPrimary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {unit ? <Text style={stylesStatic.cardUnit}>{unit}</Text> : null}
          {value}
        </Text>
        {sub && <Text style={[stylesStatic.cardSub, { color: themeColors.textSecondary }]} numberOfLines={1}>{sub}</Text>}
      </View>
      {isSpent && (
        <View style={[stylesStatic.spentToggleBtn, { borderColor: 'rgba(255,255,255,0.15)' }]}>
          <Text style={[stylesStatic.spentToggleText, { color: 'rgba(255,255,255,0.4)' }]} numberOfLines={1}>
            {isSpentPublic ? t('mobile.my.spentPublicShort') : t('mobile.my.spentPrivateShort')}
          </Text>
        </View>
      )}
    </BlurView>
  );
  return content;
};

export const UserProfileScreen = () => {
  const { themeColors, glassIntensity } = useTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<any>>();
  const route = useRoute<RouteProp<Record<string, { userId: string; name?: string | null }>, string>>();
  const { userId, name } = route.params || ({} as any);
  const { user } = useAuthStore();

  const [displayName, setDisplayName] = useState<string | null>(name || null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [counts, setCounts] = useState<{ followers: number; following: number } | null>(null);
  const [followStatus, setFollowStatus] = useState<FollowStatus>('none');
  const [tab, setTab] = useState<'collection' | 'wishlist' | 'diary'>('collection');
  const [albums, setAlbums] = useState<any[] | null>(null);
  const [wishlist, setWishlist] = useState<any[] | null>(null);
  const [allAlbums, setAllAlbums] = useState<any[] | null>(null);
  const [diary, setDiary] = useState<ListeningLogWithAlbum[] | null>(null);
  const [socialEntry, setSocialEntry] = useState<ListeningLogWithAlbum | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);
  const [matchPercent, setMatchPercent] = useState<number | null>(null);
  const [featuredAlbumId, setFeaturedAlbumId] = useState<number | null>(null);

  // Stats
  const [collectionValue, setCollectionValue] = useState(0);
  const [ownedCount, setOwnedCount] = useState(0);
  const [topGenre, setTopGenre] = useState('-');
  const [actualTopGenre, setActualTopGenre] = useState('-');

  const isMe = user?.id === userId;
  const isAdmin = user?.app_metadata?.role === 'admin';
  const canView = isMe || isAdmin || isPublic === true || followStatus === 'following';

  const featuredAlbum = allAlbums ? allAlbums.find(a => Number(a.ALBUM_ID) === Number(featuredAlbumId)) : null;

  const spinAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (featuredAlbum) {
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 12000, useNativeDriver: true, easing: Easing.linear })
      ).start();
      Animated.loop(
        Animated.timing(shimmerAnim, { toValue: 1, duration: 4000, useNativeDriver: true, easing: Easing.linear })
      ).start();
    }
  }, [featuredAlbum, spinAnim, shimmerAnim]);

  const spinRotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const shimmerTranslate = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-200, 200] });

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      (async () => {
        const [profile, followCounts] = await Promise.all([
          getProfileInfo(userId).catch(() => ({ DISPLAY_NAME: null, IS_PUBLIC: false, PROFILE_IMAGE_URL: null, FEATURED_ALBUM_ID: null })),
          getFollowCounts(userId).catch(() => null),
        ]);
        if (cancelled) return;
        if (profile.DISPLAY_NAME) setDisplayName(profile.DISPLAY_NAME);
        setProfileImageUrl(profile.PROFILE_IMAGE_URL || null);
        setIsPublic(profile.IS_PUBLIC);
        
        let featId = profile.FEATURED_ALBUM_ID || null;
        if (!featId && isMe && user?.user_metadata?.featured_album_id) {
          featId = user.user_metadata.featured_album_id;
        }
        setFeaturedAlbumId(featId);
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

  useFocusEffect(
    useCallback(() => {
      if (!userId || !canView || albums !== null) return;
      getUserVinyls(userId)
        .then((data) => {
          const rawOwned = (data || []).filter((v: any) => v.STATUS === 'OWNED');
          const value = rawOwned.reduce((sum: number, item: any) => sum + (item.ALBUM_MASTER?.MARKET_PRICE || 0), 0);
          setCollectionValue(value);

          const mapped = (data || []).map((v: any) => mapToFrontendModel(v, null));
          const owned = mapped.filter((v: any) => v.STATUS === 'OWNED');
          setAllAlbums(mapped);
          setAlbums(owned);
          
          setOwnedCount(owned.length);
          
          const genreCounts: Record<string, number> = {};
          owned.forEach(item => {
            if (item.GENRES && Array.isArray(item.GENRES)) {
              item.GENRES.forEach((g: string) => {
                genreCounts[g] = (genreCounts[g] || 0) + 1;
              });
            }
          });
          const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
          if (sortedGenres.length > 0) {
            setActualTopGenre(sortedGenres[0][0]);
            // For topGenre we just use the most collected genre if it's not set
            setTopGenre(sortedGenres[0][0]);
          } else {
            setActualTopGenre('-');
            setTopGenre('-');
          }
        })
        .catch(() => {
          setAlbums([]);
          setAllAlbums([]);
        });
    }, [userId, canView, albums])
  );

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
      <View style={styles.heroSection}>
        <View style={styles.profileLeft}>
          <View style={[styles.avatarFrame, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: themeColors.accent, borderWidth: 1.5 }]}>
            {profileImageUrl ? (
              <Image source={{ uri: profileImageUrl }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarImage, { backgroundColor: 'rgba(212,175,55,0.15)', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: themeColors.accent, fontSize: 32, fontWeight: '800' }}>
                  {(displayName || '?').slice(0, 1).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.profileName, { color: themeColors.textPrimary }]} numberOfLines={1}>{displayName || t('feed.anonymous')}</Text>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
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

        <View style={styles.profileRight}>
          <View style={styles.featuredFrame}>
            {featuredAlbum ? (
              <View style={styles.cubbyContainer}>
                <View style={{
                  position: 'absolute', top: '50%', left: '50%', marginTop: -40, marginLeft: -40,
                  width: 80, height: 80, backgroundColor: '#ff8c00', borderRadius: 40,
                  shadowColor: '#ffaa00', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 40, elevation: 20, zIndex: 0
                }} />
                <View style={styles.albumShadowBox}>
                  <Animated.View style={[styles.vinylDisc, { transform: [{ rotate: spinRotate }] }]}>
                    <LinearGradient
                      colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.08)']}
                      style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />
                    <View style={styles.vinylGrooves} />
                    <View style={styles.vinylGrooves2} />
                    <View style={[styles.vinylLabel, { backgroundColor: featuredAlbum.CUSTOM_COLOR_HEX || '#222' }]}>
                      <Image 
                        source={featuredAlbum.IMAGE_URL ? { uri: featuredAlbum.IMAGE_URL } : require('../../assets/logo_real_transparent.png')} 
                        style={StyleSheet.absoluteFill} resizeMode={featuredAlbum.IMAGE_URL ? "cover" : "contain"}
                      />
                      <View style={styles.vinylHole} />
                    </View>
                  </Animated.View>
                  <View style={[styles.albumInner, { overflow: 'hidden' }]}>
                    <Image 
                      source={featuredAlbum.IMAGE_URL ? { uri: featuredAlbum.IMAGE_URL } : require('../../assets/logo_real_transparent.png')} 
                      style={styles.featuredCover} resizeMode={featuredAlbum.IMAGE_URL ? "cover" : "contain"}
                    />
                    <Animated.View style={[styles.shimmerEffect, { transform: [{ translateX: shimmerTranslate }] }]}>
                      <LinearGradient
                        colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                        start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={StyleSheet.absoluteFill}
                      />
                    </Animated.View>
                  </View>
                </View>
                {featuredAlbum.STATUS === 'WISH' && (
                  <View style={styles.wishIconBadge}>
                    <Text style={styles.wishIconText}>WISH</Text>
                  </View>
                )}
                {featuredAlbum.STATUS === 'OWNED' && (
                  <View style={styles.ownedIconBadge}>
                    <Text style={styles.ownedIconText}>COLLECTED</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.featuredEmpty}>
                <Text style={{ color: themeColors.textSecondary, fontSize: 13, textAlign: 'center' }}>
                  대표 LP{'\n'}미지정
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('mobile.my.analysisTitle')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          <AnalyticsCard title={t('stats.marketPrice')} value={collectionValue.toLocaleString()} unit="₩" sub={t('stats.marketPriceSub')} themeColors={themeColors} glassIntensity={glassIntensity} />
          <AnalyticsCard title={t('stats.actualSpent')} value={t('mobile.my.spentPrivateShort')} unit="" sub={t('stats.actualSpentSub')} themeColors={themeColors} isSpent={true} isSpentPublic={false} glassIntensity={glassIntensity} />
          <AnalyticsCard title={t('stats.ownedLp')} value={ownedCount.toLocaleString()} sub={t('stats.ownedLpSub')} themeColors={themeColors} glassIntensity={glassIntensity} />
          <AnalyticsCard title={t('stats.interestGenre')} value={topGenre} sub="" themeColors={themeColors} glassIntensity={glassIntensity} />
          <AnalyticsCard title={t('stats.actualTopGenre')} value={actualTopGenre} sub={t('stats.actualTopGenreSub')} themeColors={themeColors} glassIntensity={glassIntensity} />
        </ScrollView>
      </View>

      {canView && (
        <View style={[styles.tabRow, { borderBottomColor: themeColors.border }]}>
          {(['collection', 'wishlist', 'diary'] as const).map((key) => (
            <TouchableOpacity
              key={key}
              onPress={() => { setTab(key); if (key === 'diary') loadDiary(); }}
              style={[styles.tabBtn, tab === key && { borderBottomColor: themeColors.accent, borderBottomWidth: 2 }]}
            >
              <Text style={{ color: tab === key ? themeColors.textPrimary : themeColors.textSecondary, fontWeight: '600' }}>
                {key === 'collection' ? t('nav.collection') : key === 'wishlist' ? t('nav.wishlist') : t('nav.log')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={[styles.screenHeader, { paddingTop: insets.top + 12, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
          <Feather name="chevron-left" size={24} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.screenHeaderTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
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
      ) : tab === 'collection' || tab === 'wishlist' ? (
        <FlatList
          key={tab}
          data={tab === 'wishlist' ? (allAlbums?.filter(a => a.STATUS === 'WISH') || []) : (albums || [])}
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
            <TouchableOpacity onPress={() => setSelectedAlbum(item)}>
              <Image
                source={item.IMAGE_URL ? { uri: item.IMAGE_URL } : undefined}
                style={{ width: itemSize, height: itemSize, borderRadius: 8, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.06)' }}
              />
            </TouchableOpacity>
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
      
      <DetailModal
        album={selectedAlbum}
        visible={!!selectedAlbum}
        onClose={() => setSelectedAlbum(null)}
      />
    </View>
  );
};

const stylesStatic = StyleSheet.create({
  card: { width: 140, height: 140, borderRadius: 16, padding: 16, marginRight: 16, justifyContent: 'space-between', borderWidth: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  cardValue: { fontSize: 28, fontWeight: '800' },
  cardUnit: { fontSize: 18, fontWeight: '600' },
  cardSub: { fontSize: 11, marginTop: 4 },
  spentToggleBtn: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.2)' },
  spentToggleText: { fontSize: 10, fontWeight: '600' },
});

const getStyles = (themeColors: any) => StyleSheet.create({
  screenHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1,
  },
  screenHeaderTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  heroSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  profileLeft: { flex: 1, alignItems: 'flex-start' },
  avatarFrame: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  profileName: { fontSize: IS_NARROW_SCREEN ? 20 : 24, fontWeight: '800', marginTop: 12 },
  profileRight: { width: FEATURED_FRAME_WIDTH, alignItems: 'center', justifyContent: 'center' },
  featuredFrame: { width: FEATURED_FRAME_WIDTH, height: FEATURED_FRAME_HEIGHT, backgroundColor: 'transparent', justifyContent: 'center', paddingLeft: 12 },
  cubbyContainer: { width: '100%', height: '100%', justifyContent: 'center' },
  albumShadowBox: { zIndex: 1 },
  albumInner: { width: ALBUM_INNER_SIZE, height: ALBUM_INNER_SIZE, zIndex: 2, backgroundColor: '#0a0a0a', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(197, 160, 89, 0.15)', borderRadius: 8 },
  featuredCover: { width: '100%', height: '100%' },
  wishIconBadge: { position: 'absolute', top: -16, right: -4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#C5A059', backgroundColor: 'rgba(10, 10, 10, 0.8)', transform: [{ rotate: '5deg' }] },
  wishIconText: { color: '#C5A059', fontWeight: '900', fontSize: 14, fontStyle: 'italic', textShadowColor: 'rgba(197, 160, 89, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  ownedIconBadge: { position: 'absolute', top: -16, right: -4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#C5A059', backgroundColor: 'rgba(10, 10, 10, 0.8)', transform: [{ rotate: '-3deg' }] },
  ownedIconText: { color: '#F0E6D2', fontWeight: '900', fontSize: 14, fontStyle: 'italic', textShadowColor: 'rgba(197, 160, 89, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  featuredEmpty: { alignItems: 'center', justifyContent: 'center' },
  vinylDisc: { position: 'absolute', left: VINYL_DISC_LEFT, width: VINYL_DISC_SIZE, height: VINYL_DISC_SIZE, borderRadius: VINYL_DISC_SIZE / 2, backgroundColor: '#0a0a0a', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', zIndex: 1, overflow: 'hidden' },
  vinylGrooves: { position: 'absolute', width: VINYL_GROOVE_1_SIZE, height: VINYL_GROOVE_1_SIZE, borderRadius: VINYL_GROOVE_1_SIZE / 2, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.05)' },
  vinylGrooves2: { position: 'absolute', width: VINYL_GROOVE_2_SIZE, height: VINYL_GROOVE_2_SIZE, borderRadius: VINYL_GROOVE_2_SIZE / 2, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.05)' },
  vinylLabel: { width: VINYL_LABEL_SIZE, height: VINYL_LABEL_SIZE, borderRadius: VINYL_LABEL_SIZE / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  vinylHole: { position: 'absolute', width: VINYL_HOLE_SIZE, height: VINYL_HOLE_SIZE, borderRadius: VINYL_HOLE_SIZE / 2, backgroundColor: '#111' },
  shimmerEffect: { position: 'absolute', top: 0, left: 0, width: 100, height: '100%', transform: [{ skewX: '-20deg' }], zIndex: 10, pointerEvents: 'none' },
  followBtn: { marginTop: 12, paddingHorizontal: 22, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  section: { marginTop: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 16, paddingHorizontal: 20 },
  horizontalScroll: { paddingHorizontal: 20 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 8 },
  tabBtn: { paddingVertical: 12, paddingHorizontal: 20, marginHorizontal: 4 },
  diaryItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 5, padding: 12, borderWidth: 1, borderRadius: 14 },
});

