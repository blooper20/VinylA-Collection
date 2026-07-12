'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from '@vinyla/i18n';
import styles from './not-found.module.css';

export default function NotFound() {
  const { t } = useLocale();
  return (
    <div className={styles.container}>
      <div className={styles.noiseOverlay} />
      
      <div className={styles.content}>
        <img src="/logo.png" alt="VinylA Collection" className={styles.logo} />
        <div className={styles.errorCode}>404</div>
        <h1 className={styles.title}>{t('notFound.title')}</h1>
        <p className={styles.subtitle}>
          {t('notFound.subtitleLine1')}<br />
          {t('notFound.subtitleLine2')}
        </p>

        <Link href="/" className={styles.backButton}>
          <span className="material-symbols-outlined">home</span>
          {t('notFound.backHome')}
        </Link>
      </div>

      <div className={styles.vinylDecoration}>
        <div className={styles.brokenVinyl} />
      </div>
    </div>
  );
}
