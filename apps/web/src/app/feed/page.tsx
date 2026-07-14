'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import styles from './feed.module.css';
import {
  getDiscoveryFeed,
  subscribeToDiscoveryFeed,
  getTasteMatches,
  getMyFollowingIds,
  followUser,
  unfollowUser,
  FeedItem,
  TasteMatch,
} from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { VinylSocialModal } from '../../components/Modal/VinylSocialModal';

const PAGE_SIZE = 30;

export default function DiscoveryFeedPage() {
  const { t } = useLocale();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const [matches, setMatches] = useState<TasteMatch[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  // 실시간 INSERT/UPDATE가 초기 조회 결과와 겹칠 수 있어 id로 중복을 막는다.
  const seenIds = useRef<Set<number>>(new Set());

  const relativeTime = useCallback(
    (iso: string): string => {
      const diffMs = Date.now() - new Date(iso).getTime();
      const m = Math.floor(diffMs / 60000);
      if (m < 1) return t('feed.justNow');
      if (m < 60) return t('feed.minutesAgo', { m });
      const h = Math.floor(m / 60);
      if (h < 24) return t('feed.hoursAgo', { h });
      return t('feed.daysAgo', { d: Math.floor(h / 24) });
    },
    [t]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [feed, taste, following] = await Promise.all([
        getDiscoveryFeed({ limit: PAGE_SIZE }).catch(() => [] as FeedItem[]),
        getTasteMatches(10),
        getMyFollowingIds(),
      ]);
      if (cancelled) return;
      feed.forEach((i) => seenIds.current.add(i.USER_VINYL_ID));
      setItems(feed);
      setHasMore(feed.length === PAGE_SIZE);
      setMatches(taste);
      setFollowingIds(following);
      setIsLoading(false);
    })();

    const unsubscribe = subscribeToDiscoveryFeed((item) => {
      if (cancelled || seenIds.current.has(item.USER_VINYL_ID)) return;
      seenIds.current.add(item.USER_VINYL_ID);
      setItems((prev) => [item, ...prev]);
      setNewIds((prev) => new Set(prev).add(item.USER_VINYL_ID));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = async () => {
    const oldest = items[items.length - 1];
    if (!oldest || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await getDiscoveryFeed({ limit: PAGE_SIZE, beforeAddedAt: oldest.ADDED_AT });
      const fresh = page.filter((i) => !seenIds.current.has(i.USER_VINYL_ID));
      fresh.forEach((i) => seenIds.current.add(i.USER_VINYL_ID));
      setItems((prev) => [...prev, ...fresh]);
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const toggleFollow = async (targetUserId: string) => {
    const isFollowing = followingIds.has(targetUserId);
    // 낙관적 토글 — 실패하면 원복
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (isFollowing) next.delete(targetUserId);
      else next.add(targetUserId);
      return next;
    });
    try {
      if (isFollowing) await unfollowUser(targetUserId);
      else await followUser(targetUserId);
    } catch {
      setFollowingIds((prev) => {
        const next = new Set(prev);
        if (isFollowing) next.add(targetUserId);
        else next.delete(targetUserId);
        return next;
      });
    }
  };

  // 컬렉션 공유 페이지(/user/[id])가 아니라 프로필 대시보드로 보낸다
  const profileHref = (userId: string, name: string | null) =>
    `/user/${userId}/dashboard${name ? `?n=${encodeURIComponent(name)}` : ''}`;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{t('feed.eyebrow')}</p>
        <h1 className={styles.title}>
          {t('feed.title')}
          <span className={styles.liveBadge}>
            <span className={styles.liveDot} />
            {t('feed.live')}
          </span>
        </h1>
        <p className={styles.subtitle}>{t('feed.subtitle')}</p>
      </header>

      {matches.length > 0 && (
        <section className={styles.matchesSection}>
          <h2 className={styles.matchesTitle}>{t('feed.matchesTitle')}</h2>
          <p className={styles.matchesSubtitle}>{t('feed.matchesSubtitle')}</p>
          <div className={styles.matchesRail}>
            {matches.map((m) => {
              const name = m.DISPLAY_NAME || t('feed.anonymous');
              const isFollowing = followingIds.has(m.USER_ID);
              return (
                <div key={m.USER_ID} className={styles.matchCard}>
                  <div className={styles.matchAvatar}>{name.slice(0, 1).toUpperCase()}</div>
                  <Link href={profileHref(m.USER_ID, m.DISPLAY_NAME)} className={styles.matchName}>
                    {name}
                  </Link>
                  <span className={styles.matchPercent}>
                    {t('feed.matchPercent', { percent: m.MATCH_PERCENT })}
                  </span>
                  <span className={styles.matchOverlap}>
                    {t('feed.overlapCount', { count: m.OVERLAP_COUNT })}
                  </span>
                  <button
                    className={`${styles.followBtn} ${isFollowing ? styles.followBtnActive : ''}`}
                    onClick={() => toggleFollow(m.USER_ID)}
                  >
                    {isFollowing ? t('feed.following') : t('feed.follow')}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className={styles.feedSection}>
        {isLoading ? (
          <p className={styles.loadingText}>{t('feed.loading')}</p>
        ) : items.length === 0 ? (
          <p className={styles.loadingText}>{t('feed.empty')}</p>
        ) : (
          <>
            <div className={styles.feedList}>
              {items.map((item) => {
                const name = item.DISPLAY_NAME || t('feed.anonymous');
                return (
                  <div
                    key={item.USER_VINYL_ID}
                    className={`${styles.feedItem} ${newIds.has(item.USER_VINYL_ID) ? styles.feedItemNew : ''}`}
                    onClick={() => setSelectedItem(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ position: 'relative' }}>
                      {item.ALBUM?.IMAGE_URL ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img className={styles.feedCover} src={item.ALBUM.IMAGE_URL} alt={item.ALBUM.TITLE} />
                      ) : (
                        <div className={styles.feedCoverFallback}>
                          <span className="material-symbols-outlined">album</span>
                        </div>
                      )}
                      {item.STATUS === 'WISH' && (
                        <span className={styles.wishBadge}>WISH</span>
                      )}
                    </div>
                    <div className={styles.feedText}>
                      <p className={styles.feedHeadline}>
                        <Link 
                          href={profileHref(item.USER_ID, item.DISPLAY_NAME)}
                          className={styles.feedUserName}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {name}
                        </Link>
                        {' '}{item.STATUS === 'WISH' ? '님이 위시리스트에 담았습니다.' : t('feed.addedSuffix')}
                      </p>
                      <p className={styles.feedAlbum}>
                        {item.ALBUM?.TITLE || `#${item.ALBUM_ID}`}
                        {item.ALBUM?.ARTIST && <span className={styles.feedArtist}> · {item.ALBUM.ARTIST}</span>}
                      </p>
                    </div>
                    <span className={styles.feedTime}>{relativeTime(item.ADDED_AT)}</span>
                  </div>
                );
              })}
            </div>
            {hasMore && (
              <button className={styles.loadMoreBtn} onClick={loadMore} disabled={isLoadingMore}>
                {isLoadingMore ? t('feed.loading') : t('feed.loadMore')}
              </button>
            )}
          </>
        )}
      </section>

      {selectedItem && (
        <VinylSocialModal
          entry={selectedItem}
          ownerName={selectedItem.DISPLAY_NAME}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
