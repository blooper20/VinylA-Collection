'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@vinyla/i18n';
import styles from './PageTabs.module.css';

// 사이드바 메뉴 통합: '소셜'(피드/커뮤니티), '컬렉션'(컬렉션/위시리스트).
// 기존 라우트를 그대로 두고 탭이 Link로 오가므로 공유 링크/딥링크가 유지된다.
// 다이어리(스피닝 다이어리)는 공개 기록이 피드에 그대로 섞여 나오므로 별도
// 탭을 두지 않는다(2026-08-06) — /log 자체는 비공개 기록 열람·수정·삭제 등
// 피드에는 없는 개인 관리 기능이 있어 라우트는 남겨두고, 여기 탭 목록에서만 뺐다.
// 커뮤니티는 자랑 카테고리가 피드로 흡수된 뒤 남은 자유게시판/정보/공지사항
// 게시판이라 소셜의 두 번째 탭으로 합쳤다(2026-08-06).
const GROUPS = {
  social: [
    { labelKey: 'nav.feed', path: '/feed', icon: 'rss_feed' },
    { labelKey: 'communityBoard.pageTitle', path: '/community', icon: 'forum' },
  ],
  collection: [
    { labelKey: 'nav.collection', path: '/collection', icon: 'shelves' },
    { labelKey: 'nav.wishlist', path: '/wishlist', icon: 'bookmark' },
  ],
} as const;

export const PageTabs: React.FC<{ group: keyof typeof GROUPS }> = ({ group }) => {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <div className={styles.tabBar}>
      {GROUPS[group].map((tab) => {
        // 커뮤니티는 /community/[postId]처럼 하위 경로가 많아 정확히 일치하는
        // 경로만 볼 게 아니라 그 아래 전부를 활성으로 봐야 탭이 계속 켜져 있다.
        const isActive = pathname === tab.path || pathname.startsWith(`${tab.path}/`);
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
          >
            <span
              className={`material-symbols-outlined ${styles.tabIcon}`}
              style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
            >
              {tab.icon}
            </span>
            {t(tab.labelKey as Parameters<typeof t>[0])}
          </Link>
        );
      })}
    </div>
  );
};
