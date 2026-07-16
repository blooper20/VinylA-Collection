'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './notices.module.css';
import { getPinnedNotices, getNotices } from '@vinyla/core-api';
import { NOTICE } from '@vinyla/shared-types';
import { useLocale } from '@vinyla/i18n';

const PAGE_SIZE = 20;

export default function NoticesPage() {
  const { t } = useLocale();
  const [pinned, setPinned] = useState<NOTICE[]>([]);
  const [items, setItems] = useState<NOTICE[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    (async () => {
      const [pinnedRows, rows] = await Promise.all([
        getPinnedNotices().catch(() => []),
        getNotices({ limit: PAGE_SIZE }).catch(() => []),
      ]);
      setPinned(pinnedRows);
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);
      setIsLoading(false);
    })();
  }, []);

  const loadMore = async () => {
    const oldest = items[items.length - 1];
    if (!oldest || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const more = await getNotices({ limit: PAGE_SIZE, beforeCreatedAt: oldest.CREATED_AT });
      setItems((prev) => [...prev, ...more]);
      setHasMore(more.length === PAGE_SIZE);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const renderItem = (n: NOTICE, pinnedItem: boolean) => {
    const thumb = n.MEDIA_ITEMS?.find((m) => m.type === 'image');
    return (
      <Link key={n.NOTICE_ID} href={`/notices/${n.NOTICE_ID}`} className={`${styles.item} ${pinnedItem ? styles.itemPinned : ''}`}>
        {thumb ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={thumb.url} alt="" className={styles.itemThumb} />
        ) : (
          <div className={styles.itemThumbEmpty} />
        )}
        <div className={styles.itemBody}>
          <p className={styles.itemTitle}>
            {pinnedItem && <span className={styles.pinBadge}>{t('notice.pinned')}</span>}
            {n.TITLE}
          </p>
          <span className={styles.itemDate}>
            {new Date(n.CREATED_AT).toLocaleDateString()} · {t('notice.views', { count: n.VIEW_COUNT })}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{t('notice.eyebrow')}</p>
        <h1 className={styles.title}>{t('notice.title')}</h1>
        <p className={styles.subtitle}>{t('notice.subtitle')}</p>
      </header>

      {isLoading ? (
        <p className={styles.loadingText}>{t('notice.loading')}</p>
      ) : (
        <>
          {pinned.length > 0 && (
            <>
              <p className={styles.sectionTitle}>{t('notice.pinnedSection')}</p>
              <div className={styles.list}>{pinned.map((n) => renderItem(n, true))}</div>
            </>
          )}

          {items.length === 0 && pinned.length === 0 ? (
            <p className={styles.loadingText}>{t('notice.empty')}</p>
          ) : (
            <div className={styles.list}>{items.map((n) => renderItem(n, false))}</div>
          )}

          {hasMore && (
            <button className={styles.loadMoreBtn} onClick={loadMore} disabled={isLoadingMore}>
              {isLoadingMore ? t('feed.loading') : t('feed.loadMore')}
            </button>
          )}
        </>
      )}
    </div>
  );
}
