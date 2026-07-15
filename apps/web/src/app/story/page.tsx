'use client';

import React, { useState, useEffect, useCallback } from 'react';
import styles from './story.module.css';
import { getTodayVinylStory, getVinylStoryArchive } from '@vinyla/core-api';
import { VINYL_STORY } from '@vinyla/shared-types';
import { useLocale } from '@vinyla/i18n';

const formatDate = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00`).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

export default function VinylStoryPage() {
  const { t } = useLocale();
  const [today, setToday] = useState<VINYL_STORY | null>(null);
  const [archive, setArchive] = useState<VINYL_STORY[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  // 지난 이야기 아코디언 — 클릭하면 본문까지 펼쳐 읽을 수 있다
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const [todayStory, archiveRows] = await Promise.all([
        getTodayVinylStory(),
        getVinylStoryArchive(10),
      ]);
      setToday(todayStory);
      // 아카이브 조회에 오늘 자 행도 포함될 수 있어 STORY_DATE로 걸러낸다.
      setArchive(archiveRows.filter((s) => s.STORY_DATE !== todayStory?.STORY_DATE));
    } catch (e) {
      console.error('Failed to load vinyl story', e);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 마운트 시 오늘의 스토리 + 지난 이야기를 불러오는 비동기 데이터 로딩 패턴 (의도된 동작)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{t('story.eyebrow')}</p>
        <h1 className={styles.title}>{t('story.title')}</h1>
        <p className={styles.subtitle}>{t('story.subtitle')}</p>
      </header>

      {isLoading ? (
        <p className={styles.loadingText}>{t('story.loading')}</p>
      ) : loadFailed || !today ? (
        <p className={styles.loadingText}>{t('story.empty')}</p>
      ) : (
        <section className={styles.todayCard}>
          {today.COVER_IMAGE_URL && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className={styles.todayCover} src={today.COVER_IMAGE_URL} alt={today.ALBUM_TITLE} />
          )}
          <div className={styles.todayText}>
            <p className={styles.todayAlbum}>{today.ALBUM_ARTIST} · {today.ALBUM_TITLE}</p>
            <h2 className={styles.todayHeadline}>{today.HEADLINE}</h2>
            <p className={styles.todayBody}>{today.BODY}</p>
            <p className={styles.disclaimer}>{t('story.disclaimer')}</p>
          </div>
        </section>
      )}

      {archive.length > 0 && (
        <section className={styles.archiveSection}>
          <h2 className={styles.archiveTitle}>{t('story.archiveTitle')}</h2>
          <div className={styles.archiveList}>
            {archive.map((s) => {
              const expanded = expandedId === s.STORY_ID;
              return (
                <div key={s.STORY_ID} className={`${styles.archiveItem} ${expanded ? styles.archiveItemExpanded : ''}`}>
                  <button
                    type="button"
                    className={styles.archiveItemHead}
                    onClick={() => setExpandedId(expanded ? null : s.STORY_ID)}
                    aria-expanded={expanded}
                  >
                    {s.COVER_IMAGE_URL && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img className={styles.archiveCover} src={s.COVER_IMAGE_URL} alt={s.ALBUM_TITLE} />
                    )}
                    <div className={styles.archiveItemText}>
                      <span className={styles.archiveDate}>{formatDate(s.STORY_DATE)}</span>
                      <div className={styles.archiveAlbum}>{s.ALBUM_ARTIST} · {s.ALBUM_TITLE}</div>
                      <div className={styles.archiveHeadline}>{s.HEADLINE}</div>
                    </div>
                    <span className={`material-symbols-outlined ${styles.archiveChevron}`}>
                      {expanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </button>
                  {expanded && (
                    <div className={styles.archiveBody}>
                      <p className={styles.archiveBodyText}>{s.BODY}</p>
                      <p className={styles.disclaimer}>{t('story.disclaimer')}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
