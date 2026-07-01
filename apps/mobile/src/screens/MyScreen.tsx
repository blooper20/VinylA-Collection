import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme, ThemeType } from '@vinyla/ui';
import { mockVinyls } from '@vinyla/shared-types';
import { useAuthStore, getUserVinyls, mapToFrontendModel } from '@vinyla/core-api';
import { BadgeSelectModal } from '../components/Modal/BadgeSelectModal';
import { FlashEffect } from '../components/Share/FlashEffect';
import { NativeToast } from '../components/Toast/NativeToast';
import { shareToInstagramStory } from '../utils/nativeShare';
import { ShareTemplate } from '../components/Share/ShareTemplate';

const { width } = Dimensions.get('window');

const AnalyticsCard = ({ title, value, themeColors }: { title: string, value: string | number, themeColors: any }) => (
  <View style={[styles.card, { borderColor: themeColors.border, backgroundColor: 'rgba(255,255,255,0.02)' }]}>
    <Text style={[styles.cardTitle, { color: themeColors.textSecondary }]}>{title}</Text>
    <Text style={[styles.cardValue, { color: themeColors.textPrimary }]}>{value}</Text>
  </View>
);

export const MyScreen = () => {
  const { theme, setTheme, themeColors } = useTheme();
  const { user, updateSelectedBadge } = useAuthStore();
  const navigation = useNavigation<any>();

  const [isBadgeModalVisible, setBadgeModalVisible] = React.useState(false);
  const [flashVisible, setFlashVisible] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const [isToastVisible, setIsToastVisible] = React.useState(false);
  const viewRef = React.useRef(null);

  // States for real data
  const [collectionValue, setCollectionValue] = React.useState(0);
  const [ownedCount, setOwnedCount] = React.useState(0);
  const [topGenre, setTopGenre] = React.useState('-');
  const [recentAdditions, setRecentAdditions] = React.useState<any[]>([]);

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

          const mapped = data.map(v => mapToFrontendModel(v, null));
          const mappedOwned = mapped.filter(v => v.STATUS === 'OWNED');
          setRecentAdditions(mappedOwned.slice(0, 3));

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
            setTopGenre(sortedGenres[0][0]);
          } else {
            setTopGenre(currentGenre);
          }
        }
      } catch (e) {
        console.error('Failed to load stats', e);
      }
    }
    loadStats();
  }, [user]);

  // Mock available badges, in real app this would sync with web's badges.ts
  const unlockedBadges = user?.user_metadata?.unlocked_badges || [];
  const selectedBadgeId = user?.user_metadata?.selected_badge || 'elite-curator';
  const availableBadges = [
    { id: 'elite-curator', name: 'ELITE CURATOR', isEarned: unlockedBadges.includes('elite-curator') || true },
    { id: 'vinyl-master', name: 'VINYL MASTER', isEarned: unlockedBadges.includes('vinyl-master') },
    { id: 'jazz-cat', name: 'JAZZ CAT', isEarned: unlockedBadges.includes('jazz-cat') },
  ];

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
        <View style={[styles.avatarFrame, { borderColor: themeColors.accent }]}>
          <Image 
            source={{ uri: user?.user_metadata?.avatar_url || 'https://i.pravatar.cc/150?img=32' }} 
            style={styles.avatar} 
          />
        </View>
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
          <AnalyticsCard title="총 가치" value={`$${collectionValue.toLocaleString()}`} themeColors={themeColors} />
          <AnalyticsCard title="보유 앨범" value={ownedCount.toLocaleString()} themeColors={themeColors} />
          <AnalyticsCard title="최애 장르" value={topGenre} themeColors={themeColors} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 40,
  },
  avatarFrame: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 12,
    textTransform: 'uppercase',
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
