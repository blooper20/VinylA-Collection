'use client';

import React, { useState, useEffect, useRef } from 'react';
import { DetailModal } from '../../components/Modal/DetailModal';
import { ShareBottomSheet } from '../../components/Modal/ShareBottomSheet';
import { SharePreviewModal } from '../../components/Modal/SharePreviewModal';
import { ShareableGridTemplate } from '../../components/Share/ShareableGridTemplate';
import { captureElementAsBlob } from '../../utils/shareUtils';
import { useAuthStore, getUserVinyls, mapToFrontendModel, supabase } from '@vinyla/core-api';
import styles from './page.module.css';

type ViewMode = 'grid4' | 'grid6' | 'table';
type SortMode = 'latest' | 'oldest' | 'alpha' | 'year';

export default function WishlistPage() {
  const [selectedAlbum, setSelectedAlbum] = useState<any | null>(null);
  const [wishes, setWishes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid4');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewMode, setPreviewMode] = useState<'save' | 'copy' | null>(null);
  const shareGridRef = useRef<HTMLDivElement>(null);

  const { user, initializeAuth } = useAuthStore();

  useEffect(() => { initializeAuth(); }, []);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      if (!user) { setWishes([]); setIsLoading(false); return; }
      const userVinyls = await getUserVinyls(user.id);
      if (userVinyls && userVinyls.length > 0) {
        const mapped = userVinyls.map(v => mapToFrontendModel(v, null));
        setWishes(mapped.filter(a => a.STATUS === 'WISH'));
      } else {
        setWishes([]);
      }
      setIsLoading(false);
    }
    if (user !== undefined) loadData();
    const subscription = supabase
      .channel('public:USER_VINYL:web_wish')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'USER_VINYL' }, () => { if (user) loadData(); })
      .subscribe();
    const handleRefresh = () => loadData();
    window.addEventListener('REFRESH_VINYLS', handleRefresh);
    return () => { supabase.removeChannel(subscription); window.removeEventListener('REFRESH_VINYLS', handleRefresh); };
  }, [user]);

  const sorted = [...wishes].sort((a, b) => {
    switch (sortMode) {
      case 'oldest': return (a.PURCHASE_DATE || '').localeCompare(b.PURCHASE_DATE || '');
      case 'alpha':  return a.TITLE.localeCompare(b.TITLE, 'ko');
      case 'year':   return (Number(b.RELEASE_YEAR) || 0) - (Number(a.RELEASE_YEAR) || 0);
      default:       return (b.PURCHASE_DATE || '').localeCompare(a.PURCHASE_DATE || '');
    }
  });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.headerLeft}>
            <span className={styles.eyebrow}>Archive</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h1 className={styles.title}>위시리스트</h1>
              <button className={styles.shareBtn} onClick={() => setIsShareOpen(true)} title="공유하기" style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>ios_share</span>
              </button>
            </div>
            <p className={styles.subtitle}>수집을 기다리는 {sorted.length}장의 바이닐</p>
          </div>
          <div className={styles.headerControls}>
            {/* Sort */}
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
            {/* View */}
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
        </div>
      </header>

      {isLoading ? (
        <div className={styles.empty}>Loading...</div>
      ) : sorted.length === 0 ? (
        <div className={styles.empty}>아직 위시리스트에 담긴 바이닐이 없습니다.</div>
      ) : viewMode !== 'table' ? (
        <div className={viewMode === 'grid4' ? styles.grid4 : styles.grid6}>
          {sorted.map(rec => (
            <div key={rec.ALBUM_ID} className={styles.card} onClick={() => setSelectedAlbum(rec)}>
              <div className={styles.coverWrapper}>
                <img src={rec.IMAGE_URL || rec.COVER_URL} alt={rec.TITLE} className={styles.cover} loading="lazy" />
                <div className={styles.coverOverlay}>
                  <span className="material-symbols-outlined">zoom_in</span>
                </div>
              </div>
              <div className={styles.info}>
                <h2 className={styles.albumTitle}>{rec.TITLE}</h2>
                <p className={styles.albumArtist}>{rec.ARTIST} <span className={styles.dot}>•</span> {rec.RELEASE_YEAR}</p>
              </div>
            </div>
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
              </tr>
            </thead>
            <tbody>
              {sorted.map(rec => (
                <tr key={rec.ALBUM_ID} className={styles.tableRow} onClick={() => setSelectedAlbum(rec)}>
                  <td className={styles.tdCover}>
                    <div className={styles.tableCoverBox}>
                      <img src={rec.IMAGE_URL || rec.COVER_URL} alt={rec.TITLE} className={styles.tableThumb} />
                    </div>
                  </td>
                  <td className={styles.tdTitle}>{rec.TITLE}</td>
                  <td className={styles.tdArtist}>{rec.ARTIST}</td>
                  <td className={styles.tdYear}>{rec.RELEASE_YEAR || '—'}</td>
                  <td className={styles.tdTags}>
                    {(rec.GENRES || []).slice(0, 3).map((g: string) => <span key={g} className={styles.tableTag}>{g}</span>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedAlbum && <DetailModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />}

      <ShareBottomSheet 
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title="위시리스트 공유하기"
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
          { id: 'link', label: '링크 복사', icon: 'link', action: async () => {
              setIsShareOpen(false);
              if (user?.id) {
                const link = `${window.location.origin}/user/${user.id}`;
                await import('../../utils/shareUtils').then(m => m.copyToClipboard(link));
                alert('프로필 링크가 복사되었습니다!');
              }
            } 
          }
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
        albums={sorted}
        username={user?.user_metadata?.displayName || 'Collector'}
        title="위시리스트"
      />
    </div>
  );
}
