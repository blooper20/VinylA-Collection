'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CommunityPostWithMeta } from '@vinyla/core-api';
import { useLocale, TranslationKey } from '@vinyla/i18n';
import { buildShowcaseItems } from './showcaseCarouselItems';
import styles from './ShowcasePostCard.module.css';

// 자랑게시판 글 하나를 인스타그램 피드 포스트처럼 보여주는 카드 —
// /feed(소셜 피드)와 /community?tab=SHOWCASE 목록이 같은 콘텐츠를
// 다른 맥락에서 보여주므로 시각적으로 같은 카드를 공유한다. 카드 전체는
// 클릭 시 상세로 이동하고, 작성자 이름만 따로 프로필로 이동해야 해서
// (Link 중첩 불가) 카드 자체는 div+onClick으로 처리한다.

interface ShowcasePostCardProps {
  post: CommunityPostWithMeta;
  /** 상세페이지 이동 경로 — 호출부(피드/커뮤니티)에 따라 ?from= 등이 달라진다 */
  href: string;
  /** 실시간으로 막 들어온 항목 강조 애니메이션 */
  isNew?: boolean;
}

const relativeTime = (
  iso: string,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return t('feed.justNow');
  if (m < 60) return t('feed.minutesAgo', { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('feed.hoursAgo', { h });
  return t('feed.daysAgo', { d: Math.floor(h / 24) });
};

export const ShowcasePostCard: React.FC<ShowcasePostCardProps> = ({ post, href, isNew }) => {
  const { t } = useLocale();
  const router = useRouter();
  const authorName = post.AUTHOR_NAME || t('feed.anonymous');
  // 사진/영상 + 첨부 앨범(오노추의 노래 포함)을 합친 목록의 첫 항목만
  // 썸네일로 보여준다 — 상세페이지의 캐러셀과 순서가 같아야 "첫 화면"이
  // 일관되게 느껴진다(앨범이 있으면 앨범 먼저, 없으면 사진/영상).
  const firstItem = buildShowcaseItems(post.albums || [], post.MEDIA_ITEMS || [])[0];
  const profileHref = `/user/${post.AUTHOR_ID}/dashboard${post.AUTHOR_NAME ? `?n=${encodeURIComponent(post.AUTHOR_NAME)}` : ''}`;

  return (
    <div
      className={`${styles.card} ${isNew ? styles.cardNew : ''}`}
      onClick={() => router.push(href)}
      role="button"
      tabIndex={0}
      style={{ cursor: 'pointer' }}
    >
      <div className={styles.header}>
        {post.AUTHOR_IMAGE ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={post.AUTHOR_IMAGE} alt="" className={styles.avatar} style={{ objectFit: 'cover' }} />
        ) : (
          <div className={styles.avatar}>{authorName.slice(0, 1).toUpperCase()}</div>
        )}
        <div className={styles.headerText}>
          <Link href={profileHref} className={styles.authorName} onClick={(e) => e.stopPropagation()}>
            {authorName}
          </Link>
          <span className={styles.metaLine}>
            {t(`communityBoard.categories.${post.CATEGORY}` as any)} · {relativeTime(post.CREATED_AT, t)}
          </span>
        </div>
      </div>

      {!firstItem ? (
        <div className={styles.mediaFallback}>
          <span className="material-symbols-outlined">photo_camera</span>
        </div>
      ) : firstItem.kind === 'video' ? (
        <video className={styles.media} src={firstItem.url} muted playsInline preload="metadata" />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img className={styles.media} src={firstItem.kind === 'album' ? firstItem.imageUrl || '' : firstItem.url} alt="" />
      )}

      <div className={styles.body}>
        <p className={styles.title}>{post.TITLE}</p>
        <p className={styles.content}>{post.CONTENT}</p>
      </div>

      <div className={styles.footer}>
        <span className={styles.stat}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>music_note</span>
          {t('communityBoard.resonanceCount', { count: post.LIKE_COUNT })}
        </span>
        <span className={styles.stat}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chat_bubble</span>
          {t('communityBoard.commentCount', { count: post.COMMENT_COUNT })}
        </span>
      </div>
    </div>
  );
};
