'use client';

import React from 'react';
import styles from './page.module.css';
import { useAuthStore } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';

export default function LandingPage() {
  const { isLoading } = useAuthStore();
  const { locale, setLocale, t } = useLocale();

  const handleGoogleLogin = async () => {
    try {
      const { signInWithGoogle } = await import('@vinyla/core-api');
      await signInWithGoogle(window.location.origin + '/collection');
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  if (isLoading) return null;

  return (
    <div className={styles.container}>
      <div className={styles.localeToggle}>
        <button
          className={`${styles.localeToggleBtn} ${locale === 'ko' ? styles.localeToggleActive : ''}`}
          onClick={() => setLocale('ko')}
        >
          KO
        </button>
        <button
          className={`${styles.localeToggleBtn} ${locale === 'en' ? styles.localeToggleActive : ''}`}
          onClick={() => setLocale('en')}
        >
          EN
        </button>
      </div>

      <div className={styles.spotlight1} />
      <div className={styles.spotlight2} />

      <main className={styles.main}>
        <div className={styles.heroContent}>
          <img src="/logo.png" alt="VinylA Collection" className={styles.heroLogo} />
          <div className={styles.badge}>VinylA Collection</div>
          <h1 className={styles.title}>
            {t('landing.titleLine1')}<br />{t('landing.titleLine2')}
          </h1>
          <p className={styles.subtitle}>
            {t('landing.subtitleLine1')}<br />
            {t('landing.subtitleLine2')}
          </p>

          <button className={styles.ctaButton} onClick={handleGoogleLogin}>
            <span className="material-symbols-outlined">login</span>
            {t('landing.cta')}
          </button>
        </div>

        <div className={styles.visualSection}>
          <div className={styles.vinylWrapper}>
            <div className={styles.vinylRecord}>
              <div className={styles.vinylLabel}>
                <span className="material-symbols-outlined">album</span>
              </div>
            </div>
            <div className={styles.albumCover}>
              <div className={styles.coverReflection} />
              <img src="https://images.unsplash.com/photo-1535905557558-afc4877a26fc?q=80&w=1000&auto=format&fit=crop" alt="Vinyl Cover" />
            </div>
          </div>
        </div>
      </main>

      <section className={styles.features}>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <span className="material-symbols-outlined">search</span>
          </div>
          <h3>{t('landing.feature1Title')}</h3>
          <p>{t('landing.feature1Desc')}</p>
        </div>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <span className="material-symbols-outlined">gallery_thumbnail</span>
          </div>
          <h3>{t('landing.feature2Title')}</h3>
          <p>{t('landing.feature2Desc')}</p>
        </div>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <span className="material-symbols-outlined">military_tech</span>
          </div>
          <h3>{t('landing.feature3Title')}</h3>
          <p>{t('landing.feature3Desc')}</p>
        </div>
      </section>
    </div>
  );
}
