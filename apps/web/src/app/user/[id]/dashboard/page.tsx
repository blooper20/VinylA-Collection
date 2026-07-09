'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getUserVinyls, mapToFrontendModel, useAuthStore, BADGES } from '@vinyla/core-api';
import { DetailModal } from '../../../../components/Modal/DetailModal';
import styles from '../../../my/page.module.css';
import dashStyles from './dashboard.module.css';

type TabType = 'timeline' | 'collection' | 'wishlist';

function PublicDashboardContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  
  const displayName = decodeURIComponent(searchParams?.get('n') || 'Collector');
  const avatarUrl = decodeURIComponent(searchParams?.get('a') || '/logo.png');
  const selectedBadgeId = searchParams?.get('b') || null;
  const topGenre = decodeURIComponent(searchParams?.get('g') || '-');
  const featuredAlbumId = decodeURIComponent(searchParams?.get('f') || '');
  const isSpentPublic = searchParams?.get('sp') === '1';

  const selectedBadgeObj = selectedBadgeId ? BADGES.find(b => b.id === selectedBadgeId) : null;

  const [actualSpentValue, setActualSpentValue] = useState(0);
  const [ownedCount, setOwnedCount] = useState(0);
  const [actualTopGenre, setActualTopGenre] = useState('-');
  const [recentAdditions, setRecentAdditions] = useState<any[]>([]);
  const [ownedAlbums, setOwnedAlbums] = useState<any[]>([]);
  const [wishAlbums, setWishAlbums] = useState<any[]>([]);
  const [featuredAlbum, setFeaturedAlbum] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<any | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const { user, initializeAuth } = useAuthStore();

  useEffect(() => { initializeAuth(); }, []);

  useEffect(() => {
    async function loadStats() {
      if (!id) return;
      setIsLoading(true);
      
      try {
        // Fetch raw data to get ALBUM_ID before mapping
        const data = await getUserVinyls(id);
        
        if (data && data.length > 0) {
          // Map all data first
          const mapped = data.map((v: any) => mapToFrontendModel(v, null));
          const mappedOwned = mapped.filter((v: any) => v.STATUS === 'OWNED');
          const mappedWish = mapped.filter((v: any) => v.STATUS === 'WISH');

          // Find featured album by comparing ALBUM_ID as strings (handles int vs string mismatch)
          let foundFeatured: any = null;
          if (featuredAlbumId) {
            foundFeatured = mapped.find((a: any) => 
              String(a.ALBUM_ID) === String(featuredAlbumId)
            ) || null;
          }
          setFeaturedAlbum(foundFeatured);
          
          setOwnedCount(mappedOwned.length);
          setOwnedAlbums(mappedOwned);
          setWishAlbums(mappedWish);

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
        }
      } finally {
        setIsLoading(false);
      }
    }
    
    loadStats();
  }, [id, featuredAlbumId]);

  if (!id) return null;

  const handleAlbumClick = (album: any) => {
    if (!user) {
      setShowLoginPrompt(true);
    } else {
      setSelectedAlbum(album);
    }
  };

  const stats = [
    ...(isSpentPublic ? [{ label: '실제 지출액', value: actualSpentValue.toLocaleString(), unit: '₩', sub: '입력된 구매가 합산' }] : []),
    { label: '보유 LP',        value: ownedCount.toLocaleString(), unit: '', sub: '등록된 전체 LP 수' },
    { label: '관심 장르',      value: topGenre,      unit: '', sub: '프로필 설정 기준' },
    { label: '실제 관심 장르', value: actualTopGenre, unit: '', sub: '내 콜렉션 데이터 기준' },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroInner}>
          <div className={styles.avatarRing}>
            <img src={avatarUrl} alt="프로필" className={styles.avatarImage} />
          </div>

          <div className={styles.profileInfo}>
            <p className={styles.profileEyebrow}>VinylA Collection Member</p>
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
            <div className={styles.featuredFrame} style={{ cursor: 'default' }}>
              {isLoading ? (
                <div className={styles.featuredEmpty} style={{ cursor: 'default' }}>
                  <span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite' }}>progress_activity</span>
                </div>
              ) : featuredAlbum ? (
                <>
                  <img src={featuredAlbum.COVER_URL || featuredAlbum.IMAGE_URL} alt={featuredAlbum.TITLE} className={styles.featuredCover} />
                  {featuredAlbum.STATUS === 'WISH' && (
                    <div className={styles.featuredWishBadge}>WISH</div>
                  )}
                </>
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

      {/* Stats */}
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

      {/* Tabs */}
      <section className={dashStyles.tabSection}>
        <div className={dashStyles.tabBar}>
          <button className={`${dashStyles.tab} ${activeTab === 'timeline' ? dashStyles.tabActive : ''}`} onClick={() => setActiveTab('timeline')}>
            최근 수집 기록
          </button>
          <button className={`${dashStyles.tab} ${activeTab === 'collection' ? dashStyles.tabActive : ''}`} onClick={() => setActiveTab('collection')}>
            보유 LP <span className={dashStyles.tabCount}>{ownedCount}</span>
          </button>
          <button className={`${dashStyles.tab} ${activeTab === 'wishlist' ? dashStyles.tabActive : ''}`} onClick={() => setActiveTab('wishlist')}>
            위시리스트 <span className={dashStyles.tabCount}>{wishAlbums.length}</span>
          </button>
        </div>

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div className={styles.timeline} style={{ padding: '0 40px' }}>
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
        )}

        {/* Collection Tab */}
        {activeTab === 'collection' && (
          <div className={dashStyles.albumGrid}>
            {ownedAlbums.length > 0 ? ownedAlbums.map((album, i) => (
              <div key={i} className={dashStyles.albumCard} onClick={() => handleAlbumClick(album)} style={{ cursor: 'pointer' }}>
                <img src={album.COVER_URL || album.IMAGE_URL} alt={album.TITLE} className={dashStyles.albumCover} />
                <p className={dashStyles.albumTitle}>{album.TITLE}</p>
                <p className={dashStyles.albumArtist}>{album.ARTIST}</p>
              </div>
            )) : (
              <p style={{ color: 'rgba(255,255,255,0.5)', padding: '24px' }}>보유 LP가 없습니다.</p>
            )}
          </div>
        )}

        {/* Wishlist Tab */}
        {activeTab === 'wishlist' && (
          <div className={dashStyles.albumGrid}>
            {wishAlbums.length > 0 ? wishAlbums.map((album, i) => (
              <div key={i} className={dashStyles.albumCard} onClick={() => handleAlbumClick(album)} style={{ cursor: 'pointer' }}>
                <img src={album.COVER_URL || album.IMAGE_URL} alt={album.TITLE} className={dashStyles.albumCover} />
                <p className={dashStyles.albumTitle}>{album.TITLE}</p>
                <p className={dashStyles.albumArtist}>{album.ARTIST}</p>
              </div>
            )) : (
              <p style={{ color: 'rgba(255,255,255,0.5)', padding: '24px' }}>위시리스트가 없습니다.</p>
            )}
          </div>
        )}
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

      {selectedAlbum && <DetailModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />}

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div onClick={() => setShowLoginPrompt(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(8px)'
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#1a1814',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '24px',
            padding: '48px 40px',
            width: '360px',
            textAlign: 'center',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#d4af37', marginBottom: '16px', display: 'block', fontVariationSettings: "'FILL' 1" }}>lock</span>
            <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 12px' }}>로그인이 필요해요</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '0 0 32px' }}>
              LP 상세 정보는 VinylA 회원만 볼 수 있어요.<br />로그인 후 이용해 주세요.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowLoginPrompt(false)} style={{
                flex: 1, padding: '14px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)', fontSize: '15px', cursor: 'pointer'
              }}>취소</button>
              <a href="/login" style={{
                flex: 1, padding: '14px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #d4af37, #f3e5ab)',
                color: '#111', fontSize: '15px', fontWeight: 700,
                textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>로그인</a>
            </div>
          </div>
        </div>
      )}
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
