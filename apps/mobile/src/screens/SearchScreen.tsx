import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Image, Dimensions, ActivityIndicator, ImageBackground, PanResponder, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createDiscogsSearchSession, DiscogsSearchSession, SearchStatus, SearchMode, AlbumItem } from '@vinyla/core-api';
import { DetailModal } from '../components/Modal/DetailModal';
import { ErrorState } from '../components/ErrorState';
import { MockVinylData } from '@vinyla/shared-types';
import { useLocale } from '@vinyla/i18n';

const { width } = Dimensions.get('window');
const itemSize = (width - 40 - 16) / 2; // (Screen Width - Padding * 2 - Gap) / 2

const genres = [
  { title: '팝',            sub: 'Pop',         height: 140, img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop' },
  { title: '록',            sub: 'Rock',        height: 160, img: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=800&auto=format&fit=crop' },
  { title: '재즈',          sub: 'Jazz',        height: 140, img: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?q=80&w=800&auto=format&fit=crop' },
  { title: '일렉트로닉',    sub: 'Electronic',  height: 120, img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop' },
  { title: '힙합',          sub: 'Hip Hop',     height: 150, img: 'https://images.unsplash.com/photo-1601643157091-ce5c665179ab?q=80&w=800&auto=format&fit=crop' },
  { title: 'R&B / 소울',    sub: 'R&B / Soul',  height: 180, img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=800&auto=format&fit=crop' },
  { title: '인디 / 포크',   sub: 'Folk',        height: 140, img: 'https://images.unsplash.com/photo-1501612780327-45045538702b?q=80&w=800&auto=format&fit=crop' },
  { title: '클래식',        sub: 'Classical',   height: 130, img: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=800&auto=format&fit=crop' },
  { title: '블루스',        sub: 'Blues',       height: 120, img: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=800&auto=format&fit=crop' },
  { title: '레게',          sub: 'Reggae',      height: 150, img: 'https://upload.wikimedia.org/wikipedia/commons/6/60/Lenke_djembe_from_Mali.jpeg' },
  { title: '시네마틱',      sub: 'Cinematic',   height: 160, img: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=800&auto=format&fit=crop' },
  { title: '앰비언트',      sub: 'Ambient',     height: 110, img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop' },
  { title: '월드',          sub: 'World',       height: 130, img: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=800&auto=format&fit=crop' },
];

export const SearchScreen = ({ route }: any) => {
  const insets = useSafeAreaInsets();
  const { locale, t } = useLocale();
  const initialQuery = route?.params?.initialQuery || '';
  const [query, setQuery] = useState(initialQuery);
  // The query that was actually executed. Typing alone never triggers a
  // search (it breaks Korean IME composition) — only submit / genre tap /
  // initialQuery do, and the results view is keyed off this value.
  const [searchedQuery, setSearchedQuery] = useState('');
  const [results, setResults] = useState<MockVinylData[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [totalToCheck, setTotalToCheck] = useState(0);
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);
  // Aladin-sourced results only: alternate covers to offer alongside the
  // default, keyed by ALBUM_ID since MockVinylData has no room for them.
  const [coverCandidatesMap, setCoverCandidatesMap] = useState<Record<string, AlbumItem['coverCandidates']>>({});
  const [searchMode, setSearchMode] = useState<SearchMode>('auto');

  const searchIdRef = useRef(0);
  const sessionRef = useRef<DiscogsSearchSession | null>(null);

  const loadingMoreRef = useRef(false);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const executeSearch = useCallback(async (q: string, modeOverride?: SearchMode) => {
    if (!q.trim()) {
      setSearchedQuery('');
      setResults([]);
      setStatus('idle');
      setHasMore(false);
      sessionRef.current = null;
      return;
    }

    setSearchedQuery(q);
    const currentSearchId = ++searchIdRef.current;
    setResults([]);
    setTotalToCheck(0);
    setHasMore(false);
    setStatus('fetching_discogs');

    const session = createDiscogsSearchSession(
      q,
      (album: AlbumItem) => {
        if (searchIdRef.current !== currentSearchId) return;
        const albumId = Number(album.id) || Date.now();
        if (album.coverCandidates) {
          setCoverCandidatesMap((prevMap) => ({ ...prevMap, [String(albumId)]: album.coverCandidates }));
        }
        setResults((prev) => {
          if (prev.some((a) => a.ALBUM_ID === albumId)) return prev;

          const mapped: MockVinylData = {
            ALBUM_ID: albumId,
            TITLE: album.title || 'Unknown',
            ARTIST: album.artist || 'Unknown',
            RELEASE_YEAR: Number(album.year) || new Date().getFullYear(),
            IMAGE_URL: album.thumb || '',
            VINYL_IMAGE_URL: '',
            CUSTOM_COLOR_HEX: '#111',
            CUSTOM_STYLE_TYPE: 'SOLID',
            GENRES: album.genre || []
          };

          return [...prev, mapped];
        });
      },
      (newStatus, total, error) => {
        if (searchIdRef.current !== currentSearchId) return;
        setStatus(newStatus);
        if (newStatus === 'error' && error) {
          import('@vinyla/core-api').then(({ getErrorMessage }) => {
            // Need to import Alert from react-native or use custom Alert
            import('react-native').then(({ Alert }) => {
              Alert.alert(t('common.error'), getErrorMessage(error, t));
            });
          });
        }
        if (total !== undefined) {
          setTotalToCheck(total);
        }
      },
      q.startsWith('#') ? 'auto' : (modeOverride ?? searchMode)
    );
    sessionRef.current = session;

    const more = await session.loadMore();
    if (searchIdRef.current === currentSearchId) {
      setHasMore(more);
    }
  }, [searchMode]);

  // Edge-swipe back, active only while search results are showing:
  // a rightward pan from the left edge clears the search, returning to
  // the genre-explore view. On the genre view the gesture is inert.
  // Capture-phase check so taps and vertical scrolls are untouched.
  const searchedQueryRef = useRef(searchedQuery);
  searchedQueryRef.current = searchedQuery;
  const backGesture = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_evt, g) =>
        !!searchedQueryRef.current && g.x0 < 32 && g.dx > 14 && Math.abs(g.dy) < 24,
      onPanResponderRelease: (_evt, g) => {
        if (g.dx > 60 && searchedQueryRef.current) {
          Keyboard.dismiss();
          setQuery('');
          executeSearch('');
        }
      },
    })
  ).current;

  // Fetch the next batch when the user nears the bottom of the results list.
  const handleLoadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || !sessionRef.current) return;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    const currentSearchId = searchIdRef.current;
    try {
      const more = await sessionRef.current.loadMore();
      if (searchIdRef.current === currentSearchId) {
        setHasMore(more);
      }
    } finally {
      loadingMoreRef.current = false;
      if (searchIdRef.current === currentSearchId) {
        setIsLoadingMore(false);
      }
    }
  }, [hasMore]);

  // Tracked separately from executeSearch's deps (which now include
  // searchMode) so switching the search-mode filter doesn't re-trigger this.
  const lastInitialQueryRef = useRef<string | null>(null);
  useEffect(() => {
    if (route?.params?.initialQuery && route.params.initialQuery !== lastInitialQueryRef.current) {
      lastInitialQueryRef.current = route.params.initialQuery;
      setQuery(route.params.initialQuery);
      executeSearch(route.params.initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.initialQuery]);

  const retrySearch = () => {
    executeSearch(searchedQuery || query);
  };

  const handleGenreClick = (genreTitle: string, genreSub: string) => {
    setQuery(`#${genreSub}`);
    executeSearch(`#${genreSub}`);
  };

  // 필터를 바꾸면 이미 검색된 검색어로 곧바로 다시 검색 (장르 검색 중엔 적용 안 됨).
  // setSearchMode는 다음 렌더까지 반영되지 않으므로, 이번 검색에는 modeOverride로 새 값을 바로 넘긴다.
  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode);
    if (searchedQuery && !searchedQuery.startsWith('#')) {
      executeSearch(searchedQuery, mode);
    }
  };

  const isLoading = status === 'fetching_discogs' || status === 'enriching';
  const isEnriching = status === 'enriching';

  return (
    // Gesture handlers are only attached while a search is active — the
    // genre-explore landing view must not react to edge swipes at all.
    <View style={styles.container} {...(searchedQuery ? backGesture.panHandlers : {})}>
      <View style={[styles.searchHero, { paddingTop: insets.top + 40 }]}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder={t('mobile.search.placeholder')}
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={({ nativeEvent }) => executeSearch(nativeEvent.text)}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                executeSearch('');
              }}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {!query.startsWith('#') && (
          <View style={styles.searchModeRow}>
            {([
              ['auto', t('mobile.search.modeAuto')],
              ['artist', t('mobile.search.modeArtist')],
              ['album', t('mobile.search.modeAlbum')],
              ['track', t('mobile.search.modeTrack')],
            ] as const).map(([mode, label]) => (
              <TouchableOpacity
                key={mode}
                style={[styles.searchModeBtn, searchMode === mode && styles.searchModeBtnActive]}
                onPress={() => handleModeChange(mode)}
              >
                <Text style={[styles.searchModeBtnText, searchMode === mode && styles.searchModeBtnTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {status === 'error' ? (
        <ErrorState onRetry={retrySearch} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          scrollEventThrottle={250}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const nearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 600;
            if (nearBottom && !!searchedQuery) handleLoadMore();
          }}
        >
          {!searchedQuery && (
            <View>
              <Text style={styles.sectionTitle}>{t('mobile.search.genreSectionTitle')}</Text>
              <View style={styles.genresGrid}>
                {genres.map((genre, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.genreCard, { height: genre.height }]}
                    onPress={() => handleGenreClick(genre.title, genre.sub)}
                  >
                    <ImageBackground
                      source={{ uri: genre.img }}
                      style={StyleSheet.absoluteFill}
                      imageStyle={styles.genreImage}
                    >
                      <View style={styles.genreOverlay} />
                      <View style={styles.genreTextContainer}>
                        <Text style={styles.genreText}>{locale === 'ko' ? genre.title : genre.sub}</Text>
                        {locale === 'ko' && <Text style={styles.genreSubText}>{genre.sub}</Text>}
                      </View>
                    </ImageBackground>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {!!searchedQuery && (
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.sectionTitle}>
                  {isLoadingMore
                    ? t('mobile.search.resultsCount', { count: results.length })
                    : isEnriching
                      ? t('mobile.search.enrichingProgress', { current: results.length, total: totalToCheck })
                      : isLoading
                        ? t('mobile.search.searching')
                        : t('mobile.search.resultsCount', { count: results.length })
                  }
                </Text>
                {isLoading && !isLoadingMore && <ActivityIndicator size="small" color="#e9c349" />}
              </View>
              
              <View style={styles.resultsGrid}>
                {results.map(album => (
                  <TouchableOpacity key={album.ALBUM_ID} style={styles.resultCard} onPress={() => setSelectedAlbum(album)}>
                    <Image 
                      source={album.IMAGE_URL ? { uri: album.IMAGE_URL } : require('../../assets/logo_real_transparent.png')} 
                      style={[styles.resultCover, !album.IMAGE_URL && { padding: 16, backgroundColor: '#161616', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }]} 
                      resizeMode={album.IMAGE_URL ? "cover" : "contain"}
                    />
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultTitle} numberOfLines={1}>{album.TITLE}</Text>
                      <Text style={styles.resultArtist} numberOfLines={1}>{album.ARTIST}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {isLoadingMore && (
                <View style={styles.loadMoreRow}>
                  <ActivityIndicator size="small" color="#e9c349" />
                  <Text style={styles.loadMoreText}>{t('mobile.search.loadingMore')}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      <DetailModal
        album={selectedAlbum}
        visible={!!selectedAlbum}
        onClose={() => setSelectedAlbum(null)}
        coverCandidates={selectedAlbum ? coverCandidatesMap[String(selectedAlbum.ALBUM_ID)] : undefined}
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  searchInput: {
    flex: 1,
    fontSize: 24,
    color: '#fff',
    paddingVertical: 10,
    textAlign: 'left',
    fontWeight: 'bold',
  },
  clearButton: {
    padding: 10,
  },
  clearButtonText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  searchModeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchModeBtnActive: {
    backgroundColor: '#e9c349',
    borderColor: '#e9c349',
  },
  searchModeBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchModeBtnTextActive: {
    color: '#000',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  genreCard: {
    width: itemSize,
    marginBottom: 0,
    borderRadius: 16,
    overflow: 'hidden',
  },
  genreImage: {
    borderRadius: 16,
  },
  genreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
  },
  genreTextContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  genreText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  genreSubText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
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
  loadMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loadMoreText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
});
