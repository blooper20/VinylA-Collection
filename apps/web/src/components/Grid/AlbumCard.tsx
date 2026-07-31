import React from 'react';
import styles from './AlbumCard.module.css';
import { MockVinylData } from '@vinyla/shared-types';
import { SplatterForm } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import Image from 'next/image';
import { EditionCoverArt, EditionSplatterMarks, editionDiscStyle } from '../Edition/EditionCoverArt';

interface AlbumCardProps {
  album: MockVinylData;
  onClick: (album: MockVinylData) => void;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, onClick }) => {
  const { t } = useLocale();
  return (
    <div className={styles.card} onClick={() => onClick(album)}>
      {/* Vinyl disc behind — 호버하면 커버 뒤에서 밀려 나온다. 에디션 정보가
          있으면 이 판이 실제로 그 실물의 색·무늬를 갖는다(제네릭 검은 판 대신). */}
      <div className={styles.vinylWrapper}>
        <div className={styles.vinyl} style={editionDiscStyle(album, album.IMAGE_URL)}>
          {album.EDITION_STYLE === 'splatter' && (
            <EditionSplatterMarks
              color={album.EDITION_COLOR_ALT ?? null}
              form={(album.EDITION_SPLATTER_FORM as SplatterForm) ?? 'streak'}
            />
          )}
          <div className={styles.vinylLabel}>
            <div className={styles.vinylHole} />
          </div>
        </div>
      </div>

      {/* Album cover */}
      <div className={styles.cover}>
        <Image
          src={album.IMAGE_URL || `https://picsum.photos/seed/${album.ALBUM_ID}/400/400`}
          alt={album.TITLE}
          className={styles.coverImage}
          width={400}
          height={400}
          style={{ objectFit: 'cover' }}
        />
        <EditionCoverArt album={album} size="sm" />
      </div>

      {/* Hover overlay */}
      <div className={styles.overlay} />

      {/* Info */}
      <div className={styles.info}>
        <div className={styles.infoTitle}>{album.TITLE}</div>
        <div className={styles.infoArtist}>{album.ARTIST}</div>
      </div>

      {/* Status badge */}
      <div className={`${styles.badge} ${album.STATUS === 'OWNED' ? styles.badgeOwned : styles.badgeWish}`}>
        {album.STATUS === 'OWNED' ? t('collection.statusOwned') : t('collection.statusWish')}
      </div>

      {/* Edition badge — "앨범 커버에 표시"를 끈 경우의 기본 표기. 켠 경우는
          위 EditionCoverArt가 디스크 칩/하이프 스티커로 대신 보여준다. */}
      {album.EDITION_LABEL && !album.EDITION_ON_COVER && (
        <div className={styles.editionBadge}>
          <span className="material-symbols-outlined">auto_awesome</span>
          {album.EDITION_LABEL}
        </div>
      )}
    </div>
  );
};
