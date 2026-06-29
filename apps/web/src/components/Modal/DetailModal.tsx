import React from 'react';
import styles from './DetailModal.module.css';
import { MockVinylData } from '@vinyla/shared-types';
import { searchYouTube, searchDiscogs, getAlbumMaster, createAlbumMaster, upsertUserVinyl, useAuthStore, getAlbumExtraDetails } from '@vinyla/core-api';

interface DetailModalProps {
  album: MockVinylData;
  onClose: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({ album, onClose }) => {
  const { user } = useAuthStore();
  const [tracks, setTracks] = React.useState<string[]>(album.TRACKS || []);
  const [notes, setNotes] = React.useState<string>('');
  const [copyright, setCopyright] = React.useState<string>('');
  const [releaseDate, setReleaseDate] = React.useState<string>('');

  React.useEffect(() => {
    getAlbumExtraDetails(album.ALBUM_ID, album.ARTIST, album.TITLE).then(details => {
      if (details.tracks.length > 0 && (!album.TRACKS || album.TRACKS.length === 0)) {
        setTracks(details.tracks);
      }
      if (details.notes) setNotes(details.notes);
      if (details.copyright) setCopyright(details.copyright);
      if (details.releaseDate) setReleaseDate(details.releaseDate);
    });
  }, [album.ALBUM_ID, album.ARTIST, album.TITLE, album.TRACKS]);

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

  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = async (status: 'OWNED' | 'WISH') => {
    try {
      let master = await getAlbumMaster(album.ALBUM_ID);
      if (!master) {
        await createAlbumMaster({
          ALBUM_ID: album.ALBUM_ID,
          TITLE: album.TITLE,
          ARTIST: album.ARTIST,
          RELEASE_YEAR: album.RELEASE_YEAR,
          IMAGE_URL: album.IMAGE_URL,
          VINYL_IMAGE_URL: album.VINYL_IMAGE_URL || '',
          CUSTOM_COLOR_HEX: album.CUSTOM_COLOR_HEX || '#000',
          CUSTOM_STYLE_TYPE: 'SOLID',
          TRACKS: album.TRACKS || []
        });
      }

      await upsertUserVinyl({
        USER_ID: user?.id || 1,
        ALBUM_ID: album.ALBUM_ID,
        STATUS: status,
        PURCHASE_DATE: new Date().toISOString(),
        PURCHASE_PRICE: 0
      });

      setIsSaving(true);
      // Let animation play for 600ms
      setTimeout(() => {
        onClose();
        // Dispatch custom event for Toast
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', {
          detail: { message: `성공적으로 ${status === 'OWNED' ? '보관함' : '위시리스트'}에 추가되었습니다!` }
        }));
      }, 600);
    } catch (error) {
      console.error('Failed to save album:', error);
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', {
        detail: { message: '추가에 실패했습니다. 다시 시도해주세요.' }
      }));
    }
  };

  return (
    <div className={`${styles.overlay} ${isSaving ? styles.overlaySavedAnim : ''}`} onClick={onClose}>
      <div className={`${styles.modal} ${isSaving ? styles.modalSavedAnim : ''}`} onClick={(e) => e.stopPropagation()}>
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
            <div className={styles.eyebrow}>{album.RELEASE_YEAR || 'Unknown Year'} • LP</div>
            <h2 className={styles.title}>{album.TITLE}</h2>
            <h3 className={styles.artist}>{album.ARTIST}</h3>

            {album.GENRES && album.GENRES.length > 0 && (
              <div className={styles.tagsContainer}>
                {album.GENRES.slice(0, 4).map((tag, i) => (
                  <span key={i} className={styles.tagLabel}>{tag}</span>
                ))}
              </div>
            )}
          </div>
          
          <div className={styles.tracklistContainer}>
            <div className={styles.tracklistHeader}>Tracklist</div>
            <ul className={styles.tracklist}>
              {tracks.length > 0 ? tracks.map((track, i) => (
                <li key={i}>
                  <span className={styles.trackNum}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={styles.trackName}>{track}</span>
                </li>
              )) : (
                <li className={styles.emptyTrack}>No tracklist available</li>
              )}
            </ul>
            {(releaseDate || copyright || notes) && (
              <div className={styles.extraDetails}>
                {releaseDate && <div className={styles.detailItem}><span className={styles.detailLabel}>발매일:</span> {releaseDate}</div>}
                {copyright && <div className={styles.detailItem}><span className={styles.detailLabel}>소속사:</span> {copyright}</div>}
                {notes && <div className={styles.detailNotes}>{notes}</div>}
              </div>
            )}
          </div>
          
          <div className={styles.actions}>
            <button className={styles.btnPrimary} onClick={() => handleSave('OWNED')}>
              <span className="material-symbols-outlined">add</span>
              보관함 추가
            </button>
            <button className={styles.btnSecondary} onClick={() => handleSave('WISH')}>
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
