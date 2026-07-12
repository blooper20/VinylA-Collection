'use client';

import React from 'react';
import Link from 'next/link';
import { useLocale } from '@vinyla/i18n';
import styles from './unauthorized.module.css';

export default function UnauthorizedPage() {
  const { t } = useLocale();
  return (
    <div className={styles.container}>
      <div className={styles.noiseOverlay} />
      
      <div className={styles.content}>
        <img src="/logo.png" alt="VinylA Collection" className={styles.logo} />
        <div className={styles.iconWrapper}>
          <span className="material-symbols-outlined">gpp_bad</span>
        </div>
        <h1 className={styles.title}>{t('unauthorized.title')}</h1>
        <p className={styles.subtitle}>
          {t('unauthorized.subtitleLine1')}<br />
          {t('unauthorized.subtitleLine2')}
        </p>

        <Link href="/" className={styles.backButton}>
          <span className="material-symbols-outlined">home</span>
          {t('unauthorized.backHome')}
        </Link>
      </div>

      <div className={styles.vinylDecoration}>
        <div className={styles.brokenVinyl} />
      </div>
    </div>
  );
}
