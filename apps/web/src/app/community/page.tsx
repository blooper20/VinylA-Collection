'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getCommunityPosts, CommunityPostWithMeta } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { CommunityPostCategory } from '@vinyla/shared-types';
import { ComingSoonNotice } from '../../components/Community/ComingSoonNotice';
import styles from './page.module.css';

const VALID_CATEGORIES: CommunityPostCategory[] = ['FREE', 'ARRIVAL', 'LISTENING_ROOM', 'INFO', 'TIP', 'QNA'];
const PAGE_SIZE = 20;

const isCategory = (v: string | null): v is CommunityPostCategory =>
  !!v && (VALID_CATEGORIES as string[]).includes(v);

// 카테고리 선택은 이제 사이드바가 전담한다(컬렉션/커뮤니티 모드 스위치 →
// 카테고리별 링크: /community?category=ARRIVAL 등) — 이 페이지는 그 쿼리를
// 읽어 필터링만 한다. useSearchParams()를 쓰는 부분만 Suspense로 감싸
// 이 훅 하나 때문에 다른 정적 페이지들까지 동적 렌더링으로 강제되지 않게 한다.
function CommunityPageInner() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  // LOCATION은 지도 SDK 도입 전까지 실제 게시글이 없는 자리표시 카테고리다
  // (COMMUNITY_POST.CATEGORY DB 체크 제약에도 없음) — 목록 조회 자체를
  // 건너뛰고 "준비 중" 안내만 보여준다.
  const isLocationPlaceholder = categoryParam === 'LOCATION';
  const category: CommunityPostCategory | 'ALL' = isCategory(categoryParam) ? categoryParam : 'ALL';

  const [posts, setPosts] = React.useState<CommunityPostWithMeta[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasMore, setHasMore] = React.useState(false);

  React.useEffect(() => {
    if (isLocationPlaceholder) { setIsLoading(false); return; }
    setIsLoading(true);
    getCommunityPosts({ category: category === 'ALL' ? undefined : category, limit: PAGE_SIZE })
      .then((rows) => {
        setPosts(rows);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .finally(() => setIsLoading(false));
  }, [category, isLocationPlaceholder]);

  const loadMore = async () => {
    if (posts.length === 0) return;
    const more = await getCommunityPosts({
      category: category === 'ALL' ? undefined : category,
      limit: PAGE_SIZE,
      beforeCreatedAt: posts[posts.length - 1].CREATED_AT,
    });
    setPosts((prev) => [...prev, ...more]);
    setHasMore(more.length === PAGE_SIZE);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {isLocationPlaceholder
              ? t('communityBoard.categories.LOCATION' as any)
              : category === 'ALL' ? t('communityBoard.pageTitle') : t(`communityBoard.categories.${category}` as any)}
          </h1>
          {!isLocationPlaceholder && (
            <p className={styles.hint}>
              {category === 'ALL' ? t('communityBoard.allCategoriesHint') : t(`communityBoard.categoryHint.${category}` as any)}
            </p>
          )}
        </div>
        {!isLocationPlaceholder && (
          <Link href="/community/new" className={styles.writeBtn}>{t('communityBoard.writeCta')}</Link>
        )}
      </header>

      {isLocationPlaceholder ? (
        <ComingSoonNotice />
      ) : (
        <>
          {isLoading && <p className={styles.status}>{t('communityBoard.loading')}</p>}
          {!isLoading && posts.length === 0 && <p className={styles.status}>{t('communityBoard.empty')}</p>}

          <div className={styles.list}>
            {posts.map((p) => (
              <Link key={p.POST_ID} href={`/community/${p.POST_ID}`} className={styles.row}>
                {p.MEDIA_ITEMS[0] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={p.MEDIA_ITEMS[0].url} alt="" className={styles.thumb} />
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
