'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getUserVinyls, mapToFrontendModel } from '@vinyla/core-api';
import { BADGES } from '../../../../lib/badges';
import styles from '../../../my/page.module.css';

function PublicDashboardContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  
  const displayName = searchParams?.get('n') || 'Collector';
  const avatarUrl = searchParams?.get('a') || '/logo.png';
  const selectedBadgeId = searchParams?.get('b') || null;
  const topGenre = searchParams?.get('g') || '-';
  const featuredAlbumId = searchParams?.get('f') || null;

  const selectedBadgeObj = selectedBadgeId ? BADGES.find(b => b.id === selectedBadgeId) : null;

  const [collectionValue, setCollectionValue] = useState(0);
  const [actualSpentValue, setActualSpentValue] = useState(0);
  const [ownedCount, setOwnedCount] = useState(0);
  const [actualTopGenre, setActualTopGenre] = useState('-');
  const [recentAdditions, setRecentAdditions] = useState<any[]>([]);
  const [featuredAlbum, setFeaturedAlbum] = useState<any | null>(null);

  useEffect(() => {
    async function loadStats() {
      if (!id) return;
      const data = await getUserVinyls(id);
      
      if (data && data.length > 0) {
        const mapped = data.map((v: any) => mapToFrontendModel(v, null));
        const mappedOwned = mapped.filter((v: any) => v.STATUS === 'OWNED');
        
        setOwnedCount(mappedOwned.length);
        
        // Calculate estimated market value
        const value = mappedOwned.reduce((sum: number, item: any) => sum + (item.MARKET_PRICE || 0), 0);
        setCollectionValue(value);

        // Calculate actual spent cost
        const spent = mappedOwned.reduce((sum: number, item: any) => sum + (item.PURCHASE_PRICE || 0), 0);
        setActualSpentValue(spent);

        // Compute actual top genre
        const genreCounts: Record<string, number> = {};
        mappedOwned.forEach((item: any) => {
          if (item.GENRES && Array.isArray(item.GENRES)) {
            item.GENRES.forEach((g: string) => {
              genreCounts[g] = (genreCounts[g] || 0) + 1;
            });
          }
        });
        
        if (Object.keys(genreCounts).length > 0) {
          const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
          setActualTopGenre(sortedGenres[0][0]);
        } else {
          setActualTopGenre('-');
        }

        setRecentAdditions(mappedOwned.slice(0, 3));

        if (featuredAlbumId) {
          const featured = mapped.find((a: any) => a.ALBUM_ID === featuredAlbumId);
          if (featured) setFeaturedAlbum(featured);
        }
      } else {
        setActualTopGenre('-');
      }
    }
    
    loadStats();
  }, [id, featuredAlbumId]);

  if (!id) return null;

  const stats = [
    { label: '시장 추정가',  value: collectionValue.toLocaleString(), unit: '₩', sub: 'Discogs 기준 최저가 합산' },
    { label: '실제 지출액',  value: actualSpentValue.toLocaleString(), unit: '₩', sub: '입력된 구매가 합산' },
    { label: '보유 LP',      value: ownedCount.toLocaleString(),       unit: '',   sub: '등록된 전체 LP 수' },
    { label: '관심 장르',    value: topGenre,      unit: '',   sub: '프로필 설정 기준' },
    { label: '실제 관심 장르', value: actualTopGenre,  unit: '',   sub: '내 콜렉션 데이터 기준' },
  ];

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
            <p className={styles.profileEyebrow}>VinylA Member</p>
            <div className={styles.nameRow}>
              <h1 className={styles.profileName}>{displayName}</h1>
            </div>
            <div className={styles.collectorBadge}>
              <span className={`material-symbols-outlined ${styles.collectorBadgeIcon}`} style={{ fontVariationSettings: "'FILL' 1", fontSize: '13px' }}>
                {selectedBadgeObj ? selectedBadgeObj.icon : 'diamond'}
              </span>
              <span className={styles.collectorBadgeText}>
                {selectedBadgeObj ? selectedBadgeObj.name : 'Verified Collector'}
              </span>
            </div>
          </div>

          <div className={styles.featuredContainer}>
            <div className={styles.featuredFrame}>
              {featuredAlbum ? (
                <img src={featuredAlbum.COVER_URL || featuredAlbum.IMAGE_URL} alt={featuredAlbum.TITLE} className={styles.featuredCover} />
              ) : (
                <div className={styles.featuredEmpty} style={{ cursor: 'default' }}>
                  <span className="material-symbols-outlined">album</span>
                  <p>No Featured LP</p>
                </div>
              )}
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
      
      <div style={{ padding: '60px 40px', display: 'flex', justifyContent: 'center' }}>
        <Link href={`/user/${id}?n=${encodeURIComponent(displayName)}&a=${encodeURIComponent(avatarUrl)}`} style={{
            background: 'linear-gradient(135deg, #d4af37, #f3e5ab)',
            color: '#111',
            padding: '16px 32px',
            borderRadius: '100px',
            fontSize: '18px',
            fontWeight: 700,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(212, 175, 55, 0.3)'
        }}>
          이 컬렉터의 보관함 구경하기
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}

export default function PublicDashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading...</div>}>
      <PublicDashboardContent />
    </Suspense>
  );
}
