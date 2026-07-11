import React, { forwardRef } from 'react';
import styles from './StoryTemplate.module.css';
import { MockVinylData } from '@vinyla/shared-types';

interface StoryTemplateProps {
  album: MockVinylData & { COVER_URL?: string };
  username: string;
  overrideStatus?: 'OWNED' | 'WISH' | 'NONE' | 'NEW';
}

const STATUS_NEON: Record<string, { label: string; kind: string }> = {
  OWNED: { label: 'COLLECTED', kind: 'owned' },
  WISH: { label: '★ WANTED ★', kind: 'wish' },
  NONE: { label: 'JUST DROPPED', kind: 'none' },
  NEW: { label: 'NEW', kind: 'new' },
};

export const StoryTemplate = forwardRef<HTMLDivElement, StoryTemplateProps>(({ album, username, overrideStatus }, ref) => {
  if (!album) return null;

  const bgStyle = album.CUSTOM_COLOR_HEX
    ? { background: `linear-gradient(135deg, ${album.CUSTOM_COLOR_HEX}40, #111)` }
    : { background: 'linear-gradient(135deg, #2a2a2a, #0a0a0a)' };

  const neon = STATUS_NEON[overrideStatus || album.STATUS as string] || STATUS_NEON.NONE;

  const rawImageUrl = album.COVER_URL || album.IMAGE_URL;
  // A local asset needs no CORS proxying, and proxying an empty string would
  // fire a useless /api/proxy-image?url= request.
  const imageSrc = rawImageUrl ? `/api/proxy-image?url=${encodeURIComponent(rawImageUrl)}` : '/logo.png';

  return (
    <div className={styles.offscreenContainer}>
      <div ref={ref} className={styles.storyFrame} style={bgStyle}>
        {/* Background Blur Overlay */}
        <div className={styles.glassOverlay} />

        <div className={styles.statusNeon} data-status={neon.kind}>
          <span className={styles.statusNeonText}>{neon.label}</span>
        </div>
        
        <div className={styles.content}>
          <div className={styles.recordWrapper}>
            <div className={styles.recordOuter}>
              {/* The vinyl record sliding out */}
              <div className={styles.vinylDisk} style={{ 
                background: album.CUSTOM_COLOR_HEX ? album.CUSTOM_COLOR_HEX : '#111' 
              }}>
                <div className={styles.vinylGroove} />
                <div className={styles.vinylLabel}>
                  <img src={imageSrc} alt="label" crossOrigin="anonymous" />
                </div>
              </div>
              {/* The cover */}
              <img
                src={imageSrc}
                alt="cover"
                className={styles.coverImage}
                crossOrigin="anonymous"
              />
            </div>
          </div>

          <div className={styles.infoBox}>
            <h2 
              className={styles.title} 
              style={{ fontSize: album.TITLE.length > 20 ? '42px' : album.TITLE.length > 11 ? '52px' : '64px' }}
            >
              {album.TITLE}
            </h2>
            <p 
              className={styles.artist}
              style={{ fontSize: album.ARTIST.length > 20 ? '28px' : '36px' }}
            >
              {album.ARTIST}
            </p>
          </div>
        </div>

        <div className={styles.watermark}>
          <span className={styles.user}>@{username}</span>
          <div className={styles.brandWrapper}>
            <img src="/logo_transparent.png" alt="VinylA Collection Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} onError={(e) => { e.currentTarget.src = '/logo.png'; e.currentTarget.style.mixBlendMode = 'screen'; }} crossOrigin="anonymous" />
            <span className={styles.brand}>Curated by VinylA Collection</span>
          </div>
          <span className={styles.url}>vinyla.vercel.app</span>
        </div>
      </div>
    </div>
  );
});

StoryTemplate.displayName = 'StoryTemplate';
