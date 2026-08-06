'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import styles from './feed.module.css';
import { PageTabs } from '../../components/Navigation/PageTabs';
import {
  getMergedFeed,
  subscribeToMergedFeed,
  getTasteMatches,
  getMyFollowingIds,
  followUser,
  unfollowUser,
  FeedEntry,
  FeedItem,
  ListeningLogFeedItem,
  SpinSocialSummary,
  TasteMatch,
} from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { VinylSocialModal } from '../../components/Modal/VinylSocialModal';
import { SpinSocialModal } from '../../components/Modal/SpinSocialModal';
import { SpinSocialActions } from '../../components/SpinSocialActions';
import { ShowcasePostCard } from '../../components/Community/ShowcasePostCard';
import { useCoverImageUrl } from '../../hooks/useCoverImageUrl';

const PAGE_SIZE = 30;

// 각 피드 항목마다 훅(useCoverImageUrl)을 걸어야 해서 .map() 콜백 안에
// 인라인으로 두지 않고 따로 뺐다 — 외부 커버 소스가 순간 실패해도 깨진
// 이미지 아이콘 대신, 이미 있던 "커버 없음" 아이콘 폴백을 그대로 재사용한다.
const FeedItemCover: React.FC<{ imageUrl?: string; title?: string }> = ({ imageUrl, title }) => {
  const displayCoverUrl = useCoverImageUrl(imageUrl, '');
  if (!displayCoverUrl) {
    return (
      <div className={styles.feedCoverFallback}>
        <span className="material-symbols-outlined">album</span>
      </div>
    );
  }
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img className={styles.feedCover} src={displayCoverUrl} alt={title} />;
};

// 수집 활동(VINYL_ADD)·자랑게시판 글(SHOWCASE_POST)·다이어리 기록(LISTENING_LOG)이
// 같은 리스트에 섞이므로 종류별로 고유한 키를 만든다 — 세 소스의 PK
// 네임스페이스가 겹칠 수 있어서다.
const entryKey = (entry: FeedEntry): string => {
  if (entry.KIND === 'VINYL_ADD') return `v:${entry.DATA.USER_VINYL_ID}`;
  if (entry.KIND === 'LISTENING_LOG') return `l:${entry.DATA.LOG_ID}`;
  return `p:${entry.DATA.POST_ID}`;
};

export default function DiscoveryFeedPage() {
  const { t } = useLocale();
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [newKeys, setNewKeys] = useState<Set<string>>(new Set());
  const [matches, setMatches] = useState<TasteMatch[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  const [selectedLog, setSelectedLog] = useState<ListeningLogFeedItem | null>(null);
  // 실시간 INSERT/UPDATE가 초기 조회 결과와 겹칠 수 있어 key로 중복을 막는다.
  const seenKeys = useRef<Set<string>>(new Set());
  // 세 소스(USER_VINYL/COMMUNITY_POST/LISTENING_LOG)를 독립적으로 페이지네이션하기 위한 커서
  const vinylCursor = useRef<string | undefined>(undefined);
  const postCursor = useRef<string | undefined>(undefined);
  const logCursor = useRef<string | undefined>(undefined);

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
      const [page, taste, following] = await Promise.all([
        getMergedFeed({ limit: PAGE_SIZE }).catch(() => ({
          entries: [] as FeedEntry[],
          nextVinylCursor: null,
          nextPostCursor: null,
          nextLogCursor: null,
          hasMore: false,
        })),
        getTasteMatches(10),
        getMyFollowingIds(),
      ]);
      if (cancelled) return;
      page.entries.forEach((e) => seenKeys.current.add(entryKey(e)));
      vinylCursor.current = page.nextVinylCursor ?? undefined;
      postCursor.current = page.nextPostCursor ?? undefined;
      logCursor.current = page.nextLogCursor ?? undefined;
      setEntries(page.entries);
      setHasMore(page.hasMore);
      setMatches(taste);
      setFollowingIds(following);
      setIsLoading(false);
    })();

    const unsubscribe = subscribeToMergedFeed((entry) => {
      const key = entryKey(entry);
      if (cancelled || seenKeys.current.has(key)) return;
      seenKeys.current.add(key);
      setEntries((prev) => [entry, ...prev]);
      setNewKeys((prev) => new Set(prev).add(key));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const page = await getMergedFeed({
        limit: PAGE_SIZE,
        beforeVinylAt: vinylCursor.current,
        beforePostAt: postCursor.current,
        beforeLogAt: logCursor.current,
      });
      const fresh = page.entries.filter((e) => !seenKeys.current.has(entryKey(e)));
      fresh.forEach((e) => seenKeys.current.add(entryKey(e)));
      vinylCursor.current = page.nextVinylCursor ?? undefined;
      postCursor.current = page.nextPostCursor ?? undefined;
      logCursor.current = page.nextLogCursor ?? undefined;
      setEntries((prev) => [...prev, ...fresh]);
      setHasMore(page.hasMore);
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

  const renderVinylAdd = (item: FeedItem, key: string) => {
    const name = item.DISPLAY_NAME || t('feed.anonymous');
    return (
      <div
        key={key}
        className={`${styles.feedItem} ${newKeys.has(key) ? styles.feedItemNew : ''}`}
        onClick={() => setSelectedItem(item)}
        style={{ cursor: 'pointer' }}
      >
        <div style={{ position: 'relative' }}>
          <FeedItemCover imageUrl={item.ALBUM?.IMAGE_URL} title={item.ALBUM?.TITLE} />
          {item.STATUS === 'WISH' && <span className={styles.wishBadge}>WISH</span>}
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
  };

  // SpinSocialActions/모달이 좋아요·댓글 수를 바꾸면 해당 LISTENING_LOG
  // 엔트리의 SOCIAL만 갱신 — 다른 종류 엔트리는 KIND 다르므로 그대로 둔다.
  const updateLogSocial = (logId: number, social: SpinSocialSummary) => {
    setEntries((prev) =>
      prev.map((e) => (e.KIND === 'LISTENING_LOG' && e.DATA.LOG_ID === logId ? { ...e, DATA: { ...e.DATA, SOCIAL: social } } : e))
    );
  };

  const renderListeningLog = (item: ListeningLogFeedItem, key: string) => {
    const name = item.DISPLAY_NAME || t('feed.anonymous');
    return (
      <div
        key={key}
        className={`${styles.feedItem} ${newKeys.has(key) ? styles.feedItemNew : ''}`}
        onClick={() => setSelectedLog(item)}
        style={{ cursor: 'pointer', alignItems: 'flex-start' }}
      >
        <FeedItemCover imageUrl={item.ALBUM_MASTER?.IMAGE_URL} title={item.ALBUM_MASTER?.TITLE} />
        <div className={styles.feedText}>
          <p className={styles.feedHeadline}>
            <Link
              href={profileHref(item.USER_ID, item.DISPLAY_NAME || null)}
              className={styles.feedUserName}
              onClick={(e) => e.stopPropagation()}
            >
              {name}
            </Link>
            {' '}{t('feed.spunSuffix')}
          </p>
          <p className={styles.feedAlbum}>
            {item.ALBUM_MASTER?.TITLE || `#${item.ALBUM_ID}`}
            {item.ALBUM_MASTER?.ARTIST && <span className={styles.feedArtist}> · {item.ALBUM_MASTER.ARTIST}</span>}
          </p>
          <SpinSocialActions
            entry={item}
            ownerName={item.DISPLAY_NAME}
            summary={item.SOCIAL}
            onOpenComments={() => setSelectedLog(item)}
            onSummaryChange={updateLogSocial}
          />
        </div>
        <span className={styles.feedTime}>{relativeTime(item.CREATED_AT)}</span>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <PageTabs group="social" />
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{t('feed.eyebrow')}</p>
          <h1 className={styles.title}>
            {t('feed.title')}
            <span className={styles.liveBadge}>
              <span className={styles.liveDot} />
              {t('feed.live')}
            </span>
          </h1>
          <p className={styles.subtitle}>{t('feed.subtitle')}</p>
        </div>
        <Link href="/community/new?category=ARRIVAL&scope=feed" className={styles.writeBtn}>
          {t('communityBoard.writeCta')}
        </Link>
      </header>

      {/* 오늘의 바이닐 스토리 — 사이드바 메뉴 대신 피드 최상단에서 진입 (앱 파리티) */}
      <Link href="/story" className={styles.storyBanner}>
        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--accent)' }}>auto_stories</span>
        <span className={styles.storyBannerText}>{t('story.title')}</span>
        <span className={`material-symbols-outlined ${styles.storyBannerArrow}`}>chevron_right</span>
      </Link>

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
                  {m.PROFILE_IMAGE_URL ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={m.PROFILE_IMAGE_URL} alt="" className={styles.matchAvatar} style={{ objectFit: 'cover' }} />
                  ) : (
                    <div className={styles.matchAvatar}>{name.slice(0, 1).toUpperCase()}</div>
                  )}
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
        ) : entries.length === 0 ? (
          <p className={styles.loadingText}>{t('feed.empty')}</p>
        ) : (
          <>
            <div className={styles.feedList}>
              {entries.map((entry) => {
                const key = entryKey(entry);
                if (entry.KIND === 'VINYL_ADD') return renderVinylAdd(entry.DATA, key);
                if (entry.KIND === 'LISTENING_LOG') return renderListeningLog(entry.DATA, key);
                return (
                  <ShowcasePostCard
                    key={key}
                    post={entry.DATA}
                    href={`/community/${entry.DATA.POST_ID}?from=feed`}
                    isNew={newKeys.has(key)}
                  />
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

      {selectedLog && (
        <SpinSocialModal
          entry={selectedLog}
          ownerName={selectedLog.DISPLAY_NAME}
          onClose={() => setSelectedLog(null)}
          onSummaryChange={updateLogSocial}
        />
      )}
    </div>
  );
}
