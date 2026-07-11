'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AlbumCard } from './AlbumCard';
import { DetailModal } from '../Modal/DetailModal';
import { ShareBottomSheet } from '../Modal/ShareBottomSheet';
import { ShareableGridTemplate } from '../Share/ShareableGridTemplate';
import { SharePreviewModal } from '../Modal/SharePreviewModal';
import { copyToClipboard, captureElementAsBlob } from '../../utils/shareUtils';
import { useAuthStore, createAlbumMaster, getUserVinyls, mapToFrontendModel, supabase } from '@vinyla/core-api';
import { MockVinylData } from '@vinyla/shared-types';
import styles from './VinylGrid.module.css';

type FilterType = 'ALL' | 'OWNED' | 'WISH';
type ViewMode = 'grid4' | 'grid6' | 'table';
type SortMode = 'latest' | 'oldest' | 'alpha' | 'year';
type VinylItem = ReturnType<typeof mapToFrontendModel> & { TRACKS?: string[] };

interface VinylGridProps {
  statusFilter?: FilterType;
}

export const VinylGrid: React.FC<VinylGridProps> = ({ statusFilter = 'ALL' }) => {
  const [selectedAlbum, setSelectedAlbum] = useState<MockVinylData | null>(null);
  const [activeTag, setActiveTag] = useState<string>('ALL');
  const [dbData, setDbData] = useState<VinylItem[]>([]);
  const [, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid4');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewMode, setPreviewMode] = useState<'save' | 'copy' | null>(null);

  const shareGridRef = useRef<HTMLDivElement>(null);

  const { user, initializeAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => { initializeAuth(); }, [initializeAuth]);

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
        if (cached) { try { setDbData(JSON.parse(cached)); } catch {} }
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

    const handleRefresh = () => loadData();
    window.addEventListener('REFRESH_VINYLS', handleRefresh);

    // Subscribe only to this user's rows — an unfiltered subscription makes
    // every client refetch on every other user's change.
    if (!user) {
      return () => window.removeEventListener('REFRESH_VINYLS', handleRefresh);
    }
    const subscription = supabase
      .channel('public:USER_VINYL:web_home')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'USER_VINYL', filter: `USER_ID=eq.${user.id}` }, () => loadData())
      .subscribe();
    return () => {
        window.removeEventListener('REFRESH_VINYLS', handleRefresh);
        subscription.unsubscribe();
      };
  }, [user]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      setToastMessage((e as CustomEvent<{ message: string }>).detail.message);
      setTimeout(() => setToastMessage(null), 3000);
    };
    window.addEventListener('SHOW_TOAST', handleToast);
    return () => window.removeEventListener('SHOW_TOAST', handleToast);
  }, []);



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
      const name = encodeURIComponent(user.user_metadata?.displayName || 'Collector');
      const avatar = encodeURIComponent(user.user_metadata?.avatar_url || '/logo.png');
      const link = `${window.location.origin}/user/${user.id}?n=${name}&a=${avatar}`;
      await copyToClipboard(link);
      setToastMessage('프로필 링크가 복사되었습니다!');
      setTimeout(() => setToastMessage(null), 3000);
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

      {displayedAlbums.length === 0 ? (
        <div className={styles.emptyState}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'rgba(255,255,255,0.2)', marginBottom: '16px' }}>album</span>
          <p className={styles.emptyStateText}>컬렉션이 비어 있습니다.</p>
          <button className={styles.emptyStateBtn} onClick={() => router.push('/search')}>새 앨범 찾기</button>
        </div>
      ) : viewMode !== 'table' ? (
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
                    {(album.GENRES || []).slice(0, 3).map((g: string) => <span key={g} className={styles.tableTag}>{g}</span>)}
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
          { id: 'image', label: '이미지 저장', icon: 'download', action: async () => {
              setIsShareOpen(false);
              const blob = await captureElementAsBlob(shareGridRef.current!, 'jpeg');
              if (blob) {
                setPreviewBlob(blob);
                setPreviewMode('save');
                setIsPreviewOpen(true);
              }
            }
          },
          { id: 'copy', label: '이미지 복사', icon: 'content_copy', action: async () => {
              setIsShareOpen(false);
              const blob = await captureElementAsBlob(shareGridRef.current!, 'png');
              if (blob) {
                setPreviewBlob(blob);
                setPreviewMode('copy');
                setIsPreviewOpen(true);
              }
            } 
          },
          { id: 'link', label: '링크 복사', icon: 'link', action: handleShareLink }
        ]}
      />

      <SharePreviewModal 
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        blob={previewBlob}
        mode={previewMode}
      />

      <ShareableGridTemplate 
        ref={shareGridRef}
        albums={displayedAlbums.filter(a => a.STATUS !== 'WISH')}
        username={user?.user_metadata?.displayName || 'Collector'}
        title="보관함"
      />
    </div>
  );
};
