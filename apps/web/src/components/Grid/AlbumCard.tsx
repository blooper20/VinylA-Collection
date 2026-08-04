import React from 'react';
import styles from './AlbumCard.module.css';
import { MockVinylData } from '@vinyla/shared-types';
import { SplatterForm } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import Image from 'next/image';
import { EditionCoverArt, EditionSplatterMarks, EditionMarbleOverlay, editionDiscStyle } from '../Edition/EditionCoverArt';
import { useCoverImageUrl } from '../../hooks/useCoverImageUrl';

interface AlbumCardProps {
  album: MockVinylData;
  onClick: (album: MockVinylData) => void;
  /** 컬렉션 자랑 게시글용 다중 선택 모드 — true면 클릭이 상세 열람 대신 선택 토글로 동작한다 */
  selectable?: boolean;
  selected?: boolean;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, onClick, selectable, selected }) => {
  const { t } = useLocale();
  // 외부 커버 소스가 순간 실패해도 깨진 이미지 아이콘 대신 프록시 재시도 후
  // 기존 컨벤션과 동일한 picsum 플레이스홀더로 대체한다.
  const coverFallbackUrl = `https://picsum.photos/seed/${album.ALBUM_ID}/400/400`;
  const displayCoverUrl = useCoverImageUrl(album.IMAGE_URL, coverFallbackUrl);
  // useCoverImageUrl의 브라우저 사전 확인(new Image())과 실제 렌더링에 쓰는
  // next/image는 서로 별개의 요청이다 — Vercel 이미지 최적화 서버가 그
  // URL을 "따로" 다시 가져오다 실패하면(문의 #22) 사전 확인이 성공했어도
  // onError 없이는 깨진 이미지 아이콘이 그대로 뜬다. 렌더 시점 실패도 잡는다.
  const [coverRenderFailed, setCoverRenderFailed] = React.useState(false);
  React.useEffect(() => { setCoverRenderFailed(false); }, [displayCoverUrl]);
  return (
    <div className={`${styles.card} ${selectable && selected ? styles.cardSelected : ''}`} onClick={() => onClick(album)}>
      {/* Vinyl disc behind — 호버하면 커버 뒤에서 밀려 나온다. 에디션 정보가
          있으면 이 판이 실제로 그 실물의 색·무늬를 갖는다(제네릭 검은 판 대신). */}
      <div className={styles.vinylWrapper}>
        <div className={styles.vinyl} style={editionDiscStyle(album, displayCoverUrl)}>
          {album.EDITION_STYLE === 'splatter' && (
            <EditionSplatterMarks
              color={album.EDITION_COLOR_ALT ?? null}
              form={(album.EDITION_SPLATTER_FORM as SplatterForm) ?? 'streak'}
            />
          )}
          {album.EDITION_STYLE === 'marbled' && (
            <EditionMarbleOverlay
              color={album.EDITION_COLOR ?? '#ffffff'}
              altColor={album.EDITION_COLOR_ALT ?? null}
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
          src={coverRenderFailed ? coverFallbackUrl : displayCoverUrl}
          alt={album.TITLE}
          className={styles.coverImage}
          width={400}
          height={400}
          style={{ objectFit: 'cover' }}
          onError={() => setCoverRenderFailed(true)}
          // picsum 플레이스홀더는 앨범마다 고유 URL이라 Vercel 이미지 최적화
          // 쿼터(문의 없이도 계속 소모됨)만 갉아먹는다 — 실제 커버만 최적화한다.
          unoptimized={coverRenderFailed || displayCoverUrl === coverFallbackUrl}
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

      {/* 컬렉션 자랑 다중 선택 체크박스 — 상시 노출(hover 의존 X), 다른
          뱃지들과 겹치지 않는 우하단에 배치 */}
      {selectable && (
        <div className={`${styles.selectCheckbox} ${selected ? styles.selectCheckboxChecked : ''}`}>
          <span className="material-symbols-outlined">{selected ? 'check_circle' : 'radio_button_unchecked'}</span>
        </div>
      )}
    </div>
  );
};
