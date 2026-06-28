'use client';

import React, { useState, useRef, useCallback } from 'react';
import { searchDiscogsLazy, AlbumItem, SearchStatus } from '@vinyla/core-api';
import { DetailModal } from '../../components/Modal/DetailModal';
import styles from './page.module.css';

const genres = [
  { title: '재즈',          sub: 'Jazz',        height: 320, img: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?q=80&w=800&auto=format&fit=crop' },
  { title: '일렉트로닉',    sub: 'Electronic',  height: 240, img: 'https://images.unsplash.com/photo-1518655048521-f130df041f66?q=80&w=800&auto=format&fit=crop' },
  { title: '시네마틱',      sub: 'Cinematic',   height: 400, img: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=800&auto=format&fit=crop' },
  { title: '클래식',        sub: 'Classical',   height: 280, img: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=800&auto=format&fit=crop' },
  { title: '소울',          sub: 'Soul & Funk', height: 360, img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=800&auto=format&fit=crop' },
  { title: '앰비언트',      sub: 'Ambient',     height: 220, img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop' },
  { title: '록',            sub: 'Rock',        height: 300, img: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=800&auto=format&fit=crop' },
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
  const [selectedAlbum, setSelectedAlbum] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      setResults([]);
      setStatus('idle');
      return;
    }

    // Bump search ID so stale callbacks from a previous search are ignored
    const currentSearchId = ++searchIdRef.current;

    setResults([]);
    setStatus('fetching_itunes');
    setTotalToCheck(0);

    await searchDiscogsLazy(
      query,
      // onItem — called each time a validated album is ready
      (album) => {
        if (searchIdRef.current !== currentSearchId) return; // stale, discard
        setResults((prev) => {
          // Deduplicate by id
          if (prev.some((a) => a.id === album.id)) return prev;
          return [...prev, album];
        });
      },
      // onStatusChange
      (newStatus, total) => {
        if (searchIdRef.current !== currentSearchId) return;
        setStatus(newStatus);
        if (total !== undefined) setTotalToCheck(total);
      }
    );
  }, [query]);

  const isLoading = status === 'fetching_itunes' || status === 'validating';
  const isValidating = status === 'validating';

  // During validation phase, show skeleton placeholders for items not yet found
  const skeletonCount = isValidating ? Math.max(0, totalToCheck - results.length) : 0;

  const sectionTitle = isLoading
    ? isValidating
      ? `LP 검증 중... (${results.length} / ${totalToCheck})`
      : '검색 중...'
    : results.length > 0
      ? `검색 결과 (${results.length})`
      : status === 'done'
        ? 'Discogs에 등록된 LP가 없습니다'
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
            {isValidating && (
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: totalToCheck ? `${(results.length / totalToCheck) * 100}%` : '0%' }}
                />
              </div>
            )}
            <button className={styles.viewAllBtn}>전체 →</button>
          </div>

          <div className={styles.masonryGrid}>
            {/* Actual found albums */}
            {results.map((item) => (
              <AlbumCard
                key={item.id}
                item={item}
                onSelect={(a) => setSelectedAlbum({
                  ALBUM_ID: a.id,
                  TITLE: a.title,
                  ARTIST: a.artist,
                  IMAGE_URL: a.thumb,
                  RELEASE_YEAR: a.year
                })}
              />
            ))}

            {/* Skeleton placeholders while validating */}
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <SkeletonCard key={`sk-${i}`} />
            ))}

            {/* Genre cards when idle */}
            {status === 'idle' && genres.map((genre, idx) => (
              <div key={idx} className={styles.masonryItem}>
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

            {/* Full-screen spinner only during iTunes fetch (before any results) */}
            {status === 'fetching_itunes' && results.length === 0 && (
              <div className={styles.loadingState}>
                <div className={styles.spinner} />
                <p>Apple Music에서 검색 중...</p>
              </div>
            )}
          </div>
        </section>
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
