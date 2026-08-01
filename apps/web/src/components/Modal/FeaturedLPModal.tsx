import React, { useState } from 'react';
import styles from './FeaturedLPModal.module.css';
import { MockVinylData } from '@vinyla/shared-types';
import { useLocale } from '@vinyla/i18n';
import { useCoverImageUrl } from '../../hooks/useCoverImageUrl';

interface FeaturedLPModalProps {
  isOpen: boolean;
  onClose: () => void;
  albums: (MockVinylData & { COVER_URL?: string })[];
  currentFeaturedId: number | null;
  onSelect: (albumId: number) => Promise<void>;
}

// 타일마다 훅(useCoverImageUrl)을 걸어야 해서 .map() 콜백 안에 인라인으로
// 두지 않고 따로 뺐다.
const FeaturedLPTileCover: React.FC<{ src?: string; alt?: string }> = ({ src, alt }) => {
  const displayCoverUrl = useCoverImageUrl(src, '/logo_real_transparent.png');
  return <img src={displayCoverUrl} alt={alt} className={styles.cover} />;
};

export function FeaturedLPModal({ isOpen, onClose, albums, currentFeaturedId, onSelect }: FeaturedLPModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const { t } = useLocale();

  if (!isOpen) return null;

  // 대표 LP는 앨범 단위 선택이라 같은 앨범의 여러 에디션(초반/재반 등)이
  // 중복 타일로 뜨는 건 의미가 없다 — ALBUM_ID 기준으로 한 장만 보여준다.
  const uniqueAlbums = Array.from(new Map(albums.map((a) => [a.ALBUM_ID, a])).values());

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
          {uniqueAlbums.length > 0 ? (
            <div className={styles.grid}>
              {uniqueAlbums.map((album) => (
                <div 
                  key={album.ALBUM_ID} 
                  className={`${styles.item} ${currentFeaturedId === album.ALBUM_ID ? styles.itemActive : ''}`}
                  onClick={() => handleSelect(album.ALBUM_ID)}
                >
                  <FeaturedLPTileCover src={album.COVER_URL || album.IMAGE_URL} alt={album.TITLE} />
                  
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
