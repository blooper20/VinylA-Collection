'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getCommunityPosts, CommunityPostWithMeta, getPinnedNotices, getNotices } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { NOTICE } from '@vinyla/shared-types';
import { ComingSoonNotice } from '../../components/Community/ComingSoonNotice';
import { CommunityTabs, COMMUNITY_TABS, CommunityTabKey } from '../../components/Community/CommunityTabs';
import styles from './page.module.css';

const PAGE_SIZE = 20;

const isTabKey = (v: string | null): v is CommunityTabKey =>
  !!v && COMMUNITY_TABS.some((tab) => tab.key === v);

// 게시판은 이제 사이드바 카테고리 목록이 아니라 이 페이지 상단 탭
// (전체/공지사항/자유게시판/자랑/정보/로케이션) 하나로 통합됐다 — ?tab= 쿼리만
// 읽어 필터링한다. useSearchParams()를 쓰는 부분만 Suspense로 감싸 이 훅
// 하나 때문에 다른 정적 페이지들까지 동적 렌더링으로 강제되지 않게 한다.
function CommunityPageInner() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: CommunityTabKey = isTabKey(tabParam) ? tabParam : 'ALL';
  const activeGroup = COMMUNITY_TABS.find((tab) => tab.key === activeTab)!;
  // LOCATION은 지도 SDK 도입 전까지 실제 게시글이 없는 자리표시 탭이다
  // (COMMUNITY_POST.CATEGORY DB 체크 제약에도 없음) — 목록 조회 자체를
  // 건너뛰고 "준비 중" 안내만 보여준다.
  const isLocationPlaceholder = activeTab === 'LOCATION';
  // 공지사항은 COMMUNITY_POST가 아니라 별도 NOTICE 테이블이라 아래에서
  // getCommunityPosts 대신 getNotices/getPinnedNotices로 따로 조회한다.
  const isNoticeTab = activeTab === 'NOTICE';

  const [posts, setPosts] = React.useState<CommunityPostWithMeta[]>([]);
  const [pinnedNotices, setPinnedNotices] = React.useState<NOTICE[]>([]);
  const [notices, setNotices] = React.useState<NOTICE[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasMore, setHasMore] = React.useState(false);

  React.useEffect(() => {
    if (isLocationPlaceholder) { setIsLoading(false); return; }
    setIsLoading(true);
    if (isNoticeTab) {
      Promise.all([getPinnedNotices().catch(() => []), getNotices({ limit: PAGE_SIZE }).catch(() => [])])
        .then(([pinnedRows, rows]) => {
          setPinnedNotices(pinnedRows);
          setNotices(rows);
          setHasMore(rows.length === PAGE_SIZE);
        })
        .finally(() => setIsLoading(false));
      return;
    }
    getCommunityPosts({ category: activeGroup.categories, limit: PAGE_SIZE })
      .then((rows) => {
        setPosts(rows);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isLocationPlaceholder, isNoticeTab]);

  const loadMore = async () => {
    if (isNoticeTab) {
      const oldest = notices[notices.length - 1];
      if (!oldest) return;
      const more = await getNotices({ limit: PAGE_SIZE, beforeCreatedAt: oldest.CREATED_AT });
      setNotices((prev) => [...prev, ...more]);
      setHasMore(more.length === PAGE_SIZE);
      return;
    }
    if (posts.length === 0) return;
    const more = await getCommunityPosts({
      category: activeGroup.categories,
      limit: PAGE_SIZE,
      beforeCreatedAt: posts[posts.length - 1].CREATED_AT,
    });
    setPosts((prev) => [...prev, ...more]);
    setHasMore(more.length === PAGE_SIZE);
  };

  const renderNoticeRow = (n: NOTICE, pinned: boolean) => {
    const thumb = n.MEDIA_ITEMS?.find((m) => m.type === 'image');
    return (
      <Link key={n.NOTICE_ID} href={`/notices/${n.NOTICE_ID}`} className={styles.row}>
        {thumb ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={thumb.url} alt="" className={styles.thumb} />
        ) : (
          <div className={styles.thumbPlaceholder} />
        )}
        <div className={styles.rowBody}>
          {pinned && <span className={styles.rowCategory}>{t('notice.pinned')}</span>}
          <span className={styles.rowTitle}>{n.TITLE}</span>
          <span className={styles.rowMeta}>
            {new Date(n.CREATED_AT).toLocaleDateString()} · {t('notice.views', { count: n.VIEW_COUNT })}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className={styles.container}>
      <CommunityTabs active={activeTab} />

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t(`communityBoard.tabs.${activeTab}` as any)}</h1>
          {!isLocationPlaceholder && (
            <p className={styles.hint}>{t(`communityBoard.tabHints.${activeTab}` as any)}</p>
          )}
        </div>
        {!isLocationPlaceholder && !isNoticeTab && (
          <Link href="/community/new" className={styles.writeBtn}>{t('communityBoard.writeCta')}</Link>
        )}
      </header>

      {isLocationPlaceholder ? (
        <ComingSoonNotice />
      ) : isNoticeTab ? (
        <>
          {isLoading && <p className={styles.status}>{t('notice.loading')}</p>}
          {!isLoading && notices.length === 0 && pinnedNotices.length === 0 && (
            <p className={styles.status}>{t('notice.empty')}</p>
          )}

          {pinnedNotices.length > 0 && (
            <div className={styles.list}>{pinnedNotices.map((n) => renderNoticeRow(n, true))}</div>
          )}
          <div className={styles.list}>{notices.map((n) => renderNoticeRow(n, false))}</div>

          {hasMore && !isLoading && (
            <button type="button" className={styles.loadMoreBtn} onClick={loadMore}>
              {t('communityBoard.loadMore')}
            </button>
          )}
        </>
      ) : (
        <>
          {isLoading && <p className={styles.status}>{t('communityBoard.loading')}</p>}
          {!isLoading && posts.length === 0 && <p className={styles.status}>{t('communityBoard.empty')}</p>}

          <div className={styles.list}>
            {posts.map((p) => (
              <Link key={p.POST_ID} href={`/community/${p.POST_ID}`} className={styles.row}>
                {p.MEDIA_ITEMS[0] ? (
                  <div className={styles.thumbWrap}>
                    {p.MEDIA_ITEMS[0].type === 'video' ? (
                      <video className={styles.thumb} src={p.MEDIA_ITEMS[0].url} muted playsInline preload="metadata" />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={p.MEDIA_ITEMS[0].url} alt="" className={styles.thumb} />
                    )}
                    {p.MEDIA_ITEMS[0].type === 'video' && (
                      <span className="material-symbols-outlined" aria-hidden style={{
                        position: 'absolute', inset: 0, margin: 'auto', width: 18, height: 18,
                        fontSize: 18, color: '#fff', textShadow: '0 0 4px rgba(0,0,0,0.8)',
                      }}>play_circle</span>
                    )}
                  </div>
                ) : (
                  <div className={styles.thumbPlaceholder} />
                )}
                <div className={styles.rowBody}>
                  <span className={styles.rowCategory}>{t(`communityBoard.categories.${p.CATEGORY}` as any)}</span>
                  <span className={styles.rowTitle}>{p.TITLE}</span>
                  <span className={styles.rowMeta}>
                    {p.AUTHOR_NAME || t('communityBoard.authorFallback')} · {new Date(p.CREATED_AT).toLocaleDateString()}
                    {' · '}{t('communityBoard.commentCount', { count: p.COMMENT_COUNT })}
                    {' · '}{t('communityBoard.viewCount', { count: p.VIEW_COUNT })}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {hasMore && !isLoading && (
            <button type="button" className={styles.loadMoreBtn} onClick={loadMore}>
              {t('communityBoard.loadMore')}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={null}>
      <CommunityPageInner />
    </Suspense>
  );
}
