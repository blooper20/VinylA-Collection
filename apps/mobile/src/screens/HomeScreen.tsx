import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, Image, TouchableOpacity, StyleSheet, Dimensions, Text, Share } from 'react-native';
import { mockVinyls, MockVinylData } from '@vinyla/shared-types';
import { DetailModal } from '../components/Modal/DetailModal';
import { EmptyState } from '../components/EmptyState';
import { getUserVinyls, mapToFrontendModel, supabase, useAuthStore } from '@vinyla/core-api';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, shadows, shape } from '@vinyla/ui';
import { BlurView } from 'expo-blur';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Clipboard from 'expo-clipboard';
import { AppHeader, VinylViewMode } from '../components/AppHeader';
import { ShareableGridView } from '../components/Share/ShareableGridView';
import { ShareOptionsSheet } from '../components/Modal/ShareOptionsSheet';
import { NativeToast } from '../components/Toast/NativeToast';
import { SortChipRow } from '../components/SortChipRow';
import { VinylTableRow } from '../components/VinylTableRow';
import { sortVinyls, SortMode } from '../utils/sortVinyls';

const { width } = Dimensions.get('window');
const itemSize = width / 2 - 24;

export const HomeScreen = () => {
  const { themeColors, glassIntensity } = useTheme();
  const styles = getStyles(themeColors, shadows, shape);
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);
  const [ownedAlbums, setOwnedAlbums] = useState<MockVinylData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isShareSheetVisible, setShareSheetVisible] = useState(false);
  const [isSharingProcessing, setIsSharingProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [viewMode, setViewMode] = useState<VinylViewMode>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const shareViewRef = useRef<View>(null);
  const navigation = useNavigation<NavigationProp<any>>();
  const { user, initializeAuth } = useAuthStore();

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
      setIsLoading(false);
    }
    
    if (user !== undefined) {
       loadData();
    }

    const subscription = supabase
      .channel('public:USER_VINYL:mobile_home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'USER_VINYL' }, payload => {
        if (user) loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const sortedAlbums = sortVinyls(ownedAlbums, sortMode);

  const showToast = (message: string) => {
    setToastMessage(message);
    setIsToastVisible(true);
  };

  const handleSaveImage = async () => {
    try {
      setIsSharingProcessing(true);
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
        showToast('사진 라이브러리 접근 권한이 필요합니다.');
        return;
      }
      const uri = await captureRef(shareViewRef, { format: 'png', quality: 1 });
      await MediaLibrary.saveToLibraryAsync(uri);
      showToast('이미지가 저장되었습니다.');
    } catch (e) {
      console.error('Failed to save share image', e);
      showToast('이미지 저장에 실패했습니다.');
    } finally {
      setIsSharingProcessing(false);
      setShareSheetVisible(false);
    }
  };

  const handleCopyImage = async () => {
    try {
      setIsSharingProcessing(true);
      const base64 = await captureRef(shareViewRef, { format: 'png', quality: 1, result: 'base64' });
      await Clipboard.setImageAsync(base64);
      showToast('이미지가 클립보드에 복사되었습니다.');
    } catch (e) {
      console.error('Failed to copy share image', e);
      showToast('이미지 복사에 실패했습니다.');
    } finally {
      setIsSharingProcessing(false);
      setShareSheetVisible(false);
    }
  };

  const handleShareLink = async () => {
    setShareSheetVisible(false);
    if (!user?.id) return;
    const name = encodeURIComponent(user.user_metadata?.displayName || 'Collector');
    const avatar = encodeURIComponent(user.user_metadata?.avatar_url || '/logo.png');
    const baseUrl = process.env.EXPO_PUBLIC_WEB_URL || 'http://192.168.0.20:3000';
    const link = `${baseUrl}/user/${user.id}?n=${name}&a=${avatar}`;
    try {
      await Share.share({
        message: `🎧 ${user.user_metadata?.displayName || '컬렉터'}님의 레코드 컬렉션을 확인해보세요!\n\n${link}`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <AppHeader
        mode="collection"
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
          <SortChipRow value={sortMode} onChange={setSortMode} />
          {viewMode === 'grid' ? (
            <FlatList
              key="grid"
              style={{ flex: 1 }}
              data={sortedAlbums}
              numColumns={2}
              keyExtractor={item => item.ALBUM_ID.toString()}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.card} onPress={() => setSelectedAlbum(item)}>
                  <Image
                    source={item.IMAGE_URL ? { uri: item.IMAGE_URL } : require('../../assets/logo_real_transparent.png')}
                    style={[styles.cover, { backgroundColor: 'transparent' }]}
                    resizeMode={item.IMAGE_URL ? "cover" : "contain"}
                  />
                </TouchableOpacity>
              )}
            />
          ) : (
            <FlatList
              key="table"
              style={{ flex: 1 }}
              data={sortedAlbums}
              keyExtractor={item => item.ALBUM_ID.toString()}
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

      <View style={styles.offscreen} pointerEvents="none">
        <ShareableGridView
          ref={shareViewRef}
          albums={sortedAlbums}
          mode="collection"
          username={user?.user_metadata?.displayName || '컬렉터'}
        />
      </View>

      <ShareOptionsSheet
        visible={isShareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        title="보관함 공유하기"
        isProcessing={isSharingProcessing}
        onSaveImage={handleSaveImage}
        onCopyImage={handleCopyImage}
        onShareLink={handleShareLink}
      />

      <NativeToast message={toastMessage} visible={isToastVisible} onHide={() => setIsToastVisible(false)} />
    </View>
  );
};

const getStyles = (themeColors: any, shadows: any, shape: any) => StyleSheet.create({
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
  },
  tableList: {
    paddingBottom: 16,
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
});
