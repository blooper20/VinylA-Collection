import React, { useState } from 'react';
import styles from './FeaturedLPModal.module.css';
import { MockVinylData } from '@vinyla/shared-types';
import { useLocale } from '@vinyla/i18n';

interface FeaturedLPModalProps {
  isOpen: boolean;
  onClose: () => void;
  albums: (MockVinylData & { COVER_URL?: string })[];
  currentFeaturedId: number | null;
  onSelect: (albumId: number) => Promise<void>;
}

export function FeaturedLPModal({ isOpen, onClose, albums, currentFeaturedId, onSelect }: FeaturedLPModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useLocale();

  if (!isOpen) return null;

  const handleSelect = async (albumId: number) => {
    setIsSaving(true);
    try {
      await onSelect(albumId);
      onClose();
    } catch {
      alert(t('featuredLp.setFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('featuredLp.title')}</h2>
          <button className={styles.closeBtn} onClick={onClose} disabled={isSaving}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className={styles.content}>
          {albums.length > 0 ? (
            <div className={styles.grid}>
              {albums.map((album) => (
                <div 
                  key={album.ALBUM_ID} 
                  className={`${styles.item} ${currentFeaturedId === album.ALBUM_ID ? styles.itemActive : ''}`}
                  onClick={() => handleSelect(album.ALBUM_ID)}
                >
                  <img src={album.COVER_URL || album.IMAGE_URL} alt={album.TITLE} className={styles.cover} />
                  
                  {/* Status Badge */}
                  <div className={`${styles.statusBadge} ${album.STATUS === 'OWNED' ? styles.statusOwned : styles.statusWish}`}>
                    {album.STATUS === 'OWNED' ? t('featuredLp.statusOwned') : t('featuredLp.statusWish')}
                  </div>

                  <div className={styles.itemInfo}>
                    <div className={styles.itemTitle}>{album.TITLE}</div>
                    <div className={styles.itemArtist}>{album.ARTIST}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              {t('featuredLp.empty')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
