import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme, ThemeType } from '@vinyla/ui';
import { mockVinyls } from '@vinyla/shared-types';
import { useAuthStore, getUserVinyls, mapToFrontendModel, BADGES, Badge, UserStats, evaluateBadges, supabase } from '@vinyla/core-api';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeSelectModal } from '../components/Modal/BadgeSelectModal';
import { FlashEffect } from '../components/Share/FlashEffect';
import { NativeToast } from '../components/Toast/NativeToast';
import { shareToInstagramStory } from '../utils/nativeShare';
import { ShareTemplate } from '../components/Share/ShareTemplate';

import { FeaturedLPModal } from '../components/Modal/FeaturedLPModal';

const { width } = Dimensions.get('window');

const AnalyticsCard = ({ title, value, unit, sub, themeColors, isSpent, isSpentPublic, onToggleSpent }: any) => (
  <View style={[styles.card, { borderColor: themeColors.border, backgroundColor: 'rgba(255,255,255,0.02)' }]}>
    <Text style={[styles.cardTitle, { color: themeColors.textSecondary }]}>{title}</Text>
    <Text style={[styles.cardValue, { color: themeColors.textPrimary }]}>
      {unit ? <Text style={styles.cardUnit}>{unit}</Text> : null}
      {value}
    </Text>
    {sub && <Text style={[styles.cardSub, { color: themeColors.textSecondary }]}>{sub}</Text>}
    {isSpent && (
      <TouchableOpacity 
        onPress={onToggleSpent}
        style={{
          marginTop: 8,
          borderWidth: 1,
          borderColor: isSpentPublic ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.15)',
          borderRadius: 12,
          paddingHorizontal: 8,
          paddingVertical: 4,
          alignSelf: 'flex-start'
        }}
      >
        <Text style={{
          color: isSpentPublic ? '#d4af37' : 'rgba(255,255,255,0.4)',
          fontSize: 10,
          fontWeight: 'bold'
        }}>
          {isSpentPublic ? '👁️ 공개됨' : '🙈 비공개 (링크에 숨김)'}
        </Text>
      </TouchableOpacity>
    )}
  </View>
);

export const MyScreen = () => {
  const { theme, setTheme, themeColors } = useTheme();
  const { user, updateSelectedBadge, updateFeaturedAlbum, updateUnlockedBadges } = useAuthStore();
  const navigation = useNavigation<any>();

  const [isBadgeModalVisible, setBadgeModalVisible] = React.useState(false);
  const [isFeaturedModalVisible, setFeaturedModalVisible] = React.useState(false);
  const [flashVisible, setFlashVisible] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const [isToastVisible, setIsToastVisible] = React.useState(false);
  const [isSpentPublic, setIsSpentPublic] = React.useState(false);
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

  React.useEffect(() => {
    async function loadStats() {
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

          // Calculate actual top genre from collection
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

          // Evaluate Badges
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
    }
    loadStats();
  }, [user]);

  const unlockedBadges = user?.user_metadata?.unlocked_badges || [];
  const selectedBadgeId = user?.user_metadata?.selected_badge || 'owned_1';
  
  const availableBadges = BADGES.map(badge => ({
    ...badge,
    isEarned: unlockedBadges.includes(badge.id) || badge.id === 'owned_1'
  }));

  const selectedBadgeObj = availableBadges.find(b => b.id === selectedBadgeId) || availableBadges[0];

  const handleShare = async () => {
    setFlashVisible(true);
    await shareToInstagramStory(viewRef);
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

  const handleThemeChange = (newTheme: ThemeType) => {
    setTheme(newTheme);
  };

  const handleFeaturedSelect = async (albumId: string | number | null) => {
    const numericId = albumId ? Number(albumId) : null;
    await updateFeaturedAlbum(numericId);
    setToastMessage(numericId ? '대표 LP가 설정되었습니다.' : '대표 LP 설정이 해제되었습니다.');
    setIsToastVisible(true);
  };

  const themes: { id: ThemeType, label: string }[] = [
    { id: 'DARK_BLACK', label: '다크 블랙' },
    { id: 'MOODY_WALNUT', label: '무디 월넛' },
    { id: 'CLEAN_DOODLING', label: '클린 두들' },
  ];

  return (
    <View style={{ flex: 1 }} ref={viewRef} collapsable={false}>
      <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Identity Section */}
      <View style={styles.heroSection}>
        <View style={styles.profileLeft}>
          <TouchableOpacity 
            style={[styles.avatarFrame, { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: themeColors.accent, borderWidth: 1.5 }]} 
            onPress={async () => {
              try {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  allowsEditing: true,
                  aspect: [1, 1],
                  quality: 0.5,
                });

                if (!result.canceled && result.assets && result.assets.length > 0) {
                  setToastMessage('프로필 이미지를 업로드하는 중입니다...');
                  setIsToastVisible(true);
                  
                  const uri = result.assets[0].uri;
                  const fileExt = uri.split('.').pop() || 'jpeg';
                  const filePath = `${user?.id}-${Date.now()}.${fileExt}`;
                  
                  const formData = new FormData();
                  formData.append('file', {
                    uri: uri,
                    name: filePath,
                    type: `image/${fileExt}`
                  } as any);
                  
                  const { error } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, formData);
                    
                  if (error) throw error;
                  
                  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
                  
                  const { updateProfile } = useAuthStore.getState();
                  await updateProfile(
                    user?.user_metadata?.displayName || '컬렉터', 
                    user?.user_metadata?.interests || [], 
                    data.publicUrl
                  );
                  
                  setToastMessage('프로필 사진이 변경되었습니다.');
                  setIsToastVisible(true);
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
          </TouchableOpacity>
          <Text style={[styles.userName, { color: themeColors.textPrimary }]}>
            {user?.user_metadata?.displayName || '컬렉터'}
          </Text>
          <TouchableOpacity 
            style={[styles.badge, { backgroundColor: themeColors.accent }]}
            onPress={() => setBadgeModalVisible(true)}
          >
            <Text style={styles.badgeText}>{selectedBadgeObj.name}</Text>
          </TouchableOpacity>
        </View>

        {/* Featured LP */}
        <View style={styles.profileRight}>
          <TouchableOpacity 
            style={styles.featuredFrame}
            onPress={() => setFeaturedModalVisible(true)}
            activeOpacity={0.8}
          >
            {featuredAlbum ? (
              <View style={styles.cubbyContainer}>
                {/* Elegant Warm Backlight */}
                <View style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  marginTop: -40,
                  marginLeft: -40,
                  width: 80,
                  height: 80,
                  backgroundColor: '#ff8c00', // Amber glow
                  borderRadius: 40,
                  shadowColor: '#ffaa00',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 1,
                  shadowRadius: 40,
                  elevation: 20,
                  zIndex: 0
                }} />

                {/* The Modern Acrylic Frame / Shadow Box */}
                <View style={styles.albumShadowBox}>
                  {/* The Spinning Vinyl (rendered first so it's behind the sleeve) */}
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
                    {/* Shimmer Effect inside cover */}
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
                

                {/* Wish badge */}
                {featuredAlbum.STATUS === 'WISH' && (
                  <View style={styles.wishIconBadge}>
                    <Text style={styles.wishIconText}>WISH</Text>
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

      {/* Theme Switcher */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>테마 설정</Text>
        <View style={styles.themeSwitcher}>
          {themes.map(t => (
            <TouchableOpacity 
              key={t.id} 
              style={[
                styles.themeBtn, 
                { borderColor: themeColors.border },
                theme === t.id && { backgroundColor: themeColors.accent, borderColor: themeColors.accent }
              ]}
              onPress={() => handleThemeChange(t.id)}
            >
              <Text style={[
                styles.themeBtnText, 
                { color: theme === t.id ? '#000' : themeColors.textSecondary }
              ]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {/* Logout Button */}
        <TouchableOpacity 
          style={[styles.logoutBtn, { borderColor: themeColors.border }]}
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
          <Text style={[styles.logoutBtnText, { color: themeColors.textPrimary }]}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      {/* Analytics */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>컬렉션 분석</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
          <AnalyticsCard title="시장 추정가" value={collectionValue.toLocaleString()} unit="₩" sub="Discogs 기준 최저가 합산" themeColors={themeColors} />
          <AnalyticsCard 
            title="실제 지출액" 
            value={isSpentPublic ? actualSpentValue.toLocaleString() : '비공개'} 
            unit={isSpentPublic ? "₩" : ""} 
            sub="입력된 구매가 합산" 
            themeColors={themeColors}
            isSpent={true}
            isSpentPublic={isSpentPublic}
            onToggleSpent={() => setIsSpentPublic(!isSpentPublic)}
          />
          <AnalyticsCard title="보유 LP" value={ownedCount.toLocaleString()} sub="등록된 전체 LP 수" themeColors={themeColors} />
          <AnalyticsCard title="관심 장르" value={topGenre} sub="프로필 설정 기준" themeColors={themeColors} />
          <AnalyticsCard title="실제 관심 장르" value={actualTopGenre} sub="내 콜렉션 데이터 기준" themeColors={themeColors} />
        </ScrollView>
      </View>

      {/* Musical Journey (Timeline) */}
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
        <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>공유하기</Text>
        <TouchableOpacity 
          style={[styles.themeBtn, { borderColor: themeColors.border, backgroundColor: themeColors.accent, marginTop: 10, marginHorizontal: 20 }]}
          onPress={handleShare}
        >
          <Text style={[styles.themeBtnText, { color: '#000', paddingVertical: 10 }]}>인스타그램 스토리에 공유하기</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>

      {/* Absolute Overlays */}
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
    paddingTop: 80,
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
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
    backgroundColor: '#000',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
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
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
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
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.2)', // More translucent
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  wishIconText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.8)', // Muted text
    letterSpacing: 1,
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
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
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
    borderRadius: 8,
    marginRight: 16,
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
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  themeBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  logoutBtn: {
    marginTop: 24,
    marginHorizontal: 20,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'rgba(255,0,0,0.05)',
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
  }
});
