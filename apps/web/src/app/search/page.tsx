'use client';

import React, { useState, useRef, useCallback } from 'react';
import { searchDiscogsLazy, AlbumItem, SearchStatus, useAuthStore, getUserVinyls } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { MockVinylData, USER_VINYL } from '@vinyla/shared-types';
import { DetailModal } from '../../components/Modal/DetailModal';
import styles from './page.module.css';

// 검색 결과(AlbumItem)에서 DetailModal로 넘기는 앨범 형태
type SelectedAlbum = {
  ALBUM_ID: number | string;
  TITLE: string;
  ARTIST: string;
  IMAGE_URL: string;
  RELEASE_YEAR: number | string;
  GENRES?: string[];
  STATUS?: 'OWNED' | 'WISH' | 'NONE';
};

const genres = [
  { title: '팝',            sub: 'Pop',         height: 260, img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop' },
  { title: '록',            sub: 'Rock',        height: 320, img: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=800&auto=format&fit=crop' },
  { title: '재즈',          sub: 'Jazz',        height: 280, img: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?q=80&w=800&auto=format&fit=crop' },
  { title: '일렉트로닉',    sub: 'Electronic',  height: 240, img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop' },
  { title: '힙합',          sub: 'Hip Hop',     height: 300, img: 'https://images.unsplash.com/photo-1601643157091-ce5c665179ab?q=80&w=800&auto=format&fit=crop' },
  { title: 'R&B / 소울',    sub: 'R&B / Soul',  height: 360, img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=800&auto=format&fit=crop' },
  { title: '인디 / 포크',   sub: 'Folk',        height: 280, img: 'https://images.unsplash.com/photo-1501612780327-45045538702b?q=80&w=800&auto=format&fit=crop' },
  { title: '클래식',        sub: 'Classical',   height: 260, img: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=800&auto=format&fit=crop' },
  { title: '블루스',        sub: 'Blues',       height: 240, img: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=800&auto=format&fit=crop' },
  { title: '레게',          sub: 'Reggae',      height: 300, img: 'https://upload.wikimedia.org/wikipedia/commons/6/60/Lenke_djembe_from_Mali.jpeg' },
  { title: '시네마틱',      sub: 'Cinematic',   height: 400, img: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=800&auto=format&fit=crop' },
  { title: '앰비언트',      sub: 'Ambient',     height: 220, img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop' },
  { title: '월드',          sub: 'World',       height: 260, img: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=800&auto=format&fit=crop' },
];

// ─── Skeleton card placeholder ───────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className={styles.masonryItem} style={{ pointerEvents: 'none' }}>
      <div className={styles.skeletonImage} />
      <div className={styles.genreContent}>
        <div className={styles.skeletonLine} style={{ width: '70%', height: 18, marginBottom: 8 }} />
        <div className={styles.skeletonLine} style={{ width: '45%', height: 14 }} />
      </div>
    </div>
  );
}

// ─── Result card with entrance animation ─────────────────────────────────────
function AlbumCard({ item, onSelect }: { item: AlbumItem; onSelect: (item: AlbumItem) => void }) {
  return (
    <div
      className={`${styles.masonryItem} ${styles.albumCardIn}`}
      onClick={() => onSelect(item)}
      style={{ cursor: 'pointer' }}
    >
      <img
        src={item.thumb || '/logo_real_transparent.png'}
        alt={item.title}
        className={styles.genreImage}
        style={{ 
          height: 260, 
          objectFit: item.thumb ? 'cover' : 'contain', 
          backgroundColor: item.thumb ? 'transparent' : '#161616',
          padding: item.thumb ? 0 : 30,
          border: item.thumb ? 'none' : '1px solid rgba(255,255,255,0.08)'
        }}
        loading="lazy"
      />
      <div className={styles.genreContent}>
        <h3 className={styles.genreTitle} style={{ fontSize: '18px' }}>{item.title}</h3>
        <p className={styles.genreSub}>{item.artist ? `${item.artist}` : ''}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AlbumItem[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [totalToCheck, setTotalToCheck] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<SelectedAlbum | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  const { user, initializeAuth } = useAuthStore();
  const { locale, t } = useLocale();
  const [userVinyls, setUserVinyls] = useState<USER_VINYL[]>([]);

  React.useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  React.useEffect(() => {
    async function loadData() {
      if (!user) {
        setUserVinyls([]);
        return;
      }
      const vinyls = await getUserVinyls(user.id);
      setUserVinyls(vinyls || []);
    }
    
    if (user !== undefined) loadData();

    const handleRefresh = () => loadData();
    window.addEventListener('REFRESH_VINYLS', handleRefresh);
    return () => window.removeEventListener('REFRESH_VINYLS', handleRefresh);
  }, [user]);

  // cancel token: if user starts a new search, discard stale callbacks
  const searchIdRef = useRef(0);

  React.useEffect(() => {
    const handleToast = (e: Event) => {
      setToastMessage((e as CustomEvent<{ message: string }>).detail.message);
      setTimeout(() => setToastMessage(null), 3000);
    };
    window.addEventListener('SHOW_TOAST', handleToast);
    return () => window.removeEventListener('SHOW_TOAST', handleToast);
  }, []);

  const executeSearch = useCallback(async (q: string, append: boolean = false) => {
    if (!q.trim()) {
      if (!append) setResults([]);
      setStatus('idle');
      return;
    }

    const currentSearchId = ++searchIdRef.current;
    if (!append) {
      setResults([]);
      setTotalToCheck(0);
      setHasMore(true);
    }
    setStatus('fetching_discogs');

    await searchDiscogsLazy(
      q,
      (album) => {
        if (searchIdRef.current !== currentSearchId) return;
        setResults((prev) => {
          if (prev.some((a) => a.id === album.id)) return prev;
          return [...prev, album];
        });
      },
      (newStatus, total, error) => {
        if (searchIdRef.current !== currentSearchId) return;
        setStatus(newStatus);
        
        if (newStatus === 'error' && error) {
          import('@vinyla/core-api').then(({ getErrorMessage }) => {
            window.dispatchEvent(new CustomEvent('SHOW_TOAST', {
              detail: { message: getErrorMessage(error, t) }
            }));
          });
        }

        if (total !== undefined) {
          setTotalToCheck(prev => append ? prev + total : total);
          if ((newStatus === 'done' || newStatus === 'error') && total === 0) {
            setHasMore(false);
          }
        }
      }
    );
  }, [t]);

  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && query.startsWith('#') && status === 'done' && hasMore) {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            executeSearch(query, true);
          }, 300);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
    // hasMore를 deps에 넣으면 무한 스크롤 fetch가 재트리거되므로 제외 (동작 유지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, executeSearch]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  }, [query, executeSearch]);

  const handleGenreClick = useCallback((genreTitle: string, genreSub: string) => {
    setQuery(`#${genreSub}`); // Show in search bar for context
    executeSearch(`#${genreSub}`);
  }, [executeSearch]);

  const isLoading = status === 'fetching_discogs' || status === 'enriching';
  const isEnriching = status === 'enriching';

  const skeletonCount = status === 'fetching_discogs' && results.length === 0 
    ? 12 
    : isEnriching ? Math.max(0, totalToCheck - results.length) : 0;

  const mainResults = results.filter(r => !r.isFeature);
  const featuredResults = results.filter(r => r.isFeature);

  const sectionTitle = isLoading
    ? isEnriching
      ? t('search.enrichingProgress', { current: results.length, total: totalToCheck })
      : t('search.loadingDiscogs')
    : mainResults.length > 0
      ? t('search.resultsCount', { count: mainResults.length })
      : status === 'done'
        ? t('search.noResults')
        : status === 'error'
          ? t('search.rateLimited')
          : t('search.genreSectionDefault');

  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <div className={styles.heroGradient} />
        <div className={styles.heroInner}>
          <span className={styles.heroEyebrow}>Discover Archive</span>
          <h1 className={styles.heroTitle}>
            {t('search.heroLine1')}<br />
            <em>{t('search.heroEm')}</em>{t('search.heroSuffix')}
          </h1>
          <form className={styles.searchBar} onSubmit={handleSearch}>
            <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              className={styles.searchInput}
            />
            <button type="submit" style={{ display: 'none' }}>{t('search.submitButton')}</button>
          </form>
        </div>
      </header>

      <main className={styles.content}>
        <section>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{sectionTitle}</h2>
            {isEnriching && (
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: totalToCheck ? `${(results.length / totalToCheck) * 100}%` : '0%' }}
                />
              </div>
            )}
          </div>

          <div className={styles.masonryGrid}>
            {/* Actual found albums */}
            {mainResults.map((item) => (
              <AlbumCard
                key={item.id}
                item={item}
                onSelect={(a) => {
                  const existing = userVinyls.find(v => v.ALBUM_ID === a.id);
                  setSelectedAlbum({
                    ALBUM_ID: a.id,
                    TITLE: a.title,
                    ARTIST: a.artist,
                    IMAGE_URL: a.thumb,
                    RELEASE_YEAR: a.year,
                    GENRES: a.genre,
                    STATUS: existing ? existing.STATUS : undefined
                  });
                }}
              />
            ))}

            {/* Skeleton placeholders while validating */}
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <SkeletonCard key={`sk-${i}`} />
            ))}

            {/* Genre cards when idle */}
            {status === 'idle' && genres.map((genre, idx) => (
              <div 
                key={idx} 
                className={styles.masonryItem}
                onClick={() => handleGenreClick(genre.title, genre.sub)}
                style={{ cursor: 'pointer' }}
              >
                <img
                  src={genre.img}
                  alt={genre.title}
                  className={styles.genreImage}
                  style={{ height: genre.height }}
                  loading="lazy"
                />
                <div className={styles.genreContent}>
                  <h3 className={styles.genreTitle}>{locale === 'ko' ? genre.title : genre.sub}</h3>
                  {locale === 'ko' && <p className={styles.genreSub}>{genre.sub}</p>}
                </div>
              </div>
            ))}

            {/* Full-screen spinner removed in favor of Skeletons */}
            {status === 'fetching_discogs' && results.length === 0 && (
              <div style={{ width: '100%', height: '20vh' }}></div>
            )}
          </div>
        </section>

        {/* Featured / Compilation Section */}
        {featuredResults.length > 0 && (
          <section style={{ marginTop: '4rem' }}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{t('search.featuredSection', { count: featuredResults.length })}</h2>
            </div>
            <div className={styles.masonryGrid}>
              {featuredResults.map((item) => (
                <AlbumCard
                  key={item.id}
                  item={item}
                  onSelect={(a) => {
                    const existing = userVinyls.find(v => v.ALBUM_ID === a.id);
                    setSelectedAlbum({
                      ALBUM_ID: a.id,
                      TITLE: a.title,
                      ARTIST: a.artist,
                      IMAGE_URL: a.thumb,
                      RELEASE_YEAR: a.year,
                      GENRES: a.genre,
                      STATUS: existing ? existing.STATUS : undefined
                    });
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Loading indicator during infinite scroll fetching */}
        {query.startsWith('#') && status !== 'idle' && hasMore && (
          <div ref={observerTarget} style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2rem' }}>
            {status !== 'done' && status !== 'error' && <div className={styles.spinner} style={{ width: 30, height: 30, borderWidth: 3 }} />}
          </div>
        )}
      </main>

      {selectedAlbum && (
        <DetailModal album={selectedAlbum as MockVinylData} onClose={() => setSelectedAlbum(null)} />
      )}

      {toastMessage && (
        <div className={styles.toast}>
          <span className="material-symbols-outlined">check_circle</span>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
