import React, { forwardRef } from 'react';
import styles from './StoryTemplate.module.css';

interface StoryTemplateProps {
  album: any;
  username: string;
}

export const StoryTemplate = forwardRef<HTMLDivElement, StoryTemplateProps>(({ album, username }, ref) => {
  if (!album) return null;

  const bgStyle = album.CUSTOM_COLOR_HEX 
    ? { background: `linear-gradient(135deg, ${album.CUSTOM_COLOR_HEX}40, #111)` } 
    : { background: 'linear-gradient(135deg, #2a2a2a, #0a0a0a)' };

  return (
    <div className={styles.offscreenContainer}>
      <div ref={ref} className={styles.storyFrame} style={bgStyle}>
        {/* Background Blur Overlay */}
        <div className={styles.glassOverlay} />
        
        <div className={styles.content}>
          <div className={styles.recordWrapper}>
            <div className={styles.recordOuter}>
              {/* The vinyl record sliding out */}
              <div className={styles.vinylDisk} style={{ 
                background: album.CUSTOM_COLOR_HEX ? album.CUSTOM_COLOR_HEX : '#111' 
              }}>
                <div className={styles.vinylGroove} />
                <div className={styles.vinylLabel}>
                  <img src={album.COVER_URL || album.IMAGE_URL} alt="label" />
                </div>
              </div>
              {/* The cover */}
              <img 
                src={album.COVER_URL || album.IMAGE_URL} 
                alt="cover" 
                className={styles.coverImage} 
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
          <span className={styles.brand}>Curated by VinylA</span>
        </div>
      </div>
    </div>
  );
});

StoryTemplate.displayName = 'StoryTemplate';
