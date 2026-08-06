'use client';

import React from 'react';
import { searchAppleMusicSongs, createCommunityAlbum, useAuthStore, AppleMusicSongSearchResult } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
// 시각적으로 AlbumMultiSelectPicker와 동일한 카드/그리드 레이아웃을 쓰므로
// 별도 CSS 파일을 만들지 않고 그 모듈을 그대로 재사용한다.
import styles from './AlbumMultiSelectPicker.module.css';

export interface PickedSong {
  ALBUM_ID: number;
  TITLE: string;
  ARTIST: string;
  IMAGE_URL: string | null;
}

// "오노추(오늘의 노래 추천)" 전용 다중 선택 피커 — AlbumMultiSelectPicker는
// 내 컬렉션(보유/위시)에서 고르지만, 이건 애플뮤직 전체 카탈로그를 검색해
// 고른다. 검색 결과를 고르는 즉시 커뮤니티 등록 앨범(createCommunityAlbum,
// SOURCE=APPLE_MUSIC)으로 만들어 실제 ALBUM_ID를 확보한다 — 그래야 제출
// 시점엔 이미 다른 카테고리와 동일한 albumIds 배열로 다룰 수 있다(같은
// 애플뮤직 collectionId는 DB 유니크 인덱스로 자동 중복 방지·재사용됨).
export const SongMultiSelectPicker: React.FC<{
  value: PickedSong[];
  onChange: (next: PickedSong[]) => void;
}> = ({ value, onChange }) => {
  const { t } = useLocale();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<AppleMusicSongSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [resolvingTrackIds, setResolvingTrackIds] = React.useState<Set<number>>(new Set());
  // 같은 검색 세션에서 이미 고른 트랙을 다시 누르면 해제되도록 trackId→ALBUM_ID 매핑을 기억한다.
  const [pickedTrackIds, setPickedTrackIds] = React.useState<Record<number, number>>({});

  React.useEffect(() => {
    if (!isOpen) return;
    const term = query.trim();
    const timeout = setTimeout(() => {
      if (!term) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      searchAppleMusicSongs(term)
        .then(setResults)
        .finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, isOpen]);

  const toggle = async (song: AppleMusicSongSearchResult) => {
    const existingAlbumId = pickedTrackIds[song.trackId];
    if (existingAlbumId !== undefined) {
      onChange(value.filter((v) => v.ALBUM_ID !== existingAlbumId));
      setPickedTrackIds((prev) => {
        const next = { ...prev };
        delete next[song.trackId];
        return next;
      });
      return;
    }
    if (!user?.id || resolvingTrackIds.has(song.trackId)) return;
    setResolvingTrackIds((prev) => new Set(prev).add(song.trackId));
    try {
      const { albumId } = await createCommunityAlbum(user.id, {
        title: song.trackName,
        artist: song.artistName,
        releaseYear: song.releaseYear ?? null,
        imageUrl: song.artworkUrl || null,
        tracks: [{ side: 'A', title: song.trackName }],
        source: 'APPLE_MUSIC',
        appleCollectionId: song.collectionId,
      });
      setPickedTrackIds((prev) => ({ ...prev, [song.trackId]: albumId }));
      onChange([
        ...value,
        { ALBUM_ID: albumId, TITLE: song.trackName, ARTIST: song.artistName, IMAGE_URL: song.artworkUrl || null },
      ]);
    } catch {
      // 등록 실패는 조용히 무시 — 다른 곡 선택은 계속 가능해야 한다.
    } finally {
      setResolvingTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(song.trackId);
        return next;
      });
    }
  };

  const removeSelected = (albumId: number) => {
    onChange(value.filter((v) => v.ALBUM_ID !== albumId));
    setPickedTrackIds((prev) => {
      const next = { ...prev };
      for (const trackId of Object.keys(next)) {
        if (next[Number(trackId)] === albumId) delete next[Number(trackId)];
      }
      return next;
    });
  };

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.openBtn} onClick={() => setIsOpen((v) => !v)}>
        {t('communityBoard.songPickerCta')}
        {value.length > 0 && (
          <span className={styles.countBadge}>{t('communityBoard.songPickerSelectedCount', { count: value.length })}</span>
        )}
      </button>

      {value.length > 0 && (
        <div className={styles.selectedGrid}>
          {value.map((s) => (
            <div key={s.ALBUM_ID} className={styles.selectedThumb}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.IMAGE_URL || ''} alt="" className={styles.selectedImg} />
              <button type="button" className={styles.removeBtn} onClick={() => removeSelected(s.ALBUM_ID)} aria-label="remove">×</button>
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
            placeholder={t('communityBoard.songPickerSearchPlaceholder')}
            className={styles.searchInput}
          />
          <div className={styles.sections}>
            {isSearching && <p className={styles.status}>{t('communityBoard.songPickerSearching')}</p>}
            {!isSearching && query.trim() && results.length === 0 && (
              <p className={styles.status}>{t('communityBoard.songPickerEmpty')}</p>
            )}
            <div className={styles.pickGrid}>
              {results.map((song) => {
                const isPicked = song.trackId in pickedTrackIds;
                const isResolving = resolvingTrackIds.has(song.trackId);
                return (
                  <button
                    key={song.trackId}
                    type="button"
                    className={styles.pickItem}
                    onClick={() => toggle(song)}
                    disabled={isResolving}
                    style={isResolving ? { opacity: 0.5 } : undefined}
                  >
                    <div className={styles.pickCoverWrap}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={song.artworkUrl || ''} alt="" className={styles.pickCover} />
                      <span className={`material-symbols-outlined ${styles.pickCheck} ${isPicked ? styles.pickCheckOn : ''}`}>
                        {isPicked ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                    </div>
                    <span className={styles.pickTitle}>{song.trackName}</span>
                    <span className={styles.pickArtist}>{song.artistName}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <button type="button" className={styles.doneBtn} onClick={() => setIsOpen(false)}>
            {t('communityBoard.songPickerDone')}
          </button>
        </div>
      )}
    </div>
  );
};
