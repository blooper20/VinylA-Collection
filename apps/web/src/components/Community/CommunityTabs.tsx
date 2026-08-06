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
// 자유게시판, 정보(정보+팁+Q&A), 로케이션(자리표시). 자랑(오온음+나만의 청음실+컬렉션+
// 위시리스트+오노추)은 /feed(소셜 피드)로 흡수돼 더 이상 게시판 탭에 노출하지 않는다
// (2026-08-06) — 그래도 SHOWCASE 항목 자체는 지우지 않고 남겨둔다: 글쓰기 화면
// (community/new/page.tsx)이 이 카테고리 그룹핑을 그대로 가져다 부모→하위 탭
// 구조를 만들기 때문. 브라우징 탭 목록에서만 걸러낸다(NAV_TAB_KEYS).
// 공지사항은 COMMUNITY_POST가 아니라 별도 NOTICE 테이블이라 categories가 없다 —
// community/page.tsx에서 이 탭만 getNotices로 따로 조회한다.
export const COMMUNITY_TABS: { key: CommunityTabKey; categories: CommunityPostCategory[] }[] = [
  { key: 'ALL', categories: ['FREE', 'INFO', 'TIP', 'QNA'] },
  { key: 'NOTICE', categories: [] },
  { key: 'FREE', categories: ['FREE'] },
  { key: 'SHOWCASE', categories: ['ARRIVAL', 'LISTENING_ROOM', 'COLLECTION', 'WISHLIST', 'ONOCHU'] },
  { key: 'INFO', categories: ['INFO', 'TIP', 'QNA'] },
  { key: 'LOCATION', categories: [] },
];

const NAV_TAB_KEYS: CommunityTabKey[] = ['ALL', 'NOTICE', 'FREE', 'INFO', 'LOCATION'];

export const CommunityTabs: React.FC<{ active: CommunityTabKey }> = ({ active }) => {
  const { t } = useLocale();

  return (
    <div className={styles.tabBar}>
      {COMMUNITY_TABS.filter((tab) => NAV_TAB_KEYS.includes(tab.key)).map((tab) => (
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
