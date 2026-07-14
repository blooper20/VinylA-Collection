'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getUserVinyls, mapToFrontendModel, useAuthStore, BADGES, getBadgeText, getSignupNumber, followUser, unfollowUser, getMyFollowingIds, getFollowCounts, getProfileInfo, requestFollow, cancelFollowRequest, getMyOutgoingRequestIds, getPublicListeningLog, ListeningLogWithAlbum, getSpinSocialSummary, SpinSocialSummary } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { DetailModal } from '../../../../components/Modal/DetailModal';
import { FollowListModal } from '../../../../components/Modal/FollowListModal';
import { SpinSocialModal } from '../../../../components/Modal/SpinSocialModal';
import { SpinSocialActions } from '../../../../components/SpinSocialActions';
import styles from '../../../my/page.module.css';
import dashStyles from './dashboard.module.css';

type TabType = 'timeline' | 'collection' | 'wishlist' | 'diary';
type VinylItem = ReturnType<typeof mapToFrontendModel>;

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
  const [recentAdditions, setRecentAdditions] = useState<VinylItem[]>([]);
  const [ownedAlbums, setOwnedAlbums] = useState<VinylItem[]>([]);
  const [wishAlbums, setWishAlbums] = useState<VinylItem[]>([]);
  const [featuredAlbum, setFeaturedAlbum] = useState<VinylItem | null>(null);
  // 공유 링크(?tab=diary)로 들어오면 다이어리 탭을 바로 연다
  const [activeTab, setActiveTab] = useState<TabType>(
    searchParams?.get('tab') === 'diary' ? 'diary' : 'timeline'
  );
  // null = 아직 안 불러옴 — 다이어리 탭을 처음 열 때 지연 로딩
  const [diaryEntries, setDiaryEntries] = useState<ListeningLogWithAlbum[] | null>(null);
  const [diarySocialMap, setDiarySocialMap] = useState<Record<number, SpinSocialSummary>>({});
  const [socialEntry, setSocialEntry] = useState<ListeningLogWithAlbum | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<VinylItem | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [viewerStatusMap, setViewerStatusMap] = useState<Record<string, 'OWNED' | 'WISH'>>({});
  const [signupNumber, setSignupNumber] = useState<number | null>(null);
  // none → (공개) 바로 팔로우 / (비공개) 요청 → requested → 상대 수락 시 following
  const [followStatus, setFollowStatus] = useState<'none' | 'requested' | 'following'>('none');
  const [followCounts, setFollowCounts] = useState<{ followers: number; following: number } | null>(null);
  const [followListTab, setFollowListTab] = useState<'followers' | 'following' | null>(null);
  // null = 아직 모름(로딩 중) — 잠금 화면 깜빡임 방지
  const [ownerIsPublic, setOwnerIsPublic] = useState<boolean | null>(null);

  const { user, initializeAuth } = useAuthStore();
  const { locale, t } = useLocale();

  useEffect(() => {
    if (!id) return;
    getFollowCounts(id).then(setFollowCounts).catch(() => setFollowCounts(null));
    // 조회 실패 시 비공개 취급 (privacy-first) — 실제 차단은 어차피 RLS가 한다
    getProfileInfo(id).then((p) => setOwnerIsPublic(p.IS_PUBLIC)).catch(() => setOwnerIsPublic(false));
  }, [id]);

  useEffect(() => {
    if (!user?.id || user.id === id) return;
    Promise.all([getMyFollowingIds(), getMyOutgoingRequestIds()]).then(([following, requested]) => {
      setFollowStatus(following.has(id) ? 'following' : requested.has(id) ? 'requested' : 'none');
    });
  }, [user?.id, id]);

  // 공개: 팔로우 ↔ 팔로잉 토글. 비공개: 요청 ↔ 요청 취소 (수락돼야 팔로잉).
  const toggleFollow = async () => {
    const prev = followStatus;
    try {
      if (prev === 'following') {
        setFollowStatus('none');
        setFollowCounts((c) => (c ? { ...c, followers: Math.max(0, c.followers - 1) } : c));
        await unfollowUser(id);
      } else if (prev === 'requested') {
        setFollowStatus('none');
        await cancelFollowRequest(id);
      } else if (ownerIsPublic === false) {
        setFollowStatus('requested');
        await requestFollow(id);
      } else {
        setFollowStatus('following');
        setFollowCounts((c) => (c ? { ...c, followers: c.followers + 1 } : c));
        await followUser(id);
      }
    } catch {
      setFollowStatus(prev); // 실패 시 원복
      getFollowCounts(id).then(setFollowCounts).catch(() => {});
    }
  };

  const followBtnLabel =
    followStatus === 'following'
      ? t('feed.following')
      : followStatus === 'requested'
        ? t('feed.requested')
        : ownerIsPublic === false
          ? t('feed.requestFollow')
          : t('feed.follow');

  useEffect(() => {
    if (id && selectedBadgeId === 'founding_100') {
      getSignupNumber(id).then(setSignupNumber);
    }
  }, [id, selectedBadgeId]);

  useEffect(() => { initializeAuth(); }, [initializeAuth]);

  useEffect(() => {
    if (activeTab !== 'diary' || diaryEntries !== null || !id) return;
    getPublicListeningLog(id, { limit: 30 }).then((rows) => {
      setDiaryEntries(rows);
      if (rows.length > 0) {
        getSpinSocialSummary(rows.map((r) => r.LOG_ID)).then((map) =>
          setDiarySocialMap((prev) => ({ ...prev, ...map }))
        );
      }
    });
  }, [activeTab, diaryEntries, id]);

  // DetailModal's add/delete actions mutate the logged-in VIEWER's own
  // collection, not the profile owner's — so when browsing someone else's
  // dashboard we need the viewer's own status for the clicked album.
  useEffect(() => {
    async function fetchViewerStatus() {
      if (!user?.id || user.id === id) return;
      try {
        const vinyls = await getUserVinyls(user.id);
        const map: Record<string, 'OWNED' | 'WISH'> = {};
        (vinyls || []).forEach((v) => {
          if (v.STATUS === 'OWNED' || v.STATUS === 'WISH') {
            map[String(v.ALBUM_ID)] = v.STATUS;
          }
        });
        setViewerStatusMap(map);
      } catch (err) {
        console.error(err);
      }
    }
    fetchViewerStatus();
  }, [user?.id, id]);

  useEffect(() => {
    async function loadStats() {
      if (!id) return;
      setIsLoading(true);
      
      try {
        // Fetch raw data to get ALBUM_ID before mapping
        const data = await getUserVinyls(id);
        
        if (data && data.length > 0) {
          // Map all data first
          const mapped = data.map((v) => mapToFrontendModel(v, null));
          const mappedOwned = mapped.filter((v) => v.STATUS === 'OWNED');
          const mappedWish = mapped.filter((v) => v.STATUS === 'WISH');

          // Find featured album by comparing ALBUM_ID as strings (handles int vs string mismatch)
          let foundFeatured: VinylItem | null = null;
          if (featuredAlbumId) {
            foundFeatured = mapped.find((a) =>
              String(a.ALBUM_ID) === String(featuredAlbumId)
            ) || null;
          }
          setFeaturedAlbum(foundFeatured);
          
          setOwnedCount(mappedOwned.length);
          setOwnedAlbums(mappedOwned);
          setWishAlbums(mappedWish);

          // Calculate actual spent cost
          const spent = mappedOwned.reduce((sum: number, item) => sum + (item.PURCHASE_PRICE || 0), 0);
          setActualSpentValue(spent);

          // Compute actual top genre
          const genreCounts: Record<string, number> = {};
          mappedOwned.forEach((item) => {
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

  // 비공개 프로필 잠금 — 실제 차단은 RLS(데이터 미반환), 이 화면은 안내 UX.
  // 본인·관리자는 통과.
  const viewerIsAdmin = user?.app_metadata?.role === 'admin';
  // 수락된 팔로워는 비공개 프로필도 열람 가능 (RLS의 can_view_profile과 동일 규칙)
  if (ownerIsPublic === false && user?.id !== id && !viewerIsAdmin && followStatus !== 'following') {
    return (
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroBg} />
          <div className={styles.heroInner}>
            <div className={styles.avatarRing}>
              <img src={avatarUrl} alt="Profile" className={styles.avatarImage} />
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.nameRow}>
                <h1 className={styles.profileName}>{t('publicGrid.privateTitle')}</h1>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.5)', margin: '8px 0 12px' }}>{t('publicGrid.privateDesc')}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', margin: '0 0 12px' }}>
                {followCounts && (
                  <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)' }}>
                    <span onClick={() => setFollowListTab('followers')} style={{ cursor: 'pointer' }}>
                      <strong style={{ color: '#fff', fontWeight: 700 }}>{followCounts.followers}</strong> {t('publicGrid.followers')}
                    </span>
                    {' · '}
                    <span onClick={() => setFollowListTab('following')} style={{ cursor: 'pointer' }}>
                      <strong style={{ color: '#fff', fontWeight: 700 }}>{followCounts.following}</strong> {t('publicGrid.following')}
                    </span>
                  </span>
                )}
                {user && (
                  <button
                    onClick={toggleFollow}
                    style={{
                      padding: '7px 20px',
                      borderRadius: '999px',
                      border: '1px solid #d4af37',
                      background: followStatus !== 'none' ? 'transparent' : 'linear-gradient(135deg, #d4af37, #f3e5ab)',
                      color: followStatus !== 'none' ? '#d4af37' : '#111',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {followBtnLabel}
                  </button>
                )}
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#d4af37', fontVariationSettings: "'FILL' 1" }}>lock</span>
            </div>
          </div>
        </header>
        {followListTab && (
          <FollowListModal userId={id} initialTab={followListTab} onClose={() => setFollowListTab(null)} listsHidden />
        )}
      </div>
    );
  }

  const handleAlbumClick = (album: VinylItem) => {
    if (!user) {
      setShowLoginPrompt(true);
    } else {
      const viewerStatus = user.id === id ? album.STATUS : viewerStatusMap[String(album.ALBUM_ID)];
      setSelectedAlbum({ ...album, STATUS: viewerStatus });
    }
  };

  const stats = [
    ...(isSpentPublic ? [{ label: t('stats.actualSpent'), value: actualSpentValue.toLocaleString(), unit: '₩', sub: t('stats.actualSpentSub') }] : []),
    { label: t('stats.ownedLp'), value: ownedCount.toLocaleString(), unit: '', sub: t('stats.ownedLpSub') },
    { label: t('stats.interestGenre'), value: topGenre, unit: '', sub: t('stats.interestGenreSub') },
    { label: t('stats.actualTopGenre'), value: actualTopGenre, unit: '', sub: t('stats.actualTopGenreSub') },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroInner}>
          <div className={styles.avatarRing}>
            <img src={avatarUrl} alt="Profile" className={styles.avatarImage} />
          </div>

          <div className={styles.profileInfo}>
            <p className={styles.profileEyebrow}>VinylA Collection Member</p>
            <div className={styles.nameRow}>
              <h1 className={styles.profileName}>{displayName}</h1>
            </div>
            <div className={`${styles.collectorBadge} ${selectedBadgeObj?.id === 'founding_100' ? styles.collectorBadgeHolo : ''}`}>
              <span className={`material-symbols-outlined ${styles.collectorBadgeIcon} ${selectedBadgeObj?.id === 'founding_100' ? styles.collectorBadgeIconHolo : ''}`} style={{ fontVariationSettings: "'FILL' 1", fontSize: '13px' }}>
                {selectedBadgeObj ? selectedBadgeObj.icon : 'diamond'}
              </span>
              <span className={`${styles.collectorBadgeText} ${selectedBadgeObj?.id === 'founding_100' ? styles.collectorBadgeTextHolo : ''}`}>
                {selectedBadgeObj ? getBadgeText(selectedBadgeObj, locale, t, { number: signupNumber ?? '' }).name : t('my.verifiedCollector')}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '14px', flexWrap: 'wrap' }}>
              {followCounts && (
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)' }}>
                  <span onClick={() => setFollowListTab('followers')} style={{ cursor: 'pointer' }}>
                    <strong style={{ color: '#fff', fontWeight: 700 }}>{followCounts.followers}</strong> {t('publicGrid.followers')}
                  </span>
                  {' · '}
                  <span onClick={() => setFollowListTab('following')} style={{ cursor: 'pointer' }}>
                    <strong style={{ color: '#fff', fontWeight: 700 }}>{followCounts.following}</strong> {t('publicGrid.following')}
                  </span>
                </span>
              )}
              {user && user.id !== id && (
                <button
                  onClick={toggleFollow}
                  style={{
                    padding: '7px 20px',
                    borderRadius: '999px',
                    border: '1px solid #d4af37',
                    background: followStatus !== 'none' ? 'transparent' : 'linear-gradient(135deg, #d4af37, #f3e5ab)',
                    color: followStatus !== 'none' ? '#d4af37' : '#111',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'opacity 0.15s ease'
                  }}
                >
                  {followBtnLabel}
                </button>
              )}
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
            {t('publicDashboard.tabTimeline')}
          </button>
          <button className={`${dashStyles.tab} ${activeTab === 'collection' ? dashStyles.tabActive : ''}`} onClick={() => setActiveTab('collection')}>
            {t('stats.ownedLp')} <span className={dashStyles.tabCount}>{ownedCount}</span>
          </button>
          <button className={`${dashStyles.tab} ${activeTab === 'wishlist' ? dashStyles.tabActive : ''}`} onClick={() => setActiveTab('wishlist')}>
            {t('publicDashboard.tabWishlist')} <span className={dashStyles.tabCount}>{wishAlbums.length}</span>
          </button>
          <button className={`${dashStyles.tab} ${activeTab === 'diary' ? dashStyles.tabActive : ''}`} onClick={() => setActiveTab('diary')}>
            {t('publicDashboard.tabDiary')}
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
              <p style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 24, marginTop: 16 }}>{t('publicDashboard.noRecentLp')}</p>
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
              <p style={{ color: 'rgba(255,255,255,0.5)', padding: '24px' }}>{t('publicDashboard.noOwnedLp')}</p>
            )}
          </div>
        )}

        {/* Diary Tab — 공개(IS_PUBLIC) 재생 기록만, 비공개 프로필은 RLS가 팔로워 외 차단 */}
        {activeTab === 'diary' && (
          <div className={styles.timeline} style={{ padding: '0 40px' }}>
            {diaryEntries === null ? (
              <p style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 24, marginTop: 16 }}>{t('log.loading')}</p>
            ) : diaryEntries.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 24, marginTop: 16 }}>{t('publicDashboard.noDiary')}</p>
            ) : (
              diaryEntries.map((entry) => (
                <div
                  key={entry.LOG_ID}
                  className={styles.timelineItem}
                  onClick={() => setSocialEntry(entry)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.timelineDot} />
                  {entry.ALBUM_MASTER && (
                    <img src={entry.ALBUM_MASTER.IMAGE_URL} alt={entry.ALBUM_MASTER.TITLE} className={styles.timelineImage} />
                  )}
                  <div className={styles.timelineText}>
                    <span className={styles.timelineDate}>
                      {new Date(entry.LISTENED_AT).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                      {entry.MOOD ? ` · ${entry.MOOD}` : ''}
                    </span>
                    <div className={styles.timelineTitle}>{entry.ALBUM_MASTER?.TITLE}</div>
                    <div className={styles.timelineDesc}>{entry.ALBUM_MASTER?.ARTIST}</div>
                    {entry.NOTE && (
                      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>
                        {entry.NOTE}
                      </p>
                    )}
                    {entry.MEDIA_URL && (
                      entry.MEDIA_TYPE === 'video' ? (
                        <video src={entry.MEDIA_URL} controls playsInline loop muted style={{ maxWidth: '240px', borderRadius: '10px', marginTop: '8px', display: 'block' }} onClick={(e) => e.stopPropagation()} />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={entry.MEDIA_URL} alt="" style={{ maxWidth: '240px', borderRadius: '10px', marginTop: '8px', display: 'block' }} />
                      )
                    )}
                    <SpinSocialActions
                      entry={entry}
                      ownerName={displayName !== 'Collector' ? displayName : null}
                      summary={diarySocialMap[entry.LOG_ID]}
                      onOpenComments={() => setSocialEntry(entry)}
                      onSummaryChange={(logId, s) => setDiarySocialMap((prev) => ({ ...prev, [logId]: s }))}
                    />
                  </div>
                </div>
              ))
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
              <p style={{ color: 'rgba(255,255,255,0.5)', padding: '24px' }}>{t('publicDashboard.noWishLp')}</p>
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
          {t('publicDashboard.viewCollectionCta')}
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_forward</span>
        </Link>
      </div>

      {selectedAlbum && <DetailModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />}

      {socialEntry && (
        <SpinSocialModal
          entry={socialEntry}
          ownerName={displayName !== 'Collector' ? displayName : null}
          onClose={() => setSocialEntry(null)}
          onSummaryChange={(logId, s) => setDiarySocialMap((prev) => ({ ...prev, [logId]: s }))}
        />
      )}

      {followListTab && (
        <FollowListModal
          userId={id}
          initialTab={followListTab}
          onClose={() => setFollowListTab(null)}
          isOwner={user?.id === id}
        />
      )}

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
            <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 12px' }}>{t('publicGrid.loginRequiredTitle')}</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '0 0 32px' }}>
              {t('publicGrid.loginRequiredLine1')}<br />{t('publicGrid.loginRequiredLine2')}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowLoginPrompt(false)} style={{
                flex: 1, padding: '14px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)', fontSize: '15px', cursor: 'pointer'
              }}>{t('common.cancel')}</button>
              <Link href="/" style={{
                flex: 1, padding: '14px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #d4af37, #f3e5ab)',
                color: '#111', fontSize: '15px', fontWeight: 700,
                textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>{t('common.login')}</Link>
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
