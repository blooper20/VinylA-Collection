import React, { forwardRef } from 'react';
import styles from './ShareableProfileTemplate.module.css';

interface ShareableProfileTemplateProps {
  user: any;
  stats: {
    collectionValue: number;
    actualSpentValue: number;
    ownedCount: number;
    topGenre: string;
    actualTopGenre: string;
  };
  featuredAlbum: any | null;
  selectedBadgeObj: any | null;
}

export const ShareableProfileTemplate = forwardRef<HTMLDivElement, ShareableProfileTemplateProps>(
  ({ user, stats, featuredAlbum, selectedBadgeObj }, ref) => {
    
    const displayName = user?.user_metadata?.displayName || 'Collector';
    const avatarUrl = user?.user_metadata?.avatar_url || '/logo.png';

    return (
      <div className={styles.offscreenContainer}>
        <div ref={ref} className={styles.profileFrame}>
          <div className={styles.profileBg} />
          
          <div className={styles.contentWrapper}>
            {/* Top Section */}
            <div className={styles.headerRow}>
              <div className={styles.userInfo}>
                <div className={styles.avatarRing}>
                  <img
                    src={`/api/proxy-image?url=${encodeURIComponent(avatarUrl)}`}
                    alt="Profile"
                    className={styles.avatarImage}
                    crossOrigin="anonymous"
                  />
                </div>
                
                <div className={styles.profileDetails}>
                  <span className={styles.eyebrow}>VinylA Member</span>
                  <h1 className={styles.displayName}>{displayName}</h1>
                  
                  <div className={styles.badgeTag}>
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '24px' }}>
                      {selectedBadgeObj ? selectedBadgeObj.icon : 'diamond'}
                    </span>
                    <span>{selectedBadgeObj ? selectedBadgeObj.name : 'Verified Collector'}</span>
                  </div>
                </div>
              </div>

              {/* Featured Album */}
              <div className={styles.featuredBox}>
                {featuredAlbum ? (
                  <img 
                    src={`/api/proxy-image?url=${encodeURIComponent(featuredAlbum.COVER_URL || featuredAlbum.IMAGE_URL)}`} 
                    alt={featuredAlbum.TITLE} 
                    className={styles.featuredCover} 
                    crossOrigin="anonymous" 
                  />
                ) : (
                  <div className={styles.featuredEmpty}>
                    <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '16px' }}>album</span>
                    <span>No Featured LP</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className={styles.statsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>시장 추정가</span>
                <div className={styles.statValue}>
                  <span className={styles.statUnit}>₩</span>
                  {stats.collectionValue.toLocaleString()}
                </div>
                <div className={styles.statSub}>Discogs 기준 최저가 합산</div>
              </div>

              <div className={styles.statItem}>
                <span className={styles.statLabel}>보유 LP</span>
                <div className={styles.statValue}>{stats.ownedCount.toLocaleString()}</div>
                <div className={styles.statSub}>등록된 전체 LP 수</div>
              </div>

              <div className={styles.statItem}>
                <span className={styles.statLabel}>관심 장르</span>
                <div className={styles.statValue}>{stats.topGenre}</div>
                <div className={styles.statSub}>프로필 설정 기준</div>
              </div>
            </div>

            {/* Footer */}
            <div className={styles.footer}>
              <img 
                src="/logo_transparent.png" 
                alt="VinylA Logo" 
                style={{ width: '50px', height: '50px', objectFit: 'contain' }} 
                onError={(e) => { e.currentTarget.src = '/logo.png'; e.currentTarget.style.mixBlendMode = 'screen'; }} 
                crossOrigin="anonymous" 
              />
              <span className={styles.brand}>Curated by VinylA</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ShareableProfileTemplate.displayName = 'ShareableProfileTemplate';
