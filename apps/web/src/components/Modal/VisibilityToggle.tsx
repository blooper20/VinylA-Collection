'use client';

import React from 'react';
import styles from './VisibilityToggle.module.css';
import { useLocale } from '@vinyla/i18n';

// 스피닝 다이어리 기록의 공개/비공개 토글 — 재킷 커버의 "나만 보기/전체
// 공개" 토글과 같은 세그먼트 버튼 UI. 작성 시트(신규)와 /log 인라인 수정
// 폼(기존 기록) 양쪽에서 재사용된다.
export const VisibilityToggle: React.FC<{
  value: boolean; // true = 공개
  onChange: (isPublic: boolean) => void;
  disabled?: boolean;
  t: ReturnType<typeof useLocale>['t'];
}> = ({ value, onChange, disabled, t }) => (
  <div className={styles.toggle} role="radiogroup" aria-label={t('detail.spinLogVisibilityLabel')}>
    <button
      type="button"
      className={`${styles.btn} ${value ? styles.active : ''}`}
      onClick={() => onChange(true)}
      disabled={disabled}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>public</span>
      {t('detail.spinLogPublic')}
    </button>
    <button
      type="button"
      className={`${styles.btn} ${!value ? styles.active : ''}`}
      onClick={() => onChange(false)}
      disabled={disabled}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>
      {t('detail.spinLogPrivate')}
    </button>
  </div>
);
