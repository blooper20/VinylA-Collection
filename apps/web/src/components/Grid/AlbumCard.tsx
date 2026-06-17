import React from 'react';
import styles from './AlbumCard.module.css';
import { MockVinylData } from '@vinyla/shared-types';
import Image from 'next/image';

interface AlbumCardProps {
  album: MockVinylData;
  onClick: (album: MockVinylData) => void;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, onClick }) => {
  return (
    <div className={styles.card} onClick={() => onClick(album)}>
      <div 
        className={styles.vinyl} 
        style={{ backgroundColor: album.CUSTOM_COLOR_HEX }}
      >
        <div className={styles.label} />
      </div>
      <div className={styles.cover}>
        <img src={album.IMAGE_URL} alt={album.TITLE} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
      </div>
    </div>
  );
};
