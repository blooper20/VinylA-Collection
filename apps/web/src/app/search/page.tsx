'use client';

import React, { useState, useRef, useCallback } from 'react';
import { searchDiscogsLazy, AlbumItem, SearchStatus, useAuthStore, getUserVinyls } from '@vinyla/core-api';
import { DetailModal } from '../../components/Modal/DetailModal';
import styles from './page.module.css';

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
  { title: '레게',          sub: 'Reggae',      height: 300, img: 'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?q=80&w=800&auto=format&fit=crop' },
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
        src={item.thumb || 'https://via.placeholder.com/200'}
        alt={item.title}
        className={styles.genreImage}
        style={{ height: 260 }}
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
  const [selectedAlbum, setSelectedAlbum] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const observerTarget = useRef<HTMLDivElement>(null);

  const { user, initializeAuth } = useAuthStore();
  const [userVinyls, setUserVinyls] = useState<any[]>([]);

  React.useEffect(() => {
    initializeAuth();
  }, []);

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
    const handleToast = (e: any) => {
      setToastMessage(e.detail.message);
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
      (newStatus, total) => {
        if (searchIdRef.current !== currentSearchId) return;
        setStatus(newStatus);
        if (total !== undefined) {
          setTotalToCheck(prev => append ? prev + total : total);
          if ((newStatus === 'done' || newStatus === 'error') && total === 0) {
            setHasMore(false);
          }
        }
      }
    );
  }, []);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && query.startsWith('#') && status === 'done' && hasMore) {
          executeSearch(query, true);
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
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

  const skeletonCount = isEnriching ? Math.max(0, totalToCheck - results.length) : 0;

  const mainResults = results.filter(r => !r.isFeature);
  const featuredResults = results.filter(r => r.isFeature);

  const sectionTitle = isLoading
    ? isEnriching
      ? `커버 이미지 불러오는 중... (${results.length} / ${totalToCheck})`
      : 'Discogs에서 LP 검색 중...'
    : mainResults.length > 0
      ? `LP 검색 결과 (${mainResults.length})`
      : status === 'done'
        ? 'Discogs에 등록된 정규 LP가 없습니다'
        : status === 'error'
          ? '서버 요청 한도 초과 (잠시 후 다시 시도해주세요)'
          : '장르';

  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <div className={styles.heroGradient} />
        <div className={styles.heroInner}>
          <span className={styles.heroEyebrow}>Discover Archive</span>
          <h1 className={styles.heroTitle}>
            지금, 어떤<br />
            <em>음악</em>이요?
          </h1>
          <form className={styles.searchBar} onSubmit={handleSearch}>
            <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="앨범, 아티스트, 레이블 검색"
              className={styles.searchInput}
            />
            <button type="submit" style={{ display: 'none' }}>검색</button>
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
                  <h3 className={styles.genreTitle}>{genre.title}</h3>
                  <p className={styles.genreSub}>{genre.sub}</p>
                </div>
              </div>
            ))}

            {/* Full-screen spinner only during initial iTunes fetch (before any results) */}
            {status === 'fetching_discogs' && results.length === 0 && (
              <div className={styles.loadingState}>
                <div className={styles.spinner} />
                <p>Discogs에서 LP를 검색하는 중...</p>
              </div>
            )}
          </div>
        </section>

        {/* Featured / Compilation Section */}
        {featuredResults.length > 0 && (
          <section style={{ marginTop: '4rem' }}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>피처링 및 참여 앨범 ({featuredResults.length})</h2>
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
        <DetailModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />
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
