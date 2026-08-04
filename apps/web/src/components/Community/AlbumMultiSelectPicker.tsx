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

interface PickedAlbumWithStatus extends PickedAlbum {
  STATUS: 'OWNED' | 'WISH';
}

// 오늘 온 전리품 게시글에 "본인 컬렉션/위시리스트에서 다중 선택"으로 앨범을
// 첨부하는 피커. 이 앱에 기존 "내 컬렉션에서 검색+다중선택" 컴포넌트가 없어
// 새로 만들었다 — getUserVinyls(전체 로드)를 재사용하고 검색은 로컬
// 필터링으로 처리한다(컬렉션 규모가 크지 않은 개인 보관함 특성상 충분히
// 빠르다). 보유/위시는 하나로 섞지 않고 별도 그리드 섹션으로 나눠 보여준다 —
// 어느 쪽에서 고른 앨범인지 헷갈리지 않도록.
export const AlbumMultiSelectPicker: React.FC<{
  value: PickedAlbum[];
  onChange: (next: PickedAlbum[]) => void;
  /** 'owned'=컬렉션 카테고리(보유만), 'wish'=위시리스트 카테고리(위시만), 'both'=오온음(기본, 둘 다) */
  source?: 'owned' | 'wish' | 'both';
}> = ({ value, onChange, source = 'both' }) => {
  const { t } = useLocale();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [ownedAlbums, setOwnedAlbums] = React.useState<PickedAlbumWithStatus[]>([]);
  const [wishAlbums, setWishAlbums] = React.useState<PickedAlbumWithStatus[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen || !user?.id || hasLoaded) return;
    setIsLoading(true);
    getUserVinyls(user.id)
      .then((rows: any[]) => {
        const mapped: PickedAlbumWithStatus[] = rows
          .filter((r) => r.ALBUM_MASTER && (r.STATUS === 'OWNED' || r.STATUS === 'WISH'))
          .map((r) => ({
            ALBUM_ID: r.ALBUM_MASTER.ALBUM_ID,
            TITLE: r.ALBUM_MASTER.TITLE,
            ARTIST: r.ALBUM_MASTER.ARTIST,
            IMAGE_URL: r.ALBUM_MASTER.IMAGE_URL || null,
            STATUS: r.STATUS,
          }));
        // 같은 앨범을 여러 장 보유했을 수 있으므로 상태별로 ALBUM_ID 중복 제거
        const dedupe = (status: 'OWNED' | 'WISH') => {
          const seen = new Set<number>();
          return mapped.filter((a) => a.STATUS === status && (seen.has(a.ALBUM_ID) ? false : (seen.add(a.ALBUM_ID), true)));
        };
        setOwnedAlbums(dedupe('OWNED'));
        setWishAlbums(dedupe('WISH'));
        setHasLoaded(true);
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, user?.id, hasLoaded]);

  const filterByQuery = (list: PickedAlbumWithStatus[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) => a.TITLE.toLowerCase().includes(q) || a.ARTIST.toLowerCase().includes(q));
  };

  const filteredOwned = React.useMemo(
    () => (source === 'wish' ? [] : filterByQuery(ownedAlbums)),
    [ownedAlbums, query, source]
  );
  const filteredWish = React.useMemo(
    () => (source === 'owned' ? [] : filterByQuery(wishAlbums)),
    [wishAlbums, query, source]
  );

  const isSelected = (albumId: number) => value.some((v) => v.ALBUM_ID === albumId);
  const toggle = (album: PickedAlbum) => {
    onChange(isSelected(album.ALBUM_ID) ? value.filter((v) => v.ALBUM_ID !== album.ALBUM_ID) : [...value, album]);
  };

  // 검색으로 걸러진 목록 기준 전체 선택/해제 — 검색어를 지우면 다시 전체
  // 목록 기준으로 판정되니 "전체"의 의미가 항상 "지금 보이는 목록"과 일치한다.
  const isAllSelected = (list: PickedAlbumWithStatus[]) => list.length > 0 && list.every((a) => isSelected(a.ALBUM_ID));
  const toggleSelectAll = (list: PickedAlbumWithStatus[]) => {
    if (isAllSelected(list)) {
      const ids = new Set(list.map((a) => a.ALBUM_ID));
      onChange(value.filter((v) => !ids.has(v.ALBUM_ID)));
    } else {
      const toAdd = list.filter((a) => !isSelected(a.ALBUM_ID));
      onChange([...value, ...toAdd]);
    }
  };

  const renderGrid = (list: PickedAlbumWithStatus[]) => (
    <div className={styles.pickGrid}>
      {list.map((a) => (
        <button
          key={a.ALBUM_ID}
          type="button"
          className={styles.pickItem}
          onClick={() => toggle(a)}
        >
          <div className={styles.pickCoverWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.IMAGE_URL || ''} alt="" className={styles.pickCover} />
            <span className={`material-symbols-outlined ${styles.pickCheck} ${isSelected(a.ALBUM_ID) ? styles.pickCheckOn : ''}`}>
              {isSelected(a.ALBUM_ID) ? 'check_circle' : 'radio_button_unchecked'}
            </span>
          </div>
          <span className={styles.pickTitle}>{a.TITLE}</span>
          <span className={styles.pickArtist}>{a.ARTIST}</span>
        </button>
      ))}
    </div>
  );

  const renderSectionHeader = (titleKey: string, list: PickedAlbumWithStatus[]) => (
    <div className={styles.sectionHeader}>
      <h4 className={styles.sectionTitle}>{t(titleKey as any)}</h4>
      <button type="button" className={styles.selectAllBtn} onClick={() => toggleSelectAll(list)}>
        {isAllSelected(list) ? t('communityBoard.albumPickerDeselectAll') : t('communityBoard.albumPickerSelectAll')}
      </button>
    </div>
  );

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
          {!isLoading && filteredOwned.length === 0 && filteredWish.length === 0 && (
            <p className={styles.status}>{t('communityBoard.albumPickerEmpty')}</p>
          )}
          <div className={styles.sections}>
            {filteredOwned.length > 0 && (
              <div className={styles.section}>
                {renderSectionHeader('communityBoard.albumPickerSectionOwned', filteredOwned)}
                {renderGrid(filteredOwned)}
              </div>
            )}
            {filteredWish.length > 0 && (
              <div className={styles.section}>
                {renderSectionHeader('communityBoard.albumPickerSectionWish', filteredWish)}
                {renderGrid(filteredWish)}
              </div>
            )}
          </div>
          <button type="button" className={styles.doneBtn} onClick={() => setIsOpen(false)}>
            {t('communityBoard.albumPickerDone')}
          </button>
        </div>
      )}
    </div>
  );
};
