'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AlbumCard } from './AlbumCard';
import { DetailModal } from '../Modal/DetailModal';
import { MockVinylData } from '@vinyla/shared-types';
import { getUserVinyls, mapToFrontendModel, supabase, useAuthStore, createAlbumMaster } from '@vinyla/core-api';
import styles from './VinylGrid.module.css';
import { ShareBottomSheet } from '../Modal/ShareBottomSheet';
import { ShareableGridTemplate } from '../Share/ShareableGridTemplate';
import { captureElementAsBlob, shareImageNative, copyToClipboard } from '../../utils/shareUtils';

type FilterType = 'ALL' | 'OWNED' | 'WISH';
type ViewMode = 'grid4' | 'grid6' | 'table';
type SortMode = 'latest' | 'oldest' | 'alpha' | 'year';

interface VinylGridProps {
  statusFilter?: FilterType;
}

export const VinylGrid: React.FC<VinylGridProps> = ({ statusFilter = 'ALL' }) => {
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);
  const [activeTag, setActiveTag] = useState<string>('ALL');
  const [dbData, setDbData] = useState<MockVinylData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid4');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const shareGridRef = useRef<HTMLDivElement>(null);

  const { user, initializeAuth } = useAuthStore();
  const router = require('next/navigation').useRouter();

  useEffect(() => { initializeAuth(); }, []);

  useEffect(() => {
    if (user && !user.user_metadata?.displayName) {
      router.replace('/setup');
    }
  }, [user, router]);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('vinyls_dbData');
        if (cached) { try { setDbData(JSON.parse(cached)); } catch(e){} }
      }
      if (!user) { setDbData([]); setIsLoading(false); return; }
      const userVinyls = await getUserVinyls(user.id);
      if (userVinyls && userVinyls.length > 0) {
        const mapped = userVinyls.map(v => mapToFrontendModel(v, null));
        setDbData(mapped);
        if (typeof window !== 'undefined') localStorage.setItem('vinyls_dbData', JSON.stringify(mapped));
      } else {
        setDbData([]);
        if (typeof window !== 'undefined') localStorage.setItem('vinyls_dbData', '[]');
      }
      setIsLoading(false);
    }
    if (user !== undefined) loadData();
    const subscription = supabase
      .channel('public:USER_VINYL:web_home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'USER_VINYL' }, () => { if (user) loadData(); })
      .subscribe();
    const handleRefresh = () => loadData();
    window.addEventListener('REFRESH_VINYLS', handleRefresh);
    return () => {
        window.removeEventListener('REFRESH_VINYLS', handleRefresh);
        subscription.unsubscribe();
      };
  }, [user]);

  useEffect(() => {
    const handleToast = (e: any) => {
      setToastMessage(e.detail.message);
      setTimeout(() => setToastMessage(null), 3000);
    };
    window.addEventListener('SHOW_TOAST', handleToast);
    return () => window.removeEventListener('SHOW_TOAST', handleToast);
  }, []);

  // Auto-heal: strip country tags from existing records
  useEffect(() => {
    if (dbData.length === 0) return;
    const COUNTRY_TAGS = ['South Korea', 'Japan', 'US', 'UK', 'Europe', 'Germany', 'France', 'Netherlands', 'Canada', 'Australia', 'Italy', 'Sweden', 'Taiwan', 'Brazil', 'Russia'];
    const migrationDone = typeof window !== 'undefined' && localStorage.getItem('vinyls_migration_v8') === 'true';
    if (migrationDone) return;

    const albumsWithCountry = dbData.filter(a => a.GENRES && a.GENRES.some(g => COUNTRY_TAGS.includes(g)));
    const albumsWithNoGenres = dbData.filter(a => !a.GENRES || a.GENRES.length === 0 || (a.GENRES.length === 1 && a.GENRES[0] === 'Vinyl'));
    const allTargets = Array.from(new Set([...albumsWithCountry, ...albumsWithNoGenres]));

    if (allTargets.length === 0) { localStorage.setItem('vinyls_migration_v8', 'true'); return; }

    async function healData() {
      const token = process.env.NEXT_PUBLIC_DISCOGS_TOKEN;
      const key = process.env.NEXT_PUBLIC_DISCOGS_KEY;
      const secret = process.env.NEXT_PUBLIC_DISCOGS_SECRET;
      const authString = token ? `token=${token}` : `key=${key}&secret=${secret}`;

      for (const album of allTargets) {
        try {
          const existingGenres = (album.GENRES || []).filter(g => !COUNTRY_TAGS.includes(g));
          if (existingGenres.length > 0) {
            await createAlbumMaster({ ALBUM_ID: album.ALBUM_ID, TITLE: album.TITLE, ARTIST: album.ARTIST, RELEASE_YEAR: album.RELEASE_YEAR, IMAGE_URL: album.IMAGE_URL, VINYL_IMAGE_URL: album.VINYL_IMAGE_URL || '', CUSTOM_COLOR_HEX: album.CUSTOM_COLOR_HEX || '#1a1c1c', CUSTOM_STYLE_TYPE: album.CUSTOM_STYLE_TYPE || 'SOLID', TRACKS: album.TRACKS || [], GENRES: existingGenres });
            continue;
          }
          const query = encodeURIComponent(`${album.ARTIST} ${album.TITLE}`);
          const res = await fetch(`https://api.discogs.com/database/search?q=${query}&type=release&format=vinyl&per_page=1&${authString}`, { headers: { 'User-Agent': 'VinylA/1.0.0' } });
          const json = await res.json();
          const result = json.results?.[0];
          if (result) {
            let tracks: string[] = [];
            try { const rr = await fetch(`https://api.discogs.com/releases/${result.id}?${authString}`, { headers: { 'User-Agent': 'VinylA/1.0.0' } }); const rj = await rr.json(); tracks = rj.tracklist?.map((t: any) => t.title) || []; } catch {}
            const finalGenres = Array.from(new Set([...(result?.genre || []), ...(result?.style || [])]));
            if (finalGenres.length > 0) await createAlbumMaster({ ALBUM_ID: album.ALBUM_ID, TITLE: album.TITLE, ARTIST: album.ARTIST, RELEASE_YEAR: album.RELEASE_YEAR, IMAGE_URL: album.IMAGE_URL, VINYL_IMAGE_URL: album.VINYL_IMAGE_URL || '', CUSTOM_COLOR_HEX: album.CUSTOM_COLOR_HEX || '#1a1c1c', CUSTOM_STYLE_TYPE: album.CUSTOM_STYLE_TYPE || 'SOLID', TRACKS: tracks.length > 0 ? tracks : (album.TRACKS || []), GENRES: finalGenres });
          }
        } catch (err) { console.warn(`Auto-heal failed for ${album.TITLE}:`, err); }
      }
      if (typeof window !== 'undefined') localStorage.setItem('vinyls_migration_v8', 'true');
      window.dispatchEvent(new CustomEvent('REFRESH_VINYLS'));
    }
    const timer = setTimeout(healData, 1000);
    return () => clearTimeout(timer);
  }, [dbData]);

  const dataToUse = dbData.filter(album => statusFilter === 'ALL' || album.STATUS === statusFilter);
  const allTags = Array.from(new Set(dataToUse.flatMap(album => album.GENRES || []))).sort();

  const filteredAlbums = dataToUse.filter(album =>
    activeTag === 'ALL' || (album.GENRES && album.GENRES.includes(activeTag))
  );

  const displayedAlbums = [...filteredAlbums].sort((a, b) => {
    switch (sortMode) {
      case 'oldest': return (a.PURCHASE_DATE || '').localeCompare(b.PURCHASE_DATE || '');
      case 'alpha':  return a.TITLE.localeCompare(b.TITLE, 'ko');
      case 'year':   return (Number(b.RELEASE_YEAR) || 0) - (Number(a.RELEASE_YEAR) || 0);
      default:       return (b.PURCHASE_DATE || '').localeCompare(a.PURCHASE_DATE || '');
    }
  });

  const handleShareLink = async () => {
    if (user?.id) {
      const link = `${window.location.origin}/user/${user.id}`;
      await copyToClipboard(link);
      setToastMessage('프로필 링크가 복사되었습니다!');
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleShareImage = async () => {
    if (shareGridRef.current) {
      const blob = await captureElementAsBlob(shareGridRef.current);
      if (blob) {
        await shareImageNative(blob, 'vinyl-collection.jpg');
      }
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.pageEyebrow}>My Collection</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 className={styles.pageTitle}>보관함</h1>
            <button className={styles.shareBtn} onClick={() => setIsShareOpen(true)} title="공유하기">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>ios_share</span>
            </button>
          </div>
          <p className={styles.pageSubtitle}>{displayedAlbums.length} Records</p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.controlsRow}>
            <div className={styles.sortGroup}>
              {([
                { key: 'latest', label: '최신순' },
                { key: 'oldest', label: '오래된순' },
                { key: 'alpha',  label: '가나다순' },
                { key: 'year',   label: '출시연도순' },
              ] as { key: SortMode; label: string }[]).map(({ key, label }) => (
                <button key={key} className={`${styles.controlChip} ${sortMode === key ? styles.controlActive : ''}`} onClick={() => setSortMode(key)}>
                  {label}
                </button>
              ))}
            </div>
            <div className={styles.viewGroup}>
              <button className={`${styles.viewBtn} ${viewMode === 'grid4' ? styles.viewActive : ''}`} onClick={() => setViewMode('grid4')} title="4열 그리드">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
                  <rect x="0" y="0" width="6" height="6"/><rect x="9" y="0" width="6" height="6"/>
                  <rect x="0" y="9" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/>
                </svg>
              </button>
              <button className={`${styles.viewBtn} ${viewMode === 'grid6' ? styles.viewActive : ''}`} onClick={() => setViewMode('grid6')} title="조밀 그리드">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
                  <rect x="0" y="0" width="3" height="3"/><rect x="6" y="0" width="3" height="3"/><rect x="12" y="0" width="3" height="3"/>
                  <rect x="0" y="6" width="3" height="3"/><rect x="6" y="6" width="3" height="3"/><rect x="12" y="6" width="3" height="3"/>
                  <rect x="0" y="12" width="3" height="3"/><rect x="6" y="12" width="3" height="3"/><rect x="12" y="12" width="3" height="3"/>
                </svg>
              </button>
              <button className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewActive : ''}`} onClick={() => setViewMode('table')} title="테이블 보기">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
                  <rect x="0" y="0" width="15" height="2.5"/><rect x="0" y="4.5" width="15" height="2.5"/>
                  <rect x="0" y="9" width="15" height="2.5"/><rect x="0" y="13.5" width="15" height="1.5"/>
                </svg>
              </button>
            </div>
          </div>
          <div className={styles.tagRow}>
            <div className={styles.spacer} />
            <button className={`${styles.filterChip} ${activeTag === 'ALL' ? styles.active : ''}`} onClick={() => setActiveTag('ALL')}>전체</button>
            {allTags.map(tag => (
              <button key={tag} className={`${styles.filterChip} ${activeTag === tag ? styles.active : ''}`} onClick={() => setActiveTag(tag)}>{tag}</button>
            ))}
          </div>
        </div>
      </header>

      {viewMode !== 'table' ? (
        <div className={viewMode === 'grid4' ? styles.grid4 : styles.grid6}>
          {displayedAlbums.map(album => (
            <AlbumCard key={album.ALBUM_ID} album={album} onClick={setSelectedAlbum} />
          ))}
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thCover}></th>
                <th className={styles.thTitle}>앨범</th>
                <th className={styles.thArtist}>아티스트</th>
                <th className={styles.thYear}>출시</th>
                <th className={styles.thTags}>태그</th>
                <th className={styles.thStatus}>상태</th>
              </tr>
            </thead>
            <tbody>
              {displayedAlbums.map(album => (
                <tr key={album.ALBUM_ID} className={styles.tableRow} onClick={() => setSelectedAlbum(album)}>
                  <td className={styles.tdCover}>
                    <div className={styles.tableCoverBox}>
                      <img src={album.IMAGE_URL || `https://picsum.photos/seed/${album.ALBUM_ID}/60/60`} alt={album.TITLE} className={styles.tableThumb} />
                    </div>
                  </td>
                  <td className={styles.tdTitle}>{album.TITLE}</td>
                  <td className={styles.tdArtist}>{album.ARTIST}</td>
                  <td className={styles.tdYear}>{album.RELEASE_YEAR || '—'}</td>
                  <td className={styles.tdTags}>
                    {(album.GENRES || []).slice(0, 3).map(g => <span key={g} className={styles.tableTag}>{g}</span>)}
                  </td>
                  <td className={styles.tdStatus}>
                    <span className={album.STATUS === 'OWNED' ? styles.statusOwned : styles.statusWish}>
                      {album.STATUS === 'OWNED' ? '보유' : '위시'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedAlbum && <DetailModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />}

      {toastMessage && (
        <div className={styles.toast}>
          <span className="material-symbols-outlined">check_circle</span>
          {toastMessage}
        </div>
      )}

      <ShareBottomSheet 
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title="보관함 공유하기"
        options={[
          { id: 'link', label: '링크 복사', icon: 'link', action: handleShareLink },
          { id: 'image', label: '이미지 저장', icon: 'image', action: handleShareImage }
        ]}
      />

      <ShareableGridTemplate 
        ref={shareGridRef}
        albums={displayedAlbums}
        username={user?.user_metadata?.displayName || 'Collector'}
        title="보관함"
      />
    </div>
  );
};
