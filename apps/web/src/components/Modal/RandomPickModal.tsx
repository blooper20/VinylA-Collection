'use client';

import React from 'react';
import styles from './RandomPickModal.module.css';
import { useAuthStore, getLastPlayedMap, pickWeightedRandomAlbum } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { MockVinylData } from '@vinyla/shared-types';

// 뽑는 연출이 너무 순식간에 끝나지 않도록 최소 대기 시간을 둔다 — 실제
// getLastPlayedMap 조회 시간과 병렬로 흘러가므로 체감상 추가 지연은 거의 없다.
const MIN_REVEAL_MS = 700;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// "오늘 뭐 듣지?" — 보관함의 OWNED 앨범 중 오래 안 들은(또는 한 번도 기록되지
// 않은) 앨범에 가중치를 준 랜덤 픽. 카드 뒤집기 연출 후 결과를 보여주고,
// "이 앨범으로 다이어리 쓰기"를 누르면 그 앨범의 DetailModal을 열어 스피닝
// 다이어리 흐름(기능1)으로 바로 이어준다.
export const RandomPickModal: React.FC<{
  albums: MockVinylData[];
  onClose: () => void;
  onOpenAlbum: (album: MockVinylData) => void;
}> = ({ albums, onClose, onOpenAlbum }) => {
  const { user } = useAuthStore();
  const { t } = useLocale();
  const [picked, setPicked] = React.useState<MockVinylData | null>(null);
  const [flipped, setFlipped] = React.useState(false);
  const [isRevealing, setIsRevealing] = React.useState(false);

  const runPick = React.useCallback(async () => {
    if (albums.length === 0) return;
    setFlipped(false);
    setPicked(null);
    setIsRevealing(true);
    try {
      const [lastPlayedMap] = await Promise.all([
        user?.id ? getLastPlayedMap(user.id) : Promise.resolve({}),
        wait(MIN_REVEAL_MS),
      ]);
      setPicked(pickWeightedRandomAlbum(albums, lastPlayedMap));
    } finally {
      setIsRevealing(false);
    }
  }, [albums, user?.id]);

  React.useEffect(() => {
    // 모달이 열리면 바로 한 번 뽑는다 (의도된 마운트 시 데이터 로딩)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runPick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!picked || isRevealing) return;
    const id = setTimeout(() => setFlipped(true), 50);
    return () => clearTimeout(id);
  }, [picked, isRevealing]);

  const showResult = !!picked && !isRevealing && flipped;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose} aria-label={t('common.cancel')}>
          <span className="material-symbols-outlined">close</span>
        </button>
        <p className={styles.eyebrow}>{t('randomPick.eyebrow')}</p>
        <h2 className={styles.title}>{t('randomPick.title')}</h2>

        {albums.length === 0 ? (
          <p className={styles.emptyText}>{t('randomPick.empty')}</p>
        ) : (
          <>
            <div className={styles.flipStage}>
              <div className={`${styles.flipCard} ${flipped ? styles.flipped : ''}`}>
                <div className={`${styles.flipFace} ${styles.flipBack} ${isRevealing ? styles.flipBackSpin : ''}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 64, color: 'rgba(230,185,60,0.5)' }}>album</span>
                </div>
                <div className={`${styles.flipFace} ${styles.flipFront}`}>
                  {picked && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img className={styles.flipFrontImage} src={picked.IMAGE_URL} alt={picked.TITLE} />
                  )}
                </div>
              </div>
            </div>

            {showResult && (
              <div className={styles.resultText}>
                <p className={styles.resultArtist}>{picked!.ARTIST}</p>
                <h3 className={styles.resultTitle}>{picked!.TITLE}</h3>
              </div>
            )}

            <div className={styles.actions}>
              {showResult && (
                <button className={styles.primaryBtn} onClick={() => { onOpenAlbum(picked!); onClose(); }}>
                  {t('randomPick.openCta')}
                </button>
              )}
              <button className={styles.secondaryBtn} onClick={runPick} disabled={isRevealing}>
                {isRevealing ? t('randomPick.revealing') : t('randomPick.tryAgain')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
