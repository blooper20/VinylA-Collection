'use client';

import React from 'react';
import { useLocale } from '@vinyla/i18n';
import styles from './ComingSoonNotice.module.css';

// "로케이션" 카테고리 전용 안내 — 지도 SDK가 아직 없어 실제 글쓰기/목록
// 기능은 만들지 않고, 나중에 지도 기능이 붙으면 열릴 게시판이라는 걸
// 알리는 자리표시 화면만 둔다.
export const ComingSoonNotice: React.FC = () => {
  const { t } = useLocale();
  return (
    <div className={styles.wrap}>
      <span className="material-symbols-outlined" style={{ fontSize: 40 }}>map</span>
      <h2 className={styles.title}>{t('communityBoard.comingSoonTitle')}</h2>
      <p className={styles.desc}>{t('communityBoard.comingSoonDesc')}</p>
    </div>
  );
};
