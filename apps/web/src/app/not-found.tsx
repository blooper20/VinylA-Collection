'use client';

import React from 'react';
import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <div className={styles.container}>
      <div className={styles.noiseOverlay} />
      
      <div className={styles.content}>
        <div className={styles.errorCode}>404</div>
        <h1 className={styles.title}>Track Not Found</h1>
        <p className={styles.subtitle}>
          존재하지 않는 페이지입니다.<br />
          바늘이 레코드판 바깥을 맴돌고 있네요.
        </p>
        
        <Link href="/" className={styles.backButton}>
          <span className="material-symbols-outlined">home</span>
          홈으로 돌아가기
        </Link>
      </div>

      <div className={styles.vinylDecoration}>
        <div className={styles.brokenVinyl} />
      </div>
    </div>
  );
}
