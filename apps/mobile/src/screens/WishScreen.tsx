import React, { useState } from 'react';
import { View, FlatList, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { mockVinyls, MockVinylData } from '@vinyla/shared-types';
import { DetailModal } from '../components/Modal/DetailModal';

const { width } = Dimensions.get('window');
const itemSize = width / 2 - 24;

export const WishScreen = () => {
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);
  const wishAlbums = mockVinyls.filter(a => a.STATUS === 'WISH');

  return (
    <View style={styles.container}>
      <View style={styles.glassOverlay} />
      <FlatList
        data={wishAlbums}
        numColumns={2}
        keyExtractor={item => item.ALBUM_ID.toString()}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => setSelectedAlbum(item)}>
            <Image source={{ uri: item.IMAGE_URL }} style={styles.cover} />
          </TouchableOpacity>
        )}
      />
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
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(233, 195, 73, 0.05)',
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
