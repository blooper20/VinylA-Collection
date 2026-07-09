'use client';

import React from 'react';
import styles from './page.module.css';
import { useAuthStore } from '@vinyla/core-api';

export default function LandingPage() {
  const { isLoading } = useAuthStore();

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
      <div className={styles.spotlight1} />
      <div className={styles.spotlight2} />
      
      <main className={styles.main}>
        <div className={styles.heroContent}>
          <img src="/logo.png" alt="VinylA Collection" className={styles.heroLogo} />
          <div className={styles.badge}>VinylA Collection</div>
          <h1 className={styles.title}>
            당신만의 프리미엄<br />바이닐 아카이브
          </h1>
          <p className={styles.subtitle}>
            빛바랜 LP부터 방금 뜯은 신보까지.<br />
            가장 아름다운 형태로 당신의 음악을 수집하세요.
          </p>
          
          <button className={styles.ctaButton} onClick={handleGoogleLogin}>
            <span className="material-symbols-outlined">login</span>
            Google 계정으로 시작하기
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
          <h3>10초 만에 끝나는 등록</h3>
          <p>Discogs API 연동으로 앨범명만 입력하면 모든 정보를 자동으로 불러옵니다.</p>
        </div>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <span className="material-symbols-outlined">gallery_thumbnail</span>
          </div>
          <h3>미니멀 갤러리 뷰</h3>
          <p>복잡한 데이터는 숨기고 오직 아름다운 앨범 커버에만 집중할 수 있습니다.</p>
        </div>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>
            <span className="material-symbols-outlined">military_tech</span>
          </div>
          <h3>컬렉터 호칭 시스템</h3>
          <p>보유 장수와 장르에 따라 특별한 호칭을 획득하고 프로필에 장착해보세요.</p>
        </div>
      </section>
    </div>
  );
}
