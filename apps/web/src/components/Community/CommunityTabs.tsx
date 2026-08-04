'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from '@vinyla/i18n';
import { CommunityPostCategory } from '@vinyla/shared-types';
// PageTabs와 같은 상단 탭바 스타일을 재사용 — 다만 이건 라우트 간 이동이
// 아니라 /community 한 페이지 안에서 ?tab= 쿼리로만 갈아끼우는 탭이라
// PageTabs 컴포넌트 자체(pathname 기반 active 판정)는 재사용할 수 없다.
import styles from '../Navigation/PageTabs.module.css';

export type CommunityTabKey = 'ALL' | 'NOTICE' | 'FREE' | 'SHOWCASE' | 'INFO' | 'LOCATION';

// 게시판을 하나로 통합하고 실제 DB 카테고리는 상단 탭으로 묶는다: 전체(모든 카테고리),
// 자유게시판, 자랑(오온음+나만의 청음실+컬렉션+위시리스트), 정보(정보+팁+Q&A), 로케이션(자리표시).
// 이 SHOWCASE/INFO 그룹핑은 글쓰기 화면(community/new/page.tsx)의 부모→하위
// 카테고리 탭 구조에도 그대로 재사용된다 — 브라우징과 글쓰기가 같은 분류를 쓰게.
// 공지사항은 COMMUNITY_POST가 아니라 별도 NOTICE 테이블이라 categories가 없다 —
// community/page.tsx에서 이 탭만 getNotices로 따로 조회한다.
export const COMMUNITY_TABS: { key: CommunityTabKey; categories: CommunityPostCategory[] }[] = [
  { key: 'ALL', categories: ['FREE', 'ARRIVAL', 'LISTENING_ROOM', 'COLLECTION', 'WISHLIST', 'INFO', 'TIP', 'QNA'] },
  { key: 'NOTICE', categories: [] },
  { key: 'FREE', categories: ['FREE'] },
  { key: 'SHOWCASE', categories: ['ARRIVAL', 'LISTENING_ROOM', 'COLLECTION', 'WISHLIST'] },
  { key: 'INFO', categories: ['INFO', 'TIP', 'QNA'] },
  { key: 'LOCATION', categories: [] },
];

export const CommunityTabs: React.FC<{ active: CommunityTabKey }> = ({ active }) => {
  const { t } = useLocale();

  return (
    <div className={styles.tabBar}>
      {COMMUNITY_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/community?tab=${tab.key}`}
          className={`${styles.tab} ${tab.key === active ? styles.tabActive : ''}`}
        >
          {t(`communityBoard.tabs.${tab.key}` as any)}
        </Link>
      ))}
    </div>
  );
};
