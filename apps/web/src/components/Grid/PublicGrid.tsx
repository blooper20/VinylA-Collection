import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './PublicGrid.module.css';
import { getUserVinyls, useAuthStore } from '@vinyla/core-api';
import { MockVinylData } from '@vinyla/shared-types';
import { DetailModal } from '../Modal/DetailModal';

type PublicVinyl = MockVinylData & { COVER_URL?: string };

interface PublicGridProps {
  userId: string;
  initialName?: string;
  initialAvatar?: string;
  filterType?: 'collection' | 'wishlist';
}

export const PublicGrid: React.FC<PublicGridProps> = ({ userId, initialName = 'Collector', initialAvatar = '/logo.png', filterType = 'collection' }) => {
  const [dbData, setDbData] = useState<PublicVinyl[]>([]);
  const [profileName] = useState<string>(initialName);
  const [avatarUrl] = useState<string>(initialAvatar);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<PublicVinyl | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const { user, initializeAuth } = useAuthStore();
  useEffect(() => { initializeAuth(); }, [initializeAuth]);

  useEffect(() => {
    async function fetchPublicData() {
      setIsLoading(true);
      try {
        const vinyls = await getUserVinyls(userId);

        if (vinyls && vinyls.length > 0) {
          const formatted: PublicVinyl[] = vinyls.map((v) => ({
            ...(v.ALBUM_MASTER || {}),
            STATUS: v.STATUS,
            PURCHASE_PRICE: v.PURCHASE_PRICE,
            PURCHASE_DATE: v.PURCHASE_DATE
          }));
          setDbData(formatted);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    if (userId) {
      fetchPublicData();
    }
  }, [userId]);

  if (isLoading) {
    return <div className={styles.loading}>컬렉션 불러오는 중...</div>;
  }

  const handleAlbumClick = (album: PublicVinyl) => {
    if (!user) {
      setShowLoginPrompt(true);
    } else {
      setSelectedAlbum(album);
    }
  };

  // Filter based on the share link type
  const isWishlist = filterType === 'wishlist';
  const displayData = dbData.filter(v => isWishlist ? v.STATUS === 'WISH' : v.STATUS !== 'WISH');
  const recordCount = displayData.length;
  const pageTitle = isWishlist ? `${profileName}'s Wishlist` : `${profileName}'s Collection`;

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.header}>
        <Link href={`/user/${userId}`}>
          <img src={avatarUrl} alt="Avatar" className={styles.avatar} style={{ cursor: 'pointer' }} />
        </Link>
        <h1 className={styles.title}>{pageTitle}</h1>
        <p className={styles.subtitle}>{recordCount} Records</p>
      </header>

      <div className={styles.grid}>
        {displayData.map(album => (
          <div key={album.ALBUM_ID} className={styles.card} onClick={() => handleAlbumClick(album)} style={{ cursor: 'pointer' }}>
            <div className={styles.coverWrapper}>
              <img src={album.COVER_URL || album.IMAGE_URL} alt={album.TITLE} className={styles.cover} />
              {album.STATUS === 'WISH' && <div className={styles.wishBadge}>WISH</div>}
            </div>
            <div className={styles.info}>
              <p className={styles.albumTitle}>{album.TITLE}</p>
              <p className={styles.albumArtist}>{album.ARTIST}</p>
            </div>
          </div>
        ))}
      </div>

      {selectedAlbum && <DetailModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />}

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div onClick={() => setShowLoginPrompt(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(8px)'
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#1a1814',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '24px',
            padding: '48px 40px',
            width: '360px',
            textAlign: 'center',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#d4af37', marginBottom: '16px', display: 'block', fontVariationSettings: "'FILL' 1" }}>lock</span>
            <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 12px' }}>로그인이 필요해요</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '0 0 32px' }}>
              LP 상세 정보는 VinylA 회원만 볼 수 있어요.<br />로그인 후 이용해 주세요.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowLoginPrompt(false)} style={{
                flex: 1, padding: '14px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)', fontSize: '15px', cursor: 'pointer'
              }}>취소</button>
              <Link href="/" style={{
                flex: 1, padding: '14px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #d4af37, #f3e5ab)',
                color: '#111', fontSize: '15px', fontWeight: 700,
                textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>로그인</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
