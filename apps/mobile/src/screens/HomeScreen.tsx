import React, { useState, useEffect } from 'react';
import { View, FlatList, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { mockVinyls, MockVinylData } from '@vinyla/shared-types';
import { DetailModal } from '../components/Modal/DetailModal';
import { EmptyState } from '../components/EmptyState';
import { getUserVinyls, mapToFrontendModel, supabase } from '@vinyla/core-api';
import { useNavigation, NavigationProp } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const itemSize = width / 2 - 24;

export const HomeScreen = () => {
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);
  const [ownedAlbums, setOwnedAlbums] = useState<MockVinylData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation<NavigationProp<any>>();

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      // Mock user ID 1
      const userVinyls = await getUserVinyls(1);
      if (userVinyls && userVinyls.length > 0) {
        const mapped = userVinyls.map(v => mapToFrontendModel(v, null));
        setOwnedAlbums(mapped.filter(a => a.STATUS === 'OWNED'));
      } else {
        // No vinyls in DB, set to empty
        setOwnedAlbums([]);
      }
      setIsLoading(false);
    }
    loadData();

    const subscription = supabase
      .channel('public:USER_VINYL:mobile_home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'USER_VINYL' }, payload => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return (
    <View style={styles.container}>
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
              <Image source={{ uri: item.IMAGE_URL }} style={styles.cover} />
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
    backgroundColor: '#000000',
  },
  list: {
    padding: 16,
    paddingTop: 60,
  },
  card: {
    width: itemSize,
    height: itemSize,
    margin: 8,
  },
  cover: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  }
});
