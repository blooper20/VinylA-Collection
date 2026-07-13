import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, Animated, Easing, RefreshControl, Share, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, ThemeType, shadows, shape } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { mockVinyls } from '@vinyla/shared-types';
import { useAuthStore, getUserVinyls, mapToFrontendModel, BADGES, Badge, UserStats, evaluateBadges, supabase, getBadgeText, getSignupNumber } from '@vinyla/core-api';
import * as ImagePicker from 'expo-image-picker';
// v19 (SDK 54) moved readAsStringAsync to the legacy entry point
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeSelectModal } from '../components/Modal/BadgeSelectModal';
import { FoundingBadgeCelebrationModal } from '../components/Modal/FoundingBadgeCelebrationModal';
import { FlashEffect } from '../components/Share/FlashEffect';
import { NativeToast } from '../components/Toast/NativeToast';
import { shareToInstagramStory } from '../utils/nativeShare';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'base64-arraybuffer';

import { FeaturedLPModal } from '../components/Modal/FeaturedLPModal';
import { GenreSelectModal } from '../components/Modal/GenreSelectModal';
import { NicknameEditModal } from '../components/Modal/NicknameEditModal';
import { DeleteAccountModal } from '../components/Modal/DeleteAccountModal';

const { width } = Dimensions.get('window');
// Avatar + featured-LP frame + paddings can overflow narrow phones
// (e.g. 320px-wide devices), so scale both down below a width threshold.
const IS_NARROW_SCREEN = width < 380;
const AVATAR_SIZE = IS_NARROW_SCREEN ? 92 : 120;
const FEATURED_FRAME_WIDTH = IS_NARROW_SCREEN ? 130 : 155;
const FEATURED_FRAME_HEIGHT = IS_NARROW_SCREEN ? 100 : 120;
// The vinyl disc peeking out from behind the cover art is sized/positioned
// off a 155px-wide frame baseline — scale every dimension together so it
// doesn't spill out of a narrower frame.
const FEATURED_SCALE = FEATURED_FRAME_WIDTH / 155;
const ALBUM_INNER_SIZE = Math.round(88 * FEATURED_SCALE);
const VINYL_DISC_SIZE = Math.round(86 * FEATURED_SCALE);
const VINYL_DISC_LEFT = Math.round(45 * FEATURED_SCALE);
const VINYL_GROOVE_1_SIZE = Math.round(74 * FEATURED_SCALE);
const VINYL_GROOVE_2_SIZE = Math.round(60 * FEATURED_SCALE);
const VINYL_LABEL_SIZE = Math.round(30 * FEATURED_SCALE);
const VINYL_HOLE_SIZE = Math.round(4 * FEATURED_SCALE);

const AnalyticsCard = ({ title, value, unit, sub, themeColors, isSpent, isSpentPublic, onToggleSpent, glassIntensity, onPress }: any) => {
  const { t } = useLocale();
  const editable = !!onPress;
  const content = (
    <BlurView
      intensity={glassIntensity || 30}
      tint="dark"
      style={[
        styles.card,
        {
          borderColor: editable ? 'rgba(212,175,55,0.3)' : themeColors.border,
          backgroundColor: editable ? 'rgba(212,175,55,0.04)' : 'rgba(20,20,20,0.4)',
          overflow: 'hidden',
        },
      ]}
    >
      <View>
        <Text style={[styles.cardTitle, { color: themeColors.textSecondary }]} numberOfLines={1}>{title}</Text>
        <Text
          style={[styles.cardValue, { color: themeColors.textPrimary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
        >
          {unit ? <Text style={styles.cardUnit}>{unit}</Text> : null}
          {value}
        </Text>
        {sub && <Text style={[styles.cardSub, { color: themeColors.textSecondary }]} numberOfLines={1}>{sub}</Text>}
      </View>
      {editable && (
        <Feather name="edit-2" size={11} color="rgba(212,175,55,0.55)" style={styles.cardEditIcon} />
      )}
      {isSpent && (
        <TouchableOpacity
          onPress={onToggleSpent}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={[
            styles.spentToggleBtn,
            { borderColor: isSpentPublic ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.15)' }
          ]}
        >
          <Text
            style={[styles.spentToggleText, { color: isSpentPublic ? '#d4af37' : 'rgba(255,255,255,0.4)' }]}
            numberOfLines={1}
          >
            {isSpentPublic ? t('mobile.my.spentPublicShort') : t('mobile.my.spentPrivateShort')}
          </Text>
        </TouchableOpacity>
      )}
    </BlurView>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ height: 140 }}>{content}</TouchableOpacity>;
  }
  return content;
};

export const MyScreen = () => {
  const { theme, themeColors, glassIntensity, setGlassIntensity } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const { user, updateSelectedBadge, updateFeaturedAlbum, updateUnlockedBadges, updateProfile, markFoundingCelebrationSeen, deleteAccount } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [isBadgeModalVisible, setBadgeModalVisible] = React.useState(false);
  const [isFeaturedModalVisible, setFeaturedModalVisible] = React.useState(false);
  const [isGenreModalVisible, setGenreModalVisible] = React.useState(false);
  const [isNicknameModalVisible, setNicknameModalVisible] = React.useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = React.useState(false);
  const [isDeleteModalVisible, setDeleteModalVisible] = React.useState(false);
  const [flashVisible, setFlashVisible] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const [isToastVisible, setIsToastVisible] = React.useState(false);
  const [isSpentPublic, setIsSpentPublic] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const viewRef = React.useRef(null);

  // States for real data
  const [collectionValue, setCollectionValue] = React.useState(0);
  const [actualSpentValue, setActualSpentValue] = React.useState(0);
  const [ownedCount, setOwnedCount] = React.useState(0);
  const [topGenre, setTopGenre] = React.useState('-');
  const [actualTopGenre, setActualTopGenre] = React.useState('-');
  const [recentAdditions, setRecentAdditions] = React.useState<any[]>([]);
  const [allAlbums, setAllAlbums] = React.useState<any[]>([]);
  const [signupNumber, setSignupNumber] = React.useState<number | null>(null);
  const [showFoundingCelebration, setShowFoundingCelebration] = React.useState(false);

  const featuredAlbumId = user?.user_metadata?.featured_album_id || null;
  const featuredAlbum = allAlbums.find(a => Number(a.ALBUM_ID) === Number(featuredAlbumId));

  const spinAnim = React.useRef(new Animated.Value(0)).current;
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;
  const holoAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (featuredAlbum) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 12000,
          useNativeDriver: true,
          easing: Easing.linear
        })
      ).start();

      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
          easing: Easing.linear
        })
      ).start();
    }
  }, [featuredAlbum, spinAnim, shimmerAnim]);

  React.useEffect(() => {
    Animated.loop(
      Animated.timing(holoAnim, { toValue: 1, duration: 3000, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, [holoAnim]);

  const HOLO_COLORS = ['#ff6ec4', '#ffd76e', '#6effe0', '#6e9fff', '#d76eff'] as const;
  const holoShimmerTranslate = holoAnim.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] });
  const holoTextColor = holoAnim.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
    outputRange: [...HOLO_COLORS, HOLO_COLORS[0]],
  });

  const spinRotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const shimmerTranslate = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [-200, 200] });

  const loadStats = React.useCallback(async () => {
    if (!user) return;
    try {
      let currentGenre = '-';
      if (user.user_metadata?.interests && user.user_metadata.interests.length > 0) {
        currentGenre = user.user_metadata.interests[0];
      }

      const data = await getUserVinyls(user.id);
      if (data && data.length > 0) {
        const owned = data.filter(v => v.STATUS === 'OWNED');
        setOwnedCount(owned.length);
        
        const value = owned.reduce((sum, item) => sum + (item.ALBUM_MASTER?.MARKET_PRICE || 0), 0);
        setCollectionValue(value);

        const spent = owned.reduce((sum, item) => sum + (item.PURCHASE_PRICE || 0), 0);
        setActualSpentValue(spent);

        const mapped = data.map(v => mapToFrontendModel(v, null));
        const mappedOwned = mapped.filter(v => v.STATUS === 'OWNED');
        const mappedWish = mapped.filter(v => v.STATUS === 'WISH');
        // 최근 수집 기록: 저장 시점 최신순 상위 3개 (웹 마이페이지와 동일 수정)
        setRecentAdditions(
          [...mappedOwned]
            .sort((a, b) => new Date(b.PURCHASE_DATE || 0).getTime() - new Date(a.PURCHASE_DATE || 0).getTime())
            .slice(0, 3)
        );
        setAllAlbums(mapped.filter(v => v.STATUS !== 'NONE'));

        const genreCounts: Record<string, number> = {};
        mappedOwned.forEach(item => {
          if (item.GENRES && Array.isArray(item.GENRES)) {
            item.GENRES.forEach((g: string) => {
              genreCounts[g] = (genreCounts[g] || 0) + 1;
            });
          }
        });
        if (Object.keys(genreCounts).length > 0) {
          const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
          setActualTopGenre(sortedGenres[0][0]);
        } else {
          setActualTopGenre('-');
        }
        setTopGenre(currentGenre);

        let highestMarketPrice = 0;
        let highestPurchasePrice = 0;
        mappedOwned.forEach(item => {
          const mp = item.MARKET_PRICE || 0;
          if (mp > highestMarketPrice) highestMarketPrice = mp;
          if ((item.PURCHASE_PRICE || 0) > highestPurchasePrice) highestPurchasePrice = item.PURCHASE_PRICE || 0;
        });

        let totalWishPrice = 0;
        const wishGenres: Record<string, number> = {};
        mappedWish.forEach(item => {
          totalWishPrice += (item.MARKET_PRICE || 0);
          if (item.GENRES && Array.isArray(item.GENRES)) {
            item.GENRES.forEach((g: string) => {
              wishGenres[g] = (wishGenres[g] || 0) + 1;
            });
          }
        });

        const fetchedSignupNumber = await getSignupNumber(user.id);
        setSignupNumber(fetchedSignupNumber);

        const stats: UserStats = {
          ownedCount: mappedOwned.length,
          wishCount: mappedWish.length,
          totalMarketPrice: value,
          totalWishPrice,
          highestMarketPrice,
          highestPurchasePrice,
          averageMarketPrice: mappedOwned.length > 0 ? value / mappedOwned.length : 0,
          favoriteGenre: currentGenre,
          ownedGenres: genreCounts,
          wishGenres,
          signupNumber: fetchedSignupNumber ?? undefined
        };

        const newlyUnlocked = evaluateBadges(stats);
        const previouslyUnlocked = user.user_metadata?.unlocked_badges || [];
        
        const newBadges = newlyUnlocked.filter(b => !previouslyUnlocked.includes(b));
        if (newBadges.length > 0) {
           const nextBadges = Array.from(new Set([...previouslyUnlocked, ...newlyUnlocked]));
           await updateUnlockedBadges(nextBadges);

           const toastWorthyBadges = newBadges.filter(id => id !== 'founding_100');
           if (toastWorthyBadges.length > 0) {
             const newBadgeNames = toastWorthyBadges
               .map(id => BADGES.find(b => b.id === id))
               .filter((b): b is Badge => Boolean(b))
               .map(b => getBadgeText(b, locale, t).name)
               .join(', ');

             setToastMessage(t('my.badgeUnlocked', { names: newBadgeNames }));
             setIsToastVisible(true);
           }
        }

        // founding_100's grand celebration is keyed off "have they seen it
        // yet" rather than "was it newly unlocked this session" — accounts
        // that silently got the badge before this modal existed would
        // otherwise never see it, since it'd never show up as "new" again.
        if (newlyUnlocked.includes('founding_100') && !user.user_metadata?.founding_celebration_seen) {
          setShowFoundingCelebration(true);
          markFoundingCelebrationSeen();
        }

      } else {
        setTopGenre(currentGenre);
        setActualTopGenre('-');
      }
    } catch (e) {
      console.error('Failed to load stats', e);
    }
  }, [user, updateUnlockedBadges, markFoundingCelebrationSeen, locale, t]);

  // Refresh on every focus (not just mount) so stats reflect albums added
  // via Scan while the My tab was already mounted in the background.
  useFocusEffect(
    React.useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadStats(),
      new Promise(resolve => setTimeout(resolve, 800))
    ]);
    setRefreshing(false);
  }, [loadStats]);

  const unlockedBadges = user?.user_metadata?.unlocked_badges || [];
  const selectedBadgeId = user?.user_metadata?.selected_badge || 'owned_1';
  
  const availableBadges = BADGES.map(badge => ({
    ...badge,
    isEarned: unlockedBadges.includes(badge.id) || badge.id === 'owned_1'
  }));

  const selectedBadgeObj = availableBadges.find(b => b.id === selectedBadgeId) || availableBadges[0];

  const handleShare = async () => {
    if (user?.id) {
      const name = encodeURIComponent(user.user_metadata?.displayName || 'Collector');
      const avatar = encodeURIComponent(user.user_metadata?.avatar_url || '/logo.png');
      const badge = encodeURIComponent(user.user_metadata?.selected_badge || '');
      const genre = encodeURIComponent(topGenre || '');
      const featured = encodeURIComponent(user.user_metadata?.featured_album_id || '');
      const sp = isSpentPublic ? '1' : '0';
      
      const baseUrl = process.env.EXPO_PUBLIC_WEB_URL || 'https://vinyla.vercel.app';
      const link = `${baseUrl}/user/${user.id}/dashboard?n=${name}&a=${avatar}&b=${badge}&g=${genre}&f=${featured}&sp=${sp}`;
      
      try {
        await Share.share({
          message: t('mobile.home.shareMessage', { name: user.user_metadata?.displayName || t('common.defaultCollectorName'), link }),
        });
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleBadgeSelect = async (badge: any) => {
    setBadgeModalVisible(false);
    if (badge.isEarned) {
      await updateSelectedBadge(badge.id);
      setToastMessage(t('mobile.my.badgeEquipped', { name: getBadgeText(badge, locale, t, { number: signupNumber ?? '' }).name }));
      setIsToastVisible(true);
    } else {
      setToastMessage(t('mobile.my.badgeNotEarned'));
      setIsToastVisible(true);
    }
  };

  const handleFeaturedSelect = async (albumId: string | number | null) => {
    const numericId = albumId ? Number(albumId) : null;
    await updateFeaturedAlbum(numericId);
    setToastMessage(numericId ? t('mobile.my.featuredSet') : t('mobile.my.featuredUnset'));
    setIsToastVisible(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background, paddingTop: insets.top }} ref={viewRef as any} collapsable={false}>
      <ScrollView
        style={[styles.container, { backgroundColor: 'transparent' }]}
        contentContainerStyle={{ paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
        bounces={true}
        alwaysBounceVertical={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeColors.accent || '#E9C349'}
            title={t('mobile.my.refreshing')}
            titleColor={themeColors.accent || '#E9C349'}
            colors={[themeColors.accent || '#E9C349']}
            progressViewOffset={20}
          />
        }
      >
      <View style={styles.heroSection}>
        <View style={styles.profileLeft}>
          <TouchableOpacity 
            style={[styles.avatarFrame, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: themeColors.accent, borderWidth: 1.5 }]} 
            onPress={async () => {
              try {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ['images'],
                  allowsEditing: true,
                  aspect: [1, 1],
                  quality: 0.5,
                });

                if (!result.canceled && result.assets && result.assets.length > 0) {
                  setIsUploading(true);
                  try {
                    const uri = result.assets[0].uri;
                    const fileExt = uri.split('.').pop() || 'jpeg';
                    // Per-user folder so the storage RLS policy can verify ownership
                    const filePath = `${user?.id}/avatar-${Date.now()}.${fileExt}`;
                    
                    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
                    
                    const { error } = await supabase.storage
                      .from('avatars')
                      .upload(filePath, decode(base64), { contentType: `image/${fileExt}` });
                      
                    if (error) throw error;
                    
                    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
                    
                    await updateProfile(
                      user?.user_metadata?.displayName || t('common.defaultCollectorName'),
                      user?.user_metadata?.interests || [],
                      data.publicUrl
                    );

                    setToastMessage(t('mobile.my.avatarUpdated'));
                    setIsToastVisible(true);
                  } finally {
                    setIsUploading(false);
                  }
                }
              } catch (error) {
                console.error(error);
                setToastMessage(t('mobile.my.uploadFailed'));
                setIsToastVisible(true);
              }
            }}
          >
            <Image 
              source={{ uri: user?.user_metadata?.avatar_url || 'https://i.pravatar.cc/150?img=32' }} 
              style={styles.avatar} 
            />
            {isUploading && (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={themeColors.accent} />
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setNicknameModalVisible(true)} style={styles.nicknameRow}>
            <Text style={[styles.userName, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {user?.user_metadata?.displayName || t('common.defaultCollectorName')}
            </Text>
            <Feather name="edit-2" size={13} color={themeColors.textSecondary} style={styles.nicknameEditIcon} />
          </TouchableOpacity>
          <View style={styles.badgeRow}>
            <TouchableOpacity
              style={[styles.badge, selectedBadgeObj.id === 'founding_100' ? styles.badgeHolo : { backgroundColor: themeColors.accent }]}
              onPress={() => setBadgeModalVisible(true)}
            >
              {selectedBadgeObj.id === 'founding_100' && (
                <>
                  <LinearGradient
                    colors={HOLO_COLORS}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Animated.View style={[styles.badgeHoloShimmer, { transform: [{ translateX: holoShimmerTranslate }] }]}>
                    <LinearGradient
                      colors={['transparent', 'rgba(255,255,255,0.7)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </Animated.View>
                </>
              )}
              {selectedBadgeObj.id === 'founding_100' ? (
                <Animated.Text style={[styles.badgeText, { color: holoTextColor }]}>
                  {getBadgeText(selectedBadgeObj, locale, t, { number: signupNumber ?? '' }).name}
                </Animated.Text>
              ) : (
                <Text style={styles.badgeText}>{getBadgeText(selectedBadgeObj, locale, t, { number: signupNumber ?? '' }).name}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.shareIconBtn, { borderColor: themeColors.border }]}
              onPress={handleShare}
            >
              <Feather name="share-2" size={14} color={themeColors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.profileRight}>
          <TouchableOpacity 
            style={styles.featuredFrame}
            onPress={() => setFeaturedModalVisible(true)}
            activeOpacity={0.8}
          >
            {featuredAlbum ? (
              <View style={styles.cubbyContainer}>
                <View style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  marginTop: -40,
                  marginLeft: -40,
                  width: 80,
                  height: 80,
                  backgroundColor: '#ff8c00',
                  borderRadius: 40,
                  shadowColor: '#ffaa00',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 1,
                  shadowRadius: 40,
                  elevation: 20,
                  zIndex: 0
                }} />

                <View style={styles.albumShadowBox}>
                  <Animated.View style={[styles.vinylDisc, { transform: [{ rotate: spinRotate }] }]}>
                    <LinearGradient
                      colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.08)']}
                      style={StyleSheet.absoluteFill}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    />
                    <View style={styles.vinylGrooves} />
                    <View style={styles.vinylGrooves2} />
                    <View style={[styles.vinylLabel, { backgroundColor: featuredAlbum.CUSTOM_COLOR_HEX || '#222' }]}>
                      <Image 
                        source={featuredAlbum.IMAGE_URL ? { uri: featuredAlbum.IMAGE_URL } : require('../../assets/logo_real_transparent.png')} 
                        style={StyleSheet.absoluteFill} 
                        resizeMode={featuredAlbum.IMAGE_URL ? "cover" : "contain"}
                      />
                      <View style={styles.vinylHole} />
                    </View>
                  </Animated.View>

                  <View style={[styles.albumInner, { overflow: 'hidden' }]}>
                    <Image 
                      source={featuredAlbum.IMAGE_URL ? { uri: featuredAlbum.IMAGE_URL } : require('../../assets/logo_real_transparent.png')} 
                      style={styles.featuredCover} 
                      resizeMode={featuredAlbum.IMAGE_URL ? "cover" : "contain"}
                    />
                    <Animated.View style={[styles.shimmerEffect, { transform: [{ translateX: shimmerTranslate }] }]}>
                      <LinearGradient
                        colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                        start={{x: 0, y: 0}}
                        end={{x: 1, y: 0}}
                        style={StyleSheet.absoluteFill}
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
                <Text style={{ color: themeColors.textSecondary, fontSize: 32, marginBottom: 8 }}>+</Text>
                <Text style={{ color: themeColors.textSecondary, fontSize: 14 }}>{t('featuredLp.title')}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('mobile.my.analysisTitle')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          <AnalyticsCard title={t('stats.marketPrice')} value={collectionValue.toLocaleString()} unit="₩" sub={t('stats.marketPriceSub')} themeColors={themeColors} glassIntensity={glassIntensity} />
          <AnalyticsCard
            title={t('stats.actualSpent')}
            value={isSpentPublic ? actualSpentValue.toLocaleString() : t('mobile.my.spentPrivateShort')}
            unit={isSpentPublic ? "₩" : ""}
            sub={t('stats.actualSpentSub')}
            themeColors={themeColors}
            isSpent={true}
            isSpentPublic={isSpentPublic}
            onToggleSpent={() => setIsSpentPublic(!isSpentPublic)}
            glassIntensity={glassIntensity}
          />
          <AnalyticsCard title={t('stats.ownedLp')} value={ownedCount.toLocaleString()} sub={t('stats.ownedLpSub')} themeColors={themeColors} glassIntensity={glassIntensity} />
          <AnalyticsCard
            title={t('stats.interestGenre')}
            value={(user?.user_metadata?.interests && user?.user_metadata?.interests.length > 0)
              ? user.user_metadata.interests[0]
              : t('mobile.my.noneFallback')}
            sub={(user?.user_metadata?.interests && user.user_metadata.interests.length > 1)
              ? t('mobile.my.moreCount', { count: user.user_metadata.interests.length - 1 })
              : ""}
            themeColors={themeColors}
            glassIntensity={glassIntensity}
            onPress={() => setGenreModalVisible(true)}
          />
          <AnalyticsCard title={t('stats.actualTopGenre')} value={actualTopGenre} sub={t('stats.actualTopGenreSub')} themeColors={themeColors} glassIntensity={glassIntensity} />
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('mobile.my.journeyTitle')}</Text>
        <View style={styles.timeline}>
          {recentAdditions.length > 0 ? recentAdditions.map((album, index) => (
            <View key={album.ALBUM_ID + '-' + index} style={styles.timelineItem}>
              <View style={[styles.timelineLine, { backgroundColor: themeColors.border }]} />
              <View style={[styles.timelineDot, { backgroundColor: themeColors.accent }]} />
              <Image
                source={album.IMAGE_URL ? { uri: album.IMAGE_URL } : require('../../assets/logo_real_transparent.png')}
                style={styles.timelineImage}
                resizeMode={album.IMAGE_URL ? "cover" : "contain"}
              />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>{album.TITLE}</Text>
                <Text style={[styles.timelineDate, { color: themeColors.textSecondary }]}>{t('mobile.my.recentlyAdded')}</Text>
              </View>
            </View>
          )) : (
            <Text style={{ color: themeColors.textSecondary, marginLeft: 20 }}>{t('my.noRecentLp')}</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.settingsToggleBtn}
          onPress={() => setIsSettingsExpanded(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={[styles.settingsToggleText, { color: themeColors.textPrimary }]}>{isSettingsExpanded ? t('mobile.my.settingsToggleClose') : t('mobile.my.settingsToggleOpen')}</Text>
          <Feather name={isSettingsExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <View style={[styles.settingsDivider, { backgroundColor: themeColors.border }]} />

        {isSettingsExpanded && (
          <View style={{ marginTop: 20 }}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{t('mobile.my.glassIntensityTitle')}</Text>
            <View style={{ flexDirection: 'row', paddingHorizontal: 20, justifyContent: 'space-between', gap: 8 }}>
              {[10, 30, 50, 70, 90].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.themeBtn,
                    {
                      borderColor: glassIntensity === val ? themeColors.accent : themeColors.border,
                      backgroundColor: glassIntensity === val ? 'rgba(197, 160, 89, 0.15)' : 'rgba(255,255,255,0.02)'
                    }
                  ]}
                  onPress={async () => {
                    setGlassIntensity(val);
                    try {
                      await AsyncStorage.setItem('glassIntensity', val.toString());
                    } catch (e) {}
                  }}
                >
                  <Text style={[styles.themeBtnText, { color: glassIntensity === val ? themeColors.accent : themeColors.textSecondary }]}>
                    {val === 10 ? t('mobile.my.weak') : val === 90 ? t('mobile.my.strong') : val}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary, marginTop: 24 }]}>{t('mobile.my.languageTitle')}</Text>
            <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 8 }}>
              {(['ko', 'en'] as const).map((loc) => (
                <TouchableOpacity
                  key={loc}
                  style={[
                    styles.themeBtn,
                    {
                      flex: 0,
                      minWidth: 72,
                      borderColor: locale === loc ? themeColors.accent : themeColors.border,
                      backgroundColor: locale === loc ? 'rgba(197, 160, 89, 0.15)' : 'rgba(255,255,255,0.02)'
                    }
                  ]}
                  onPress={() => setLocale(loc)}
                >
                  <Text style={[styles.themeBtnText, { color: locale === loc ? themeColors.accent : themeColors.textSecondary }]}>
                    {loc === 'ko' ? '한국어' : 'English'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            try {
              const { signOut } = await import('@vinyla/core-api');
              await signOut();
              // RootNavigator swaps to the Onboarding stack automatically once
              // useAuthStore's user becomes null — an explicit replace() here
              // can fire before that re-render lands, and Onboarding isn't
              // registered in the still-current Main stack yet.
            } catch (error) {
              console.error('Logout error:', error);
            }
          }}
        >
          <Text style={styles.logoutBtnText}>{t('nav.logout')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteAccountBtn}
          onPress={() => setDeleteModalVisible(true)}
        >
          <Text style={styles.deleteAccountBtnText}>{t('my.accountDelete')}</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>

      <FlashEffect visible={flashVisible} onComplete={() => setFlashVisible(false)} />
      <NativeToast message={toastMessage} visible={isToastVisible} onHide={() => setIsToastVisible(false)} />
      
      <BadgeSelectModal
        visible={isBadgeModalVisible}
        onClose={() => setBadgeModalVisible(false)}
        badges={availableBadges}
        signupNumber={signupNumber}
        onSelect={handleBadgeSelect}
      />

      <FoundingBadgeCelebrationModal
        visible={showFoundingCelebration}
        onClose={() => setShowFoundingCelebration(false)}
        signupNumber={signupNumber}
      />

      <FeaturedLPModal
        visible={isFeaturedModalVisible}
        onClose={() => setFeaturedModalVisible(false)}
        albums={allAlbums}
        currentFeaturedId={featuredAlbumId ? Number(featuredAlbumId) : null}
        onSelect={handleFeaturedSelect}
      />

      <GenreSelectModal
        visible={isGenreModalVisible}
        onClose={() => setGenreModalVisible(false)}
        initialSelected={user?.user_metadata?.interests || []}
        onSave={async (genres) => {
          await updateProfile(user?.user_metadata?.displayName || '', genres, user?.user_metadata?.avatar_url);
          setGenreModalVisible(false);
          setToastMessage(t('mobile.my.genreUpdated'));
          setIsToastVisible(true);
        }}
      />

      <NicknameEditModal
        visible={isNicknameModalVisible}
        onClose={() => setNicknameModalVisible(false)}
        initialNickname={user?.user_metadata?.displayName || ''}
        onSave={async (nickname) => {
          await updateProfile(nickname, user?.user_metadata?.interests || [], user?.user_metadata?.avatar_url);
          setNicknameModalVisible(false);
          setToastMessage(t('mobile.my.nicknameUpdated'));
          setIsToastVisible(true);
        }}
      />

      <DeleteAccountModal
        visible={isDeleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={async () => {
          // deleteAccount() sets user to null in the store, which drives
          // RootNavigator to swap to the Onboarding stack on its own.
          await deleteAccount();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  profileLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  profileRight: {
    alignItems: 'flex-end',
    marginLeft: 16,
  },
  avatarFrame: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  nicknameEditIcon: {
    marginLeft: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 0,
  },
  badgeHolo: {
    overflow: 'hidden',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  badgeHoloShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 24,
  },
  badgeText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  shareIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredFrame: {
    width: FEATURED_FRAME_WIDTH,
    height: FEATURED_FRAME_HEIGHT,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    paddingLeft: 12,
  },
  shimmerEffect: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 100,
    height: '100%',
    transform: [{ skewX: '-20deg' }],
    zIndex: 10,
    pointerEvents: 'none',
  },
  cubbyContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
  },
  albumShadowBox: {
    zIndex: 1,
  },
  albumInner: {
    width: ALBUM_INNER_SIZE,
    height: ALBUM_INNER_SIZE,
    zIndex: 2,
    ...shadows.strong,
    backgroundColor: '#0a0a0a',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197, 160, 89, 0.15)',
    borderRadius: shape.sm,
  },
  vinylDisc: {
    width: VINYL_DISC_SIZE,
    height: VINYL_DISC_SIZE,
    borderRadius: VINYL_DISC_SIZE / 2,
    backgroundColor: '#0a0a0a',
    position: 'absolute',
    left: VINYL_DISC_LEFT, // Tucked further in
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  vinylGrooves: {
    position: 'absolute',
    width: VINYL_GROOVE_1_SIZE,
    height: VINYL_GROOVE_1_SIZE,
    borderRadius: VINYL_GROOVE_1_SIZE / 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  vinylGrooves2: {
    position: 'absolute',
    width: VINYL_GROOVE_2_SIZE,
    height: VINYL_GROOVE_2_SIZE,
    borderRadius: VINYL_GROOVE_2_SIZE / 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  vinylLabel: {
    width: VINYL_LABEL_SIZE,
    height: VINYL_LABEL_SIZE,
    borderRadius: VINYL_LABEL_SIZE / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylHole: {
    position: 'absolute',
    width: VINYL_HOLE_SIZE,
    height: VINYL_HOLE_SIZE,
    borderRadius: VINYL_HOLE_SIZE / 2,
    backgroundColor: '#fffcf5',
  },
  featuredCover: {
    width: '100%',
    height: '100%',
  },
  wishIconBadge: {
    position: 'absolute',
    top: -16,
    right: -4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C5A059',
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    ...shadows.glow,
    transform: [{ rotate: '5deg' }],
  },
  wishIconText: {
    color: '#C5A059',
    fontWeight: '900',
    fontSize: 14,
    fontStyle: 'italic',
    textShadowColor: 'rgba(197, 160, 89, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  ownedIconBadge: {
    position: 'absolute',
    top: -16,
    right: -4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C5A059',
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    ...shadows.glow,
    transform: [{ rotate: '-3deg' }],
  },
  ownedIconText: {
    color: '#F0E6D2',
    fontWeight: '900',
    fontSize: 14,
    fontStyle: 'italic',
    textShadowColor: 'rgba(197, 160, 89, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  featuredEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 20,
    marginBottom: 16,
  },
  horizontalScroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    width: width * 0.4,
    height: 140,
    padding: 16,
    borderRadius: shape.md,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadows.soft,
  },
  cardTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  cardUnit: {
    fontSize: 18,
    marginRight: 4,
    fontWeight: 'normal',
  },
  cardSub: {
    fontSize: 12,
    marginTop: 6,
    opacity: 0.7,
  },
  cardEditIcon: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  spentToggleBtn: {
    position: 'absolute',
    left: 16,
    bottom: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  spentToggleText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  timeline: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 7,
    top: 20,
    bottom: -20,
    width: 2,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 32,
    marginRight: 16,
  },
  timelineImage: {
    width: 80,
    height: 80,
    borderRadius: shape.sm,
    marginRight: 16,
    ...shadows.soft,
  },
  timelineContent: {
    justifyContent: 'center',
    flex: 1,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timelineDate: {
    fontSize: 12,
  },
  themeSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  themeBtn: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197, 160, 89, 0.3)',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: shape.md,
    marginHorizontal: 4,
    backgroundColor: 'rgba(197, 160, 89, 0.05)',
  },
  themeBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  settingsToggleBtn: {
    marginHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsToggleText: {
    fontSize: 18,
    fontWeight: '800',
  },
  settingsDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  logoutBtn: {
    marginTop: 24,
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 82, 82, 0.5)',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: shape.md,
    backgroundColor: 'rgba(255, 82, 82, 0.08)',
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ff5252',
  },
  deleteAccountBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  deleteAccountBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 82, 82, 0.5)',
    textDecorationLine: 'underline',
  }
});
