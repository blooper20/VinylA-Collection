import React, { forwardRef } from 'react';
import styles from './ShareableGridTemplate.module.css';

interface ShareableGridTemplateProps {
  albums: any[];
  username: string;
  title: string;
}

export const ShareableGridTemplate = forwardRef<HTMLDivElement, ShareableGridTemplateProps>(({ albums, username, title }, ref) => {
  return (
    <div className={styles.offscreenContainer}>
      <div ref={ref} className={styles.gridFrame}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.subtitle}>@{username}'s Collection</p>
        </div>

        <div className={styles.gridContainer}>
          {albums.map((album) => (
            <div key={album.ALBUM_ID} className={styles.gridItem}>
              <img src={album.COVER_URL || album.IMAGE_URL} alt={album.TITLE} className={styles.cover} />
              <div className={styles.info}>
                <p className={styles.albumTitle}>{album.TITLE}</p>
                <p className={styles.albumArtist}>{album.ARTIST}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <span className={styles.brand}>Curated by VinylA</span>
        </div>
      </div>
    </div>
  );
});

ShareableGridTemplate.displayName = 'ShareableGridTemplate';
