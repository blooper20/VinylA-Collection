'use client';

import React from 'react';
import { getUserVinyls, useAuthStore } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import styles from './AlbumMultiSelectPicker.module.css';

export interface PickedAlbum {
  ALBUM_ID: number;
  TITLE: string;
  ARTIST: string;
  IMAGE_URL: string | null;
}

// 오늘 온 전리품 게시글에 "본인 컬렉션에서 다중 선택"으로 앨범을 첨부하는
// 피커. 이 앱에 기존 "내 컬렉션에서 검색+다중선택" 컴포넌트가 없어 새로
// 만들었다 — getUserVinyls(전체 로드)를 재사용하고 검색은 로컬 필터링으로
// 처리한다(컬렉션 규모가 크지 않은 개인 보관함 특성상 충분히 빠르다).
export const AlbumMultiSelectPicker: React.FC<{
  value: PickedAlbum[];
  onChange: (next: PickedAlbum[]) => void;
}> = ({ value, onChange }) => {
  const { t } = useLocale();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [allAlbums, setAllAlbums] = React.useState<PickedAlbum[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen || !user?.id || allAlbums.length > 0) return;
    setIsLoading(true);
    getUserVinyls(user.id)
      .then((rows: any[]) => {
        const albums: PickedAlbum[] = rows
          .filter((r) => r.ALBUM_MASTER)
          .map((r) => ({
            ALBUM_ID: r.ALBUM_MASTER.ALBUM_ID,
            TITLE: r.ALBUM_MASTER.TITLE,
            ARTIST: r.ALBUM_MASTER.ARTIST,
            IMAGE_URL: r.ALBUM_MASTER.IMAGE_URL || null,
          }));
        // 같은 앨범을 여러 장 보유했을 수 있으므로 ALBUM_ID로 중복 제거
        const seen = new Set<number>();
        setAllAlbums(albums.filter((a) => (seen.has(a.ALBUM_ID) ? false : (seen.add(a.ALBUM_ID), true))));
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, user?.id, allAlbums.length]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allAlbums;
    return allAlbums.filter(
      (a) => a.TITLE.toLowerCase().includes(q) || a.ARTIST.toLowerCase().includes(q)
    );
  }, [allAlbums, query]);

  const isSelected = (albumId: number) => value.some((v) => v.ALBUM_ID === albumId);
  const toggle = (album: PickedAlbum) => {
    onChange(isSelected(album.ALBUM_ID) ? value.filter((v) => v.ALBUM_ID !== album.ALBUM_ID) : [...value, album]);
  };

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.openBtn} onClick={() => setIsOpen((v) => !v)}>
        {t('communityBoard.albumPickerCta')}
        {value.length > 0 && (
          <span className={styles.countBadge}>{t('communityBoard.albumPickerSelectedCount', { count: value.length })}</span>
        )}
      </button>

      {value.length > 0 && (
        <div className={styles.selectedGrid}>
          {value.map((a) => (
            <div key={a.ALBUM_ID} className={styles.selectedThumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.IMAGE_URL || ''} alt="" className={styles.selectedImg} />
              <button type="button" className={styles.removeBtn} onClick={() => toggle(a)} aria-label="remove">×</button>
            </div>
          ))}
        </div>
      )}

      {isOpen && (
        <div className={styles.panel}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('communityBoard.albumPickerSearchPlaceholder')}
            className={styles.searchInput}
          />
          {isLoading && <p className={styles.status}>{t('communityBoard.loading')}</p>}
          {!isLoading && filtered.length === 0 && <p className={styles.status}>{t('communityBoard.albumPickerEmpty')}</p>}
          <div className={styles.list}>
            {filtered.map((a) => (
              <button
                key={a.ALBUM_ID}
                type="button"
                className={`${styles.row} ${isSelected(a.ALBUM_ID) ? styles.rowSelected : ''}`}
                onClick={() => toggle(a)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.IMAGE_URL || ''} alt="" className={styles.rowImg} />
                <span className={styles.rowText}>
                  <span className={styles.rowTitle}>{a.TITLE}</span>
                  <span className={styles.rowArtist}>{a.ARTIST}</span>
                </span>
                <span className={`material-symbols-outlined ${styles.rowCheck}`}>
                  {isSelected(a.ALBUM_ID) ? 'check_circle' : 'radio_button_unchecked'}
                </span>
              </button>
            ))}
          </div>
          <button type="button" className={styles.doneBtn} onClick={() => setIsOpen(false)}>
            {t('communityBoard.albumPickerDone')}
          </button>
        </div>
      )}
    </div>
  );
};
