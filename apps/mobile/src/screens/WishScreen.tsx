import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions } from 'react-native';
import { useTheme } from '@vinyla/ui';
import { MockVinylData } from '@vinyla/shared-types';
import { getUserVinyls, mapToFrontendModel, supabase, useAuthStore } from '@vinyla/core-api';
import { EmptyState } from '../components/EmptyState';
import { DetailModal } from '../components/Modal/DetailModal';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const itemSize = width / 2 - 24;

export const WishScreen = () => {
  const { themeColors } = useTheme();
  const [wishes, setWishes] = useState<MockVinylData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation<NavigationProp<any>>();
  const { user } = useAuthStore();

  useEffect(() => {
    async function loadData() {
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
    }
    
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

  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Text style={[styles.pageTitle, { color: themeColors.textPrimary }]}>위시리스트</Text>
      
      {!isLoading && wishes.length === 0 ? (
        <EmptyState 
          title="위시리스트가 비어 있습니다"
          description="갖고 싶은 앨범을 검색하여 위시리스트에 추가해보세요."
          buttonText="앨범 검색하기"
          onPressAction={() => navigation.navigate('Search')}
        />
      ) : (
        <FlatList
          data={wishes}
          numColumns={2}
          keyExtractor={item => item.ALBUM_ID.toString()}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => setSelectedAlbum(item)}>
              <Image source={{ uri: item.IMAGE_URL }} style={styles.cover} />
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={1}>{item.TITLE}</Text>
                <Text style={styles.artist} numberOfLines={1}>{item.ARTIST}</Text>
              </View>
            </TouchableOpacity>
          )}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  list: {
    paddingHorizontal: 16,
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
