import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, Image, TouchableOpacity, StyleSheet, Dimensions, Text, Share } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { mockVinyls, MockVinylData } from '@vinyla/shared-types';
import { DetailModal } from '../components/Modal/DetailModal';
import { RandomPickModal } from '../components/Modal/RandomPickModal';
import { EmptyState } from '../components/EmptyState';
import { getUserVinyls, mapToFrontendModel, updateUserVinylOrder, supabase, useAuthStore } from '@vinyla/core-api';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, shadows, shape } from '@vinyla/ui';
import { useLocale } from '@vinyla/i18n';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { EditionCoverArt } from '../components/Edition/EditionCoverArt';
import { AppHeader, VinylViewMode } from '../components/AppHeader';
import { ShareableGridView } from '../components/Share/ShareableGridView';
import { ShareOptionsSheet } from '../components/Modal/ShareOptionsSheet';
import { NativeToast } from '../components/Toast/NativeToast';
import { SortChipRow } from '../components/SortChipRow';
import { VinylTableRow } from '../components/VinylTableRow';
import { sortVinyls, SortMode } from '../utils/sortVinyls';
import { shareToInstagramStory } from '../utils/nativeShare';
import { useTabBarHeight } from '../constants/layout';

const { width } = Dimensions.get('window');
const itemSize = width / 2 - 24;

export const HomeScreen = ({ onModeChange }: { onModeChange?: (mode: 'collection' | 'wishlist') => void } = {}) => {
  const { themeColors, glassIntensity } = useTheme();
  const { t } = useLocale();
  const tabBarHeight = useTabBarHeight();
  const styles = getStyles(themeColors, shadows, shape, tabBarHeight);
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);
  const [ownedAlbums, setOwnedAlbums] = useState<MockVinylData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isShareSheetVisible, setShareSheetVisible] = useState(false);
  const [isSharingProcessing, setIsSharingProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [viewMode, setViewMode] = useState<VinylViewMode>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('custom');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isRandomPickOpen, setIsRandomPickOpen] = useState(false);
  const shareViewRef = useRef<View>(null);
  const navigation = useNavigation<NavigationProp<any>>();
  const { user, initializeAuth } = useAuthStore();
  // updateUserVinylOrder fires one PATCH per row — each lands as its own
  // postgres_changes event on the subscription below, so a reorder of N
  // records triggers up to N concurrent loadData() refetches that land out
  // of order relative to how many writes have landed on the server yet,
  // flickering between the new order and a half-applied one. Suppress
  // refetches for the duration of a manual reorder (+ a grace period for
  // trailing echoes) since the optimistic local update already has it right.
  const suppressRealtimeRefetchRef = useRef(false);

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      
      // Attempt to load from offline cache first
      try {
        const cached = await AsyncStorage.getItem('@vinyls_owned');
        if (cached) setOwnedAlbums(JSON.parse(cached));
      } catch (e) {
        console.error('Failed to load from cache', e);
      }

      if (!user) {
        setOwnedAlbums([]);
        setIsLoading(false);
        return;
      }

      try {
        const userId = user.id;
        const userVinyls = await getUserVinyls(userId);
        if (userVinyls && userVinyls.length > 0) {
          const mapped = userVinyls.map(v => mapToFrontendModel(v, null));
          const owned = mapped.filter(a => a.STATUS === 'OWNED');
          setOwnedAlbums(owned);

          // Save to offline cache
          try {
            await AsyncStorage.setItem('@vinyls_owned', JSON.stringify(owned));
          } catch (e) {
            console.error('Failed to save cache', e);
          }
        } else {
          setOwnedAlbums([]);
        }
      } catch (e) {
        // Keep whatever the offline cache already rendered; just surface it.
        console.error('Failed to load collection', e);
        showToast(t('mobile.home.loadFailed'));
      } finally {
        setIsLoading(false);
      }
    }

    if (user !== undefined) {
       loadData();
    }

    // Subscribe only to this user's rows — an unfiltered subscription makes
    // every client refetch on every other user's change.
    if (!user) return;
    const subscription = supabase
      .channel('public:USER_VINYL:mobile_home')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'USER_VINYL', filter: `USER_ID=eq.${user.id}` },
        () => {
          if (suppressRealtimeRefetchRef.current) return;
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const sortedAlbums = sortVinyls(ownedAlbums, sortMode);

  // 편집 모드는 "직접 정렬" 그리드 뷰에서만 의미가 있다 — 다른 정렬 기준으로
  // 바꾸거나 테이블 뷰로 전환하면 드래그 순서 변경이 무의미해지므로 자동으로 빠져나온다.
  useEffect(() => {
    if (sortMode !== 'custom' || viewMode !== 'grid') setIsEditMode(false);
  }, [sortMode, viewMode]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setIsToastVisible(true);
  };

  const handleDragEnd = async ({ data }: { data: MockVinylData[] }) => {
    const reordered = data.map((a, idx) => ({ ...a, SORT_ORDER: idx }));
    setOwnedAlbums((prev) => {
      const byId = new Map(reordered.map((a) => [a.USER_VINYL_ID, a]));
      return prev.map((a) => byId.get(a.USER_VINYL_ID) || a);
    });
    suppressRealtimeRefetchRef.current = true;
    try {
      await updateUserVinylOrder(reordered.map((a) => a.USER_VINYL_ID as number));
    } catch (e) {
      console.error('Failed to save order', e);
      showToast(t('collection.orderSaveFailed'));
    } finally {
      setTimeout(() => { suppressRealtimeRefetchRef.current = false; }, 1500);
    }
  };

  const handleShareLink = async () => {
    if (!user?.id) {
      setShareSheetVisible(false);
      return;
    }
    try {
      setIsSharingProcessing(true);
      const name = encodeURIComponent(user.user_metadata?.displayName || 'Collector');
      const avatar = encodeURIComponent(user.user_metadata?.avatar_url || '/logo.png');
      const baseUrl = process.env.EXPO_PUBLIC_WEB_URL || 'https://vinyla.vercel.app';
      const link = `${baseUrl}/user/${user.id}?n=${name}&a=${avatar}`;
      await Share.share({
        message: t('mobile.home.shareMessage', { name: user.user_metadata?.displayName || t('common.defaultCollectorName'), link }),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSharingProcessing(false);
      setShareSheetVisible(false);
    }
  };

  const handleImageShare = async () => {
    try {
      setIsSharingProcessing(true);
      await shareToInstagramStory(shareViewRef);
    } catch (e) {
      console.error('Failed to share image', e);
      showToast(t('mobile.home.imageShareFailed'));
    } finally {
      setIsSharingProcessing(false);
      setShareSheetVisible(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <AppHeader
        mode="collection"
        onModeChange={onModeChange}
        onSharePress={() => setShareSheetVisible(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      {!isLoading && ownedAlbums.length === 0 ? (
        <EmptyState
          onPressAction={() => navigation.navigate('Scan')}
        />
      ) : (
        <>
          {/* 오늘의 LP 추천 (랜덤 픽) 진입점 — 웹 VinylGrid의 트리거 버튼 파리티 */}
          <TouchableOpacity style={styles.randomPickBanner} onPress={() => setIsRandomPickOpen(true)}>
            <Text style={styles.randomPickBannerText}>{t('randomPick.triggerButton')}</Text>
          </TouchableOpacity>
          <SortChipRow value={sortMode} onChange={setSortMode} />
          {/* 모바일에서는 한 줄(테이블) 뷰에서만 순서 편집 지원 — 그리드(2열)
              드래그는 react-native-draggable-flatlist가 안정적으로 지원하지
              않는 영역이라, 격자보다 신뢰도 높은 한 줄 뷰로 제한한다. */}
          {sortMode === 'custom' && viewMode !== 'grid' && (
            <TouchableOpacity
              style={[
                styles.editModeBtn,
                { borderColor: isEditMode ? themeColors.accent : themeColors.border },
                isEditMode && { backgroundColor: 'rgba(233,195,73,0.12)' },
              ]}
              onPress={() => setIsEditMode((v) => !v)}
            >
              <Text style={[styles.editModeBtnText, { color: isEditMode ? themeColors.accent : themeColors.textSecondary }]}>
                {isEditMode ? t('collection.editModeDone') : t('collection.editMode')}
              </Text>
            </TouchableOpacity>
          )}
          {isEditMode && sortMode === 'custom' && viewMode !== 'grid' && (
            <Text style={[styles.editModeHint, { color: themeColors.textSecondary }]}>{t('collection.editModeHint')}</Text>
          )}
          {viewMode === 'grid' ? (
            <FlatList
              key="grid"
              style={{ flex: 1 }}
              data={sortedAlbums}
              numColumns={2}
              keyExtractor={item => (item.USER_VINYL_ID ?? item.ALBUM_ID).toString()}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.card} onPress={() => setSelectedAlbum(item)}>
                  <Image
                    source={item.IMAGE_URL ? { uri: item.IMAGE_URL } : require('../../assets/logo_real_transparent.png')}
                    style={[styles.cover, { backgroundColor: 'transparent' }]}
                    resizeMode={item.IMAGE_URL ? "cover" : "contain"}
                  />
                  <EditionCoverArt album={item} />
                  {item.EDITION_LABEL && !item.EDITION_ON_COVER && (
                    <LinearGradient
                      colors={['#f8e9b8', '#e9c349', '#b8860b']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.editionBadge}
                    >
                      <Text style={styles.editionBadgeText} numberOfLines={1}>✨ {item.EDITION_LABEL}</Text>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              )}
            />
          ) : isEditMode && sortMode === 'custom' ? (
            <DraggableFlatList
              key="table-edit"
              style={{ flex: 1 }}
              data={sortedAlbums}
              keyExtractor={item => (item.USER_VINYL_ID ?? item.ALBUM_ID).toString()}
              contentContainerStyle={styles.tableList}
              onDragEnd={handleDragEnd}
              renderItem={({ item, drag, isActive }: RenderItemParams<MockVinylData>) => (
                <ScaleDecorator>
                  <View style={[styles.editableRow, isActive && styles.editableRowActive, { borderBottomColor: themeColors.border }]}>
                    <Image
                      source={item.IMAGE_URL ? { uri: item.IMAGE_URL } : require('../../assets/logo_real_transparent.png')}
                      style={styles.editableRowCover}
                      resizeMode={item.IMAGE_URL ? 'cover' : 'contain'}
                    />
                    <View style={styles.editableRowInfo}>
                      <Text style={[styles.editableRowTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>{item.TITLE}</Text>
                      <Text style={[styles.editableRowArtist, { color: themeColors.textSecondary }]} numberOfLines={1}>{item.ARTIST}</Text>
                    </View>
                    <TouchableOpacity onPressIn={drag} style={styles.dragHandle} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Text style={{ color: themeColors.textSecondary, fontSize: 18 }}>≡</Text>
                    </TouchableOpacity>
                  </View>
                </ScaleDecorator>
              )}
            />
          ) : (
            <FlatList
              key="table"
              style={{ flex: 1 }}
              data={sortedAlbums}
              keyExtractor={item => (item.USER_VINYL_ID ?? item.ALBUM_ID).toString()}
              contentContainerStyle={styles.tableList}
              renderItem={({ item }) => (
                <VinylTableRow item={item} onPress={() => setSelectedAlbum(item)} />
              )}
            />
          )}
        </>
      )}
      <DetailModal
        album={selectedAlbum}
        visible={!!selectedAlbum}
        onClose={() => setSelectedAlbum(null)}
      />

      <RandomPickModal
        visible={isRandomPickOpen}
        albums={ownedAlbums}
        onClose={() => setIsRandomPickOpen(false)}
        onOpenAlbum={(album) => setSelectedAlbum(album)}
      />

      <View style={styles.offscreen} pointerEvents="none">
        <ShareableGridView
          ref={shareViewRef}
          albums={sortedAlbums}
          mode="collection"
          username={user?.user_metadata?.displayName || t('common.defaultCollectorName')}
        />
      </View>

      <ShareOptionsSheet
        visible={isShareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        title={t('collection.shareSheetTitle')}
        isProcessing={isSharingProcessing}
        onShareLink={handleShareLink}
        onImageShare={handleImageShare}
        bottomInset={tabBarHeight}
      />

      <NativeToast message={toastMessage} visible={isToastVisible} onHide={() => setIsToastVisible(false)} />
    </View>
  );
};

const getStyles = (themeColors: any, shadows: any, shape: any, tabBarHeight: number) => StyleSheet.create({
  container: {
    flex: 1,
  },
  offscreen: {
    position: 'absolute',
    top: -9999,
    left: 0,
  },
  list: {
    padding: 16,
    paddingTop: 4,
    // 플로팅 스캔 로고(탭바 위로 ~25px 돌출)에 마지막 줄이 가리지 않도록 여유를 둔다
    paddingBottom: tabBarHeight + 48,
  },
  randomPickBanner: {
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(233,195,73,0.4)',
    backgroundColor: 'rgba(233,195,73,0.08)',
    alignItems: 'center',
  },
  randomPickBannerText: {
    color: '#e9c349',
    fontSize: 14,
    fontWeight: '700',
  },
  tableList: {
    paddingBottom: tabBarHeight + 48,
  },
  card: {
    width: itemSize,
    height: itemSize,
    margin: 8,
    marginBottom: 16,
    borderRadius: shape.md,
    ...shadows.strong,
  },
  cover: {
    width: '100%',
    height: '100%',
    borderRadius: shape.md,
  },
  editionBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '80%',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 100,
    shadowColor: '#e9c349',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  editionBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: '#2a1c00',
  },
  editModeBtn: {
    alignSelf: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 14,
  },
  editModeBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  editModeHint: {
    marginHorizontal: 20,
    marginBottom: 8,
    fontSize: 12,
  },
  editableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  editableRowActive: {
    opacity: 0.6,
  },
  editableRowCover: {
    width: 44,
    height: 44,
    borderRadius: 6,
  },
  editableRowInfo: {
    flex: 1,
  },
  editableRowTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  editableRowArtist: {
    fontSize: 11,
    marginTop: 2,
  },
  dragHandle: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
});
