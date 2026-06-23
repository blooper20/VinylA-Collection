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
        <button className={styles.closeBtn} onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className={styles.leftPanel}>
          <div className={styles.coverContainer}>
            <div className={styles.vinyl}>
              <div 
                className={styles.vinylLabel} 
                style={{ backgroundImage: `url(${album.IMAGE_URL})` }} 
              />
            </div>
            <div className={styles.cover}>
              <img src={album.IMAGE_URL} alt={album.TITLE} className={styles.coverImage} />
            </div>
          </div>
        </div>
        
        <div className={styles.rightPanel}>
          <div className={styles.headerInfo}>
            <div className={styles.eyebrow}>{album.RELEASE_YEAR} • {album.GENRES?.join(', ') || 'LP'}</div>
            <h2 className={styles.title}>{album.TITLE}</h2>
            <h3 className={styles.artist}>{album.ARTIST}</h3>
          </div>
          
          <div className={styles.tracklistContainer}>
            <div className={styles.tracklistHeader}>Tracklist</div>
            <ul className={styles.tracklist}>
              {album.TRACKS ? album.TRACKS.map((track, i) => (
                <li key={i}>
                  <span className={styles.trackNum}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={styles.trackName}>{track}</span>
                </li>
              )) : (
                <li className={styles.emptyTrack}>No tracklist available</li>
              )}
            </ul>
          </div>
          
          <div className={styles.actions}>
            <button className={styles.btnPrimary}>
              <span className="material-symbols-outlined">add</span>
              보관함 추가
            </button>
            <button className={styles.btnSecondary}>
              <span className="material-symbols-outlined">bookmark_add</span>
              위시
            </button>
          </div>

          <div className={styles.externalLinks}>
            <button className={styles.linkBtn} onClick={handleYoutubeListen}>
              <span className="material-symbols-outlined">play_circle</span>
              Listen on YouTube
            </button>
            <button className={styles.linkBtn} onClick={handleDiscogsSearch}>
              <span className="material-symbols-outlined">album</span>
              Search on Discogs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
