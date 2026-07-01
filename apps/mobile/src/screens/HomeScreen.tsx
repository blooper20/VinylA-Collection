import React, { useState, useEffect } from 'react';
import { View, FlatList, Image, TouchableOpacity, StyleSheet, Dimensions, Text } from 'react-native';
import { mockVinyls, MockVinylData } from '@vinyla/shared-types';
import { DetailModal } from '../components/Modal/DetailModal';
import { EmptyState } from '../components/EmptyState';
import { getUserVinyls, mapToFrontendModel, supabase, useAuthStore } from '@vinyla/core-api';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, shadows, shape } from '@vinyla/ui';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');
const itemSize = width / 2 - 24;

export const HomeScreen = () => {
  const { themeColors, glassIntensity } = useTheme();
  const styles = getStyles(themeColors, shadows, shape);
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);
  const [ownedAlbums, setOwnedAlbums] = useState<MockVinylData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {!isLoading && ownedAlbums.length === 0 ? (
        <EmptyState 
          onPressAction={() => navigation.navigate('Scan')} 
        />
      ) : (
        <FlatList
          data={ownedAlbums}
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
      )}
      <DetailModal 
        album={selectedAlbum} 
        visible={!!selectedAlbum} 
        onClose={() => setSelectedAlbum(null)} 
      />
    </View>
  );
};

const getStyles = (themeColors: any, shadows: any, shape: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 16,
    paddingTop: 60,
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
