import React, { forwardRef } from 'react';
import styles from './ShareableGridTemplate.module.css';
import { MockVinylData } from '@vinyla/shared-types';

interface ShareableGridTemplateProps {
  albums: (MockVinylData & { COVER_URL?: string })[];
  username: string;
  title: string;
}

export const ShareableGridTemplate = forwardRef<HTMLDivElement, ShareableGridTemplateProps>(({ albums, username, title }, ref) => {
  const getOptimalColumns = (count: number) => {
    if (count <= 4) return Math.max(count, 2); // 2~4
    if (count <= 6) return 3;                  // 3x2
    if (count <= 8) return 4;                  // 4x2
    if (count <= 10) return 5;                 // 5x2
    if (count <= 12) return 4;                 // 4x3
    if (count <= 15) return 5;                 // 5x3
    if (count <= 18) return 6;                 // 6x3
    if (count <= 21) return 7;                 // 7x3
    if (count <= 24) return 6;                 // 6x4
    if (count <= 28) return 7;                 // 7x4
    if (count <= 32) return 8;                 // 8x4
    if (count <= 40) return 8;                 // 8x5
    return 10;
  };
  
  const columns = getOptimalColumns(albums.length);

  return (
    <div className={styles.offscreenContainer}>
      <div ref={ref} className={styles.gridFrame}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.subtitle}>@{username}&apos;s Collection</p>
        </div>

        <div className={styles.gridContainer} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {albums.map((album) => {
            const rawImageUrl = album.COVER_URL || album.IMAGE_URL;
            const imageSrc = rawImageUrl ? `/api/proxy-image?url=${encodeURIComponent(rawImageUrl)}` : '/logo.png';
            return (
            <div key={album.ALBUM_ID} className={styles.gridItem}>
              <div className={styles.coverWrapper}>
                <img src={imageSrc} alt={album.TITLE} className={styles.cover} crossOrigin="anonymous" />
              </div>
              <div className={styles.info}>
                <p className={styles.albumTitle}>{album.TITLE}</p>
                <p className={styles.albumArtist}>{album.ARTIST}</p>
              </div>
            </div>
            );
          })}
        </div>

        <div className={styles.footer}>
          <img src="/logo_transparent.png" alt="VinylA Collection Logo" style={{ width: '50px', height: '50px', objectFit: 'contain' }} onError={(e) => { e.currentTarget.src = '/logo.png'; e.currentTarget.style.mixBlendMode = 'screen'; }} crossOrigin="anonymous" />
          <div className={styles.footerText}>
            <span className={styles.brand}>Curated by VinylA Collection</span>
            <span className={styles.url}>vinyla.vercel.app</span>
          </div>
        </div>
      </div>
    </div>
  );
});

ShareableGridTemplate.displayName = 'ShareableGridTemplate';
