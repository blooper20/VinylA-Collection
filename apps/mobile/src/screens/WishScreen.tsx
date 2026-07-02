import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions, Share } from 'react-native';
import { useTheme } from '@vinyla/ui';
import { MockVinylData } from '@vinyla/shared-types';
import { getUserVinyls, mapToFrontendModel, supabase, useAuthStore } from '@vinyla/core-api';
import { EmptyState } from '../components/EmptyState';
import { DetailModal } from '../components/Modal/DetailModal';
import { AppHeader, VinylViewMode } from '../components/AppHeader';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Clipboard from 'expo-clipboard';
import { ShareableGridView } from '../components/Share/ShareableGridView';
import { ShareOptionsSheet } from '../components/Modal/ShareOptionsSheet';
import { NativeToast } from '../components/Toast/NativeToast';
import { SortChipRow } from '../components/SortChipRow';
import { VinylTableRow } from '../components/VinylTableRow';
import { sortVinyls, SortMode } from '../utils/sortVinyls';
import { shareToInstagramStory } from '../utils/nativeShare';

const { width } = Dimensions.get('window');
const itemSize = width / 2 - 24;

export const WishScreen = () => {
  const { themeColors } = useTheme();
  const [wishes, setWishes] = useState<MockVinylData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isShareSheetVisible, setShareSheetVisible] = useState(false);
  const [isSharingProcessing, setIsSharingProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [viewMode, setViewMode] = useState<VinylViewMode>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const shareViewRef = useRef<View>(null);
  const navigation = useNavigation<NavigationProp<any>>();
  const { user } = useAuthStore();

  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    
    try {
      const cached = await AsyncStorage.getItem('@vinyls_wish');
      if (cached) setWishes(JSON.parse(cached));
    } catch (e) {
      console.error('Failed to load from cache', e);
    }

    if (!user) {
      setWishes([]);
      setIsLoading(false);
      return;
    }

    const userId = user.id;
    const userVinyls = await getUserVinyls(userId);
    if (userVinyls && userVinyls.length > 0) {
      const mapped = userVinyls.map(v => mapToFrontendModel(v, null));
      const wishesData = mapped.filter(a => a.STATUS === 'WISH');
      setWishes(wishesData);
      
      try {
        await AsyncStorage.setItem('@vinyls_wish', JSON.stringify(wishesData));
      } catch (e) {
        console.error('Failed to save cache', e);
      }
    } else {
      setWishes([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (user !== undefined) loadData();

    const subscription = supabase
      .channel('public:USER_VINYL:mobile_wish')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'USER_VINYL' }, payload => {
        if (user) loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const sortedWishes = sortVinyls(wishes, sortMode);

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
    if (!user?.id) {
      setShareSheetVisible(false);
      return;
    }
    try {
      setIsSharingProcessing(true);
      const name = encodeURIComponent(user.user_metadata?.displayName || 'Collector');
      const avatar = encodeURIComponent(user.user_metadata?.avatar_url || '/logo.png');
      const baseUrl = process.env.EXPO_PUBLIC_WEB_URL || 'http://192.168.0.20:3000';
      const link = `${baseUrl}/user/${user.id}?n=${name}&a=${avatar}&type=wishlist`;
      await Share.share({
        message: `🎧 ${user.user_metadata?.displayName || '컬렉터'}님의 위시리스트를 확인해보세요!\n\n${link}`,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSharingProcessing(false);
      setShareSheetVisible(false);
    }
  };

  const handleInstagramStory = async () => {
    try {
      setIsSharingProcessing(true);
      await shareToInstagramStory(shareViewRef);
    } catch (e) {
      console.error('Failed to share to Instagram Story', e);
      showToast('인스타그램 스토리 공유에 실패했습니다.');
    } finally {
      setIsSharingProcessing(false);
      setShareSheetVisible(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <AppHeader
        mode="wishlist"
        onSharePress={() => setShareSheetVisible(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {!isLoading && wishes.length === 0 ? (
        <EmptyState
          title="위시리스트가 비어 있습니다"
          description="갖고 싶은 앨범을 검색하여 위시리스트에 추가해보세요."
          buttonText="앨범 검색하기"
          onPressAction={() => navigation.navigate('Search')}
        />
      ) : (
        <>
          <SortChipRow value={sortMode} onChange={setSortMode} />
          {viewMode === 'grid' ? (
            <FlatList
              key="grid"
              style={{ flex: 1 }}
              data={sortedWishes}
              numColumns={2}
              keyExtractor={item => item.ALBUM_ID.toString()}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.card} onPress={() => setSelectedAlbum(item)}>
                  <Image
                    source={item.IMAGE_URL ? { uri: item.IMAGE_URL } : require('../../assets/logo_real_transparent.png')}
                    style={styles.cover}
                    resizeMode={item.IMAGE_URL ? "cover" : "contain"}
                  />
                  <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={1}>{item.TITLE}</Text>
                    <Text style={styles.artist} numberOfLines={1}>{item.ARTIST}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          ) : (
            <FlatList
              key="table"
              style={{ flex: 1 }}
              data={sortedWishes}
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
        onClose={() => {
          setSelectedAlbum(null);
          loadData();
        }}
      />

      <View style={styles.offscreen} pointerEvents="none">
        <ShareableGridView
          ref={shareViewRef}
          albums={sortedWishes}
          mode="wishlist"
          username={user?.user_metadata?.displayName || '컬렉터'}
        />
      </View>

      <ShareOptionsSheet
        visible={isShareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        title="위시리스트 공유하기"
        isProcessing={isSharingProcessing}
        onSaveImage={handleSaveImage}
        onCopyImage={handleCopyImage}
        onShareLink={handleShareLink}
        onInstagramStory={handleInstagramStory}
      />

      <NativeToast message={toastMessage} visible={isToastVisible} onHide={() => setIsToastVisible(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  offscreen: {
    position: 'absolute',
    top: -9999,
    left: 0,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  tableList: {
    paddingBottom: 100,
  },
  card: {
    width: itemSize,
    margin: 8,
    marginBottom: 16,
  },
  cover: {
    width: itemSize,
    height: itemSize,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  info: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  artist: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 2,
  },
});
