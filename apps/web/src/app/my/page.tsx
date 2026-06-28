'use client';

import React, { useEffect, useState } from 'react';
import styles from './page.module.css';
import { useAuthStore, getUserVinyls, mapToFrontendModel } from '@vinyla/core-api';

export default function MyProfilePage() {
  const { user, initializeAuth } = useAuthStore();
  const [collectionValue, setCollectionValue] = useState(0);
  const [ownedCount, setOwnedCount] = useState(0);
  const [topGenre, setTopGenre] = useState('-');
  const [recentAdditions, setRecentAdditions] = useState<any[]>([]);

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    async function loadStats() {
      if (!user) return;
      const data = await getUserVinyls(user.id);
      if (data && data.length > 0) {
        const mapped = data.map(v => mapToFrontendModel(v, null));
        const owned = mapped.filter(v => v.STATUS === 'OWNED');
        
        setOwnedCount(owned.length);
        
        const value = owned.reduce((sum, item) => sum + (item.PURCHASE_PRICE || 0), 0);
        setCollectionValue(value);

        if (user.user_metadata?.interests && user.user_metadata.interests.length > 0) {
          setTopGenre(user.user_metadata.interests[0]);
        }

        // timeline: top 3 recent additions
        // Assuming we have some date or just taking the last 3 for now
        setRecentAdditions(owned.slice(0, 3));
      } else {
        if (user.user_metadata?.interests && user.user_metadata.interests.length > 0) {
          setTopGenre(user.user_metadata.interests[0]);
        }
      }
    }
    loadStats();
  }, [user]);

  const stats = [
    { label: '컬렉션 가치',  value: collectionValue.toLocaleString(), unit: '₩', sub: '시장 추정가 기준' },
    { label: '보유 LP',      value: ownedCount.toLocaleString(),       unit: '',   sub: '등록된 전체 LP 수' },
    { label: '관심 장르',    value: topGenre,      unit: '',   sub: '프로필 설정 기준' },
  ];

  const displayName = user?.user_metadata?.displayName || 'Collector';
  const avatarUrl = user?.user_metadata?.avatar_url || 'https://i.pravatar.cc/150?img=32';

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroInner}>
          <div className={styles.avatarRing}>
            <img
              src={avatarUrl}
              alt="프로필"
              className={styles.avatarImage}
            />
            <div className={styles.avatarBadge}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
          </div>

          <div className={styles.profileInfo}>
            <p className={styles.profileEyebrow}>Vinyl Noir Member</p>
            <h1 className={styles.profileName}>{displayName}</h1>
            <div className={styles.collectorBadge}>
              <span className={`material-symbols-outlined ${styles.collectorBadgeIcon}`} style={{ fontVariationSettings: "'FILL' 1", fontSize: '13px' }}>diamond</span>
              <span className={styles.collectorBadgeText}>Verified Collector</span>
            </div>
          </div>
        </div>
      </header>

      <section className={styles.analytics}>
        <div className={styles.analyticsGrid}>
          {stats.map((stat, i) => (
            <div key={i} className={styles.statCard}>
              <span className={styles.statLabel}>{stat.label}</span>
              <div className={styles.statValue}>
                {stat.unit && <span className={styles.statUnit}>{stat.unit}</span>}
                {stat.value}
              </div>
              <div className={styles.statSub}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.journey}>
        <div className={styles.journeySectionHeader}>
          <div className={styles.journeyAccentLine} />
          <h2 className={styles.journeySectionTitle}>최근 수집 기록</h2>
        </div>
        <div className={styles.timeline}>
          {recentAdditions.length > 0 ? recentAdditions.map((item, i) => (
            <div key={i} className={styles.timelineItem}>
              <div className={styles.timelineDot} />
              <img src={item.COVER_URL || item.IMAGE_URL} alt={item.TITLE} className={styles.timelineImage} />
              <div className={styles.timelineText}>
                <span className={styles.timelineDate}>Recently Added</span>
                <div className={styles.timelineTitle}>{item.TITLE}</div>
                <div className={styles.timelineDesc}>{item.ARTIST}</div>
              </div>
            </div>
          )) : (
            <p style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 24, marginTop: 16 }}>아직 기록된 LP가 없습니다.</p>
          )}
        </div>
      </section>

      <section className={styles.actions}>
        <button className={styles.btnPrimary}>컬렉션 편집</button>
        <button className={styles.btnSecondary} onClick={() => useAuthStore.getState().initializeAuth()}>데이터 동기화</button>
      </section>
    </div>
  );
}
