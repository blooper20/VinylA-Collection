import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useAlbumSearch } from '@vinyla/core-api';
import { DetailModal } from '../components/Modal/DetailModal';
import { MockVinylData } from '@vinyla/shared-types';

const { width } = Dimensions.get('window');
const itemSize = width / 2 - 24;

export const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const { results, isLoading } = useAlbumSearch(query);
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);

  return (
    <View style={styles.container}>
      <View style={styles.searchHero}>
        <TextInput 
          style={styles.searchInput}
          placeholder="Search albums..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!query && (
          <View>
            <Text style={styles.sectionTitle}>Acoustic Landscapes</Text>
            <View style={[styles.genreCard, { backgroundColor: '#1a2a6c' }]}>
              <Text style={styles.genreText}>JAZZ</Text>
            </View>
            <View style={[styles.genreCard, { backgroundColor: '#434343' }]}>
              <Text style={styles.genreText}>ROCK'N ROLL</Text>
            </View>
            <View style={[styles.genreCard, { backgroundColor: '#12c2e9' }]}>
              <Text style={styles.genreText}>ELECTRONIC</Text>
            </View>
          </View>
        )}

        {!!query && (
          <View>
            <Text style={styles.sectionTitle}>Search Results {isLoading && '...'}</Text>
            <View style={styles.resultsGrid}>
              {results.map(album => (
                <TouchableOpacity key={album.ALBUM_ID} style={styles.resultCard} onPress={() => setSelectedAlbum(album)}>
                  <Image source={{ uri: album.IMAGE_URL }} style={styles.resultCover} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

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
    backgroundColor: '#000',
  },
  searchHero: {
    paddingTop: 80,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  searchInput: {
    fontSize: 32,
    color: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 10,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  scroll: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
  },
  genreCard: {
    height: 150,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  genreText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  resultCard: {
    width: itemSize,
    height: itemSize,
    marginBottom: 16,
  },
  resultCover: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  }
});
