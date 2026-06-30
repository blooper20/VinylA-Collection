import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Image, Dimensions, ActivityIndicator, ImageBackground } from 'react-native';
import { searchDiscogsLazy, SearchStatus, AlbumItem } from '@vinyla/core-api';
import { DetailModal } from '../components/Modal/DetailModal';
import { ErrorState } from '../components/ErrorState';
import { MockVinylData } from '@vinyla/shared-types';

const { width } = Dimensions.get('window');
const itemSize = (width - 40 - 16) / 2; // (Screen Width - Padding * 2 - Gap) / 2

export const SearchScreen = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MockVinylData[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [totalToCheck, setTotalToCheck] = useState(0);
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);
  
  const searchIdRef = useRef(0);

  const executeSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setStatus('idle');
      return;
    }

    const currentSearchId = ++searchIdRef.current;
    setResults([]);
    setTotalToCheck(0);
    setStatus('fetching_discogs');

    await searchDiscogsLazy(
      q,
      (album: AlbumItem) => {
        if (searchIdRef.current !== currentSearchId) return;
        setResults((prev) => {
          if (prev.some((a) => a.ALBUM_ID === Number(album.id))) return prev;
          
          const mapped: MockVinylData = {
            ALBUM_ID: Number(album.id) || Date.now(),
            TITLE: album.title || 'Unknown',
            ARTIST: album.artist || 'Unknown',
            RELEASE_YEAR: Number(album.year) || new Date().getFullYear(),
            IMAGE_URL: album.thumb || 'https://via.placeholder.com/400',
            VINYL_IMAGE_URL: '',
            CUSTOM_COLOR_HEX: '#111',
            CUSTOM_STYLE_TYPE: 'SOLID',
            GENRES: album.genre || ['Vinyl']
          };
          
          return [...prev, mapped];
        });
      },
      (newStatus, total) => {
        if (searchIdRef.current !== currentSearchId) return;
        setStatus(newStatus);
        if (total !== undefined) {
          setTotalToCheck(total);
        }
      }
    );
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      executeSearch(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query, executeSearch]);

  const retrySearch = () => {
    executeSearch(query);
  };

  const isLoading = status === 'fetching_discogs' || status === 'enriching';
  const isEnriching = status === 'enriching';

  return (
    <View style={styles.container}>
      <View style={styles.searchHero}>
        <TextInput 
          style={styles.searchInput}
          placeholder="어떤 바이닐을 찾으시나요?"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {status === 'error' ? (
        <ErrorState onRetry={retrySearch} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {!query && (
            <View>
              <Text style={styles.sectionTitle}>장르 탐색</Text>
              <View style={styles.genresGrid}>
                <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?q=80&w=800&auto=format&fit=crop' }} style={[styles.genreCard, { height: 220 }]} imageStyle={styles.genreImage}>
                  <View style={styles.genreOverlay} />
                  <Text style={styles.genreText}>재즈</Text>
                </ImageBackground>
                <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=800&auto=format&fit=crop' }} style={[styles.genreCard, { height: 260 }]} imageStyle={styles.genreImage}>
                  <View style={styles.genreOverlay} />
                  <Text style={styles.genreText}>록</Text>
                </ImageBackground>
                <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop' }} style={[styles.genreCard, { height: 180 }]} imageStyle={styles.genreImage}>
                  <View style={styles.genreOverlay} />
                  <Text style={styles.genreText}>일렉트로닉</Text>
                </ImageBackground>
              </View>
            </View>
          )}

          {!!query && (
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.sectionTitle}>
                  {isEnriching 
                    ? `고화질 커버 불러오는 중... (${results.length} / ${totalToCheck})` 
                    : isLoading 
                      ? 'Discogs 검색 중...' 
                      : `검색 결과 (${results.length})`
                  }
                </Text>
                {isLoading && <ActivityIndicator size="small" color="#e9c349" />}
              </View>
              
              <View style={styles.resultsGrid}>
                {results.map(album => (
                  <TouchableOpacity key={album.ALBUM_ID} style={styles.resultCard} onPress={() => setSelectedAlbum(album)}>
                    <Image source={{ uri: album.IMAGE_URL }} style={styles.resultCover} />
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultTitle} numberOfLines={1}>{album.TITLE}</Text>
                      <Text style={styles.resultArtist} numberOfLines={1}>{album.ARTIST}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
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
  genresGrid: {
    gap: 16,
  },
  genreCard: {
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    marginBottom: 0,
    padding: 20,
  },
  genreImage: {
    borderRadius: 16,
  },
  genreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
  },
  genreText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  resultCard: {
    width: itemSize,
    marginBottom: 10,
  },
  resultCover: {
    width: itemSize,
    height: itemSize,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  resultInfo: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  resultArtist: {
    color: '#a0a0a0',
    fontSize: 12,
    marginTop: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
});
