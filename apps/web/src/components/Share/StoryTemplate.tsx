import React, { forwardRef } from 'react';
import styles from './StoryTemplate.module.css';

interface StoryTemplateProps {
  album: any;
  username: string;
}

const STATUS_NEON: Record<string, { label: string; kind: string }> = {
  OWNED: { label: 'COLLECTED', kind: 'owned' },
  WISH: { label: '★ WANTED ★', kind: 'wish' },
  NONE: { label: 'JUST DROPPED', kind: 'none' },
};

export const StoryTemplate = forwardRef<HTMLDivElement, StoryTemplateProps>(({ album, username }, ref) => {
  if (!album) return null;

  const bgStyle = album.CUSTOM_COLOR_HEX
    ? { background: `linear-gradient(135deg, ${album.CUSTOM_COLOR_HEX}40, #111)` }
    : { background: 'linear-gradient(135deg, #2a2a2a, #0a0a0a)' };

  const neon = STATUS_NEON[album.STATUS as string] || STATUS_NEON.NONE;

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
                  <img src={`/api/proxy-image?url=${encodeURIComponent(album.COVER_URL || album.IMAGE_URL)}`} alt="label" crossOrigin="anonymous" />
                </div>
              </div>
              {/* The cover */}
              <img 
                src={`/api/proxy-image?url=${encodeURIComponent(album.COVER_URL || album.IMAGE_URL)}`} 
                alt="cover" 
                className={styles.coverImage}
                crossOrigin="anonymous"
              />
            </div>
          </div>

          <div className={styles.infoBox}>
            <h2 className={styles.title}>{album.TITLE}</h2>
            <p className={styles.artist}>{album.ARTIST}</p>
          </div>
        </div>

        <div className={styles.watermark}>
          <span className={styles.user}>@{username}</span>
          <div className={styles.brandWrapper}>
            <img src="/logo_transparent.png" alt="VinylA Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} onError={(e) => { e.currentTarget.src = '/logo.png'; e.currentTarget.style.mixBlendMode = 'screen'; }} crossOrigin="anonymous" />
            <span className={styles.brand}>Curated by VinylA Collection</span>
          </div>
        </div>
      </div>
    </div>
  );
});

StoryTemplate.displayName = 'StoryTemplate';
