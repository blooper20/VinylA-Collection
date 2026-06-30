'use client';

import React from 'react';
import Link from 'next/link';
import styles from './unauthorized.module.css';

export default function UnauthorizedPage() {
  return (
    <div className={styles.container}>
      <div className={styles.noiseOverlay} />
      
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <span className="material-symbols-outlined">gpp_bad</span>
        </div>
        <h1 className={styles.title}>잘못된 접근입니다</h1>
        <p className={styles.subtitle}>
          접근 권한이 없거나 이미 탈퇴 처리된 계정입니다.<br />
          다시 로그인하거나 메인 화면으로 돌아가주세요.
        </p>
        
        <Link href="/" className={styles.backButton}>
          <span className="material-symbols-outlined">home</span>
          메인으로 가기
        </Link>
      </div>
    </div>
  );
}
