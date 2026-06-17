import React from 'react';
import styles from './DetailModal.module.css';
import { MockVinylData } from '@vinyla/shared-types';

interface DetailModalProps {
  album: MockVinylData;
  onClose: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ album, onClose }) => {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.leftPanel}>
          <div className={styles.coverContainer}>
            <div 
              className={styles.vinyl} 
              style={{ backgroundColor: album.CUSTOM_COLOR_HEX }}
            />
            <div className={styles.cover}>
              <img src={album.IMAGE_URL} alt={album.TITLE} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} />
            </div>
          </div>
        </div>
        <div className={styles.rightPanel}>
          <h2 style={{ fontFamily: 'Bodoni Moda, serif', fontSize: '2.5rem' }}>{album.TITLE}</h2>
          <h3 style={{ color: '#8e9192', fontFamily: 'Hanken Grotesk, sans-serif' }}>{album.ARTIST} • {album.RELEASE_YEAR}</h3>
          
          <ul className={styles.tracklist}>
            {album.TRACKS?.map((track, i) => (
              <li key={i}>{i + 1}. {track}</li>
            ))}
          </ul>
          
          <div className={styles.actions}>
            <button className={styles.btnPrimary}>Add to Collection</button>
            <button className={styles.btnOutline}>WISH</button>
          </div>
          <button className={styles.btnYoutube}>LISTEN ON YOUTUBE</button>
        </div>
      </div>
    </div>
  );
};
