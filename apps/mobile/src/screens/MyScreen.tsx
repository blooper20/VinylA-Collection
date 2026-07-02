import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, Animated, Easing, RefreshControl, Share, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme, ThemeType, shadows, shape } from '@vinyla/ui';
import { mockVinyls } from '@vinyla/shared-types';
import { useAuthStore, getUserVinyls, mapToFrontendModel, BADGES, Badge, UserStats, evaluateBadges, supabase } from '@vinyla/core-api';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeSelectModal } from '../components/Modal/BadgeSelectModal';
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

const { width } = Dimensions.get('window');

const AnalyticsCard = ({ title, value, unit, sub, themeColors, isSpent, isSpentPublic, onToggleSpent, glassIntensity, onPress }: any) => {
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
            {isSpentPublic ? '공개' : '비공개'}
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
  const { user, updateSelectedBadge, updateFeaturedAlbum, updateUnlockedBadges, updateProfile } = useAuthStore();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [isBadgeModalVisible, setBadgeModalVisible] = React.useState(false);
  const [isFeaturedModalVisible, setFeaturedModalVisible] = React.useState(false);
  const [isGenreModalVisible, setGenreModalVisible] = React.useState(false);
  const [isNicknameModalVisible, setNicknameModalVisible] = React.useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = React.useState(false);
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

  const featuredAlbumId = user?.user_metadata?.featured_album_id || null;
  const featuredAlbum = allAlbums.find(a => Number(a.ALBUM_ID) === Number(featuredAlbumId));

  const spinAnim = React.useRef(new Animated.Value(0)).current;
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

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
        setRecentAdditions(mappedOwned.slice(0, 3));
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
          wishGenres
        };

        const newlyUnlocked = evaluateBadges(stats);
        const previouslyUnlocked = user.user_metadata?.unlocked_badges || [];
        
        const newBadges = newlyUnlocked.filter(b => !previouslyUnlocked.includes(b));
        if (newBadges.length > 0) {
           const nextBadges = Array.from(new Set([...previouslyUnlocked, ...newlyUnlocked]));
           await updateUnlockedBadges(nextBadges);
           const newBadgeNames = newBadges.map(id => BADGES.find(b => b.id === id)?.name).filter(Boolean).join(', ');
           
           setToastMessage(`🎉 새로운 호칭 획득: ${newBadgeNames}`);
           setIsToastVisible(true);
        }

      } else {
        setTopGenre(currentGenre);
        setActualTopGenre('-');
      }
    } catch (e) {
      console.error('Failed to load stats', e);
    }
  }, [user, updateUnlockedBadges]);

  React.useEffect(() => {
    loadStats();
  }, [loadStats]);

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
      
      const baseUrl = process.env.EXPO_PUBLIC_WEB_URL || 'http://192.168.0.20:3000';
      const link = `${baseUrl}/user/${user.id}/dashboard?n=${name}&a=${avatar}&b=${badge}&g=${genre}&f=${featured}&sp=${sp}`;
      
      try {
        await Share.share({
          message: `🎧 ${user.user_metadata?.displayName || '컬렉터'}님의 레코드 컬렉션을 확인해보세요!\n\n${link}`,
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
      setToastMessage(`'${badge.name}' 뱃지를 장착했습니다!`);
      setIsToastVisible(true);
    } else {
      setToastMessage(`아직 획득하지 못한 뱃지입니다.`);
      setIsToastVisible(true);
    }
  };

  const handleFeaturedSelect = async (albumId: string | number | null) => {
    const numericId = albumId ? Number(albumId) : null;
    await updateFeaturedAlbum(numericId);
    setToastMessage(numericId ? '대표 LP가 설정되었습니다.' : '대표 LP 설정이 해제되었습니다.');
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
            title="새로고침 중..."
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
                    const filePath = `${user?.id}-${Date.now()}.${fileExt}`;
                    
                    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
                    
                    const { error } = await supabase.storage
                      .from('avatars')
                      .upload(filePath, decode(base64), { contentType: `image/${fileExt}` });
                      
                    if (error) throw error;
                    
                    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
                    
                    await updateProfile(
                      user?.user_metadata?.displayName || '컬렉터', 
                      user?.user_metadata?.interests || [], 
                      data.publicUrl
                    );
                    
                    setToastMessage('프로필 사진이 변경되었습니다.');
                    setIsToastVisible(true);
                  } finally {
                    setIsUploading(false);
                  }
                }
              } catch (error) {
                console.error(error);
                setToastMessage('업로드에 실패했습니다.');
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
              {user?.user_metadata?.displayName || '컬렉터'}
            </Text>
            <Feather name="edit-2" size={13} color={themeColors.textSecondary} style={styles.nicknameEditIcon} />
          </TouchableOpacity>
          <View style={styles.badgeRow}>
            <TouchableOpacity
              style={[styles.badge, { backgroundColor: themeColors.accent }]}
              onPress={() => setBadgeModalVisible(true)}
            >
              <Text style={styles.badgeText}>{selectedBadgeObj.name}</Text>
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
                <Text style={{ color: themeColors.textSecondary, fontSize: 14 }}>대표 LP 설정</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>컬렉션 분석</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          <AnalyticsCard title="시장 추정가" value={collectionValue.toLocaleString()} unit="₩" sub="Discogs 기준 최저가 합산" themeColors={themeColors} glassIntensity={glassIntensity} />
          <AnalyticsCard 
            title="실제 지출액" 
            value={isSpentPublic ? actualSpentValue.toLocaleString() : '비공개'} 
            unit={isSpentPublic ? "₩" : ""} 
            sub="입력된 구매가 합산" 
            themeColors={themeColors}
            isSpent={true}
            isSpentPublic={isSpentPublic}
            onToggleSpent={() => setIsSpentPublic(!isSpentPublic)}
            glassIntensity={glassIntensity}
          />
          <AnalyticsCard title="보유 LP" value={ownedCount.toLocaleString()} sub="등록된 전체 LP 수" themeColors={themeColors} glassIntensity={glassIntensity} />
          <AnalyticsCard 
            title="관심 장르" 
            value={(user?.user_metadata?.interests && user?.user_metadata?.interests.length > 0) 
              ? user.user_metadata.interests[0] 
              : "없음"} 
            sub={(user?.user_metadata?.interests && user.user_metadata.interests.length > 1) 
              ? `외 ${user.user_metadata.interests.length - 1}개` 
              : ""}
            themeColors={themeColors} 
            glassIntensity={glassIntensity}
            onPress={() => setGenreModalVisible(true)}
          />
          <AnalyticsCard title="실제 관심 장르" value={actualTopGenre} sub="내 콜렉션 데이터 기준" themeColors={themeColors} glassIntensity={glassIntensity} />
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>나의 레코드 여정</Text>
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
                <Text style={[styles.timelineDate, { color: themeColors.textSecondary }]}>최근 수집됨</Text>
              </View>
            </View>
          )) : (
            <Text style={{ color: themeColors.textSecondary, marginLeft: 20 }}>아직 기록된 LP가 없습니다.</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <TouchableOpacity
          style={styles.settingsToggleBtn}
          onPress={() => setIsSettingsExpanded(v => !v)}
          activeOpacity={0.7}
        >
          <Text style={[styles.settingsToggleText, { color: themeColors.textPrimary }]}>설정 {isSettingsExpanded ? '닫기' : '열기'}</Text>
          <Feather name={isSettingsExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <View style={[styles.settingsDivider, { backgroundColor: themeColors.border }]} />

        {isSettingsExpanded && (
          <View style={{ marginTop: 20 }}>
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>글래스 효과 강도</Text>
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
                    {val === 10 ? '약함' : val === 90 ? '강함' : val}
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
              navigation.replace('Onboarding');
            } catch (error) {
              console.error('Logout error:', error);
            }
          }}
        >
          <Text style={styles.logoutBtnText}>로그아웃</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>

      <FlashEffect visible={flashVisible} onComplete={() => setFlashVisible(false)} />
      <NativeToast message={toastMessage} visible={isToastVisible} onHide={() => setIsToastVisible(false)} />
      
      <BadgeSelectModal
        visible={isBadgeModalVisible}
        onClose={() => setBadgeModalVisible(false)}
        badges={availableBadges}
        onSelect={handleBadgeSelect}
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
          setToastMessage('관심 장르가 업데이트되었습니다.');
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
          setToastMessage('닉네임이 업데이트되었습니다.');
          setIsToastVisible(true);
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
    width: 120,
    height: 120,
    borderRadius: 60,
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
    width: 155, // Reduced width
    height: 120,
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
    width: 88,
    height: 88,
    zIndex: 2,
    ...shadows.strong,
    backgroundColor: '#0a0a0a',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197, 160, 89, 0.15)',
    borderRadius: shape.sm,
  },
  vinylDisc: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#0a0a0a',
    position: 'absolute',
    left: 45, // Tucked further in
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  vinylGrooves: {
    position: 'absolute',
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  vinylGrooves2: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  vinylLabel: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylHole: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fffcf5',
  },
  featuredCover: {
    width: '100%',
    height: '100%',
  },
  wishIconBadge: {
    position: 'absolute',
    top: -20,
    right: -10,
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
    top: -20,
    right: -10,
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
  }
});
