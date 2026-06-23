import React from 'react';
import styles from './AlbumCard.module.css';
import { MockVinylData } from '@vinyla/shared-types';

interface AlbumCardProps {
  album: MockVinylData;
  onClick: (album: MockVinylData) => void;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, onClick }) => {
  return (
    <div className={styles.card} onClick={() => onClick(album)}>
      {/* Vinyl disc behind */}
      <div className={styles.vinyl}>
        <div className={styles.vinylLabel}>
          <div className={styles.vinylHole} />
        </div>
      </div>

      {/* Album cover */}
      <div className={styles.cover}>
        <img
          src={album.IMAGE_URL || `https://picsum.photos/seed/${album.ALBUM_ID}/400/400`}
          alt={album.TITLE}
          className={styles.coverImage}
          loading="lazy"
        />
      </div>

      {/* Hover overlay */}
      <div className={styles.overlay} />

      {/* Info */}
      <div className={styles.info}>
        <div className={styles.infoTitle}>{album.TITLE}</div>
        <div className={styles.infoArtist}>{album.ARTIST}</div>
      </div>

      {/* Status badge */}
      <div className={`${styles.badge} ${album.STATUS === 'OWNED' ? styles.badgeOwned : styles.badgeWish}`}>
        {album.STATUS === 'OWNED' ? '보유' : '위시'}
      </div>
    </div>
  );
};
