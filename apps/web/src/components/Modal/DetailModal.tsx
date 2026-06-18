import React from 'react';
import styles from './DetailModal.module.css';
import { MockVinylData } from '@vinyla/shared-types';
import { searchYouTube, searchDiscogs } from '@vinyla/core-api';

interface DetailModalProps {
  album: MockVinylData;
  onClose: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ album, onClose }) => {
  const handleYoutubeListen = async () => {
    const query = `${album.ARTIST} ${album.TITLE} full album`;
    const results = await searchYouTube(query);
    if (results && results.length > 0) {
      const videoId = results[0].id?.videoId;
      if (videoId) {
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
        return;
      }
    }
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
  };

  const handleDiscogsSearch = async () => {
    const query = `${album.ARTIST} ${album.TITLE}`;
    const results = await searchDiscogs(query);
    if (results && results.length > 0) {
      const uri = results[0].uri;
      if (uri) {
        window.open(`https://www.discogs.com${uri}`, '_blank');
        return;
      }
    }
    window.open(`https://www.discogs.com/search/?q=${encodeURIComponent(query)}`, '_blank');
  };

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
          <button className={styles.btnYoutube} onClick={handleYoutubeListen}>LISTEN ON YOUTUBE</button>
          <button className={styles.btnYoutube} style={{ backgroundColor: '#333', marginTop: '10px' }} onClick={handleDiscogsSearch}>SEARCH ON DISCOGS</button>
        </div>
      </div>
    </div>
  );
};

