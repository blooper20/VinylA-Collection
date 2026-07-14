import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './PublicGrid.module.css';
import { getUserVinyls, useAuthStore, followUser, unfollowUser, getMyFollowingIds, getFollowCounts, getProfileInfo, requestFollow, cancelFollowRequest, getMyOutgoingRequestIds } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { MockVinylData } from '@vinyla/shared-types';
import { DetailModal } from '../Modal/DetailModal';
import { FollowListModal } from '../Modal/FollowListModal';

type PublicVinyl = MockVinylData & { COVER_URL?: string };

interface PublicGridProps {
  userId: string;
  initialName?: string;
  initialAvatar?: string;
  filterType?: 'collection' | 'wishlist';
}

export const PublicGrid: React.FC<PublicGridProps> = ({ userId, initialName = 'Collector', initialAvatar = '/logo.png', filterType = 'collection' }) => {
  const [dbData, setDbData] = useState<PublicVinyl[]>([]);
  const [profileName] = useState<string>(initialName);
  const [avatarUrl] = useState<string>(initialAvatar);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<PublicVinyl | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [viewerStatusMap, setViewerStatusMap] = useState<Record<string, 'OWNED' | 'WISH'>>({});
  // none → (공개) 바로 팔로우 / (비공개) 요청 → requested → 상대 수락 시 following
  const [followStatus, setFollowStatus] = useState<'none' | 'requested' | 'following'>('none');
  const [followCounts, setFollowCounts] = useState<{ followers: number; following: number } | null>(null);
  const [followListTab, setFollowListTab] = useState<'followers' | 'following' | null>(null);
  // null = 아직 모름(로딩 중) — 잠금 화면 깜빡임 방지
  const [ownerIsPublic, setOwnerIsPublic] = useState<boolean | null>(null);

  const { user, initializeAuth } = useAuthStore();
  const { t } = useLocale();
  useEffect(() => { initializeAuth(); }, [initializeAuth]);

  // The album's STATUS field reflects the profile OWNER's collection, but
  // DetailModal's add/delete actions always mutate the logged-in VIEWER's
  // own collection — so when browsing someone else's page we need the
  // viewer's own status for that album, not the owner's, to avoid a
  // "delete" button that's mislabeled relative to what it actually does.
  useEffect(() => {
    async function fetchViewerStatus() {
      if (!user?.id || user.id === userId) return;
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
  }, [user?.id, userId]);

  useEffect(() => {
    if (!user?.id || user.id === userId) return;
    Promise.all([getMyFollowingIds(), getMyOutgoingRequestIds()]).then(([following, requested]) => {
      setFollowStatus(following.has(userId) ? 'following' : requested.has(userId) ? 'requested' : 'none');
    });
  }, [user?.id, userId]);

  useEffect(() => {
    getFollowCounts(userId).then(setFollowCounts).catch(() => setFollowCounts(null));
    // 조회 실패 시 비공개 취급 (privacy-first) — 실제 차단은 어차피 RLS가 한다
    getProfileInfo(userId).then((p) => setOwnerIsPublic(p.IS_PUBLIC)).catch(() => setOwnerIsPublic(false));
  }, [userId]);

  // 공개: 팔로우 ↔ 팔로잉 토글. 비공개: 요청 ↔ 요청 취소 (수락돼야 팔로잉).
  const toggleFollow = async () => {
    const prev = followStatus;
    try {
      if (prev === 'following') {
        setFollowStatus('none');
        setFollowCounts((c) => (c ? { ...c, followers: Math.max(0, c.followers - 1) } : c));
        await unfollowUser(userId);
      } else if (prev === 'requested') {
        setFollowStatus('none');
        await cancelFollowRequest(userId);
      } else if (ownerIsPublic === false) {
        setFollowStatus('requested');
        await requestFollow(userId);
      } else {
        setFollowStatus('following');
        setFollowCounts((c) => (c ? { ...c, followers: c.followers + 1 } : c));
        await followUser(userId);
      }
    } catch {
      setFollowStatus(prev); // 실패 시 원복
      getFollowCounts(userId).then(setFollowCounts).catch(() => {});
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
    async function fetchPublicData() {
      setIsLoading(true);
      try {
        const vinyls = await getUserVinyls(userId);

        if (vinyls && vinyls.length > 0) {
          const formatted: PublicVinyl[] = vinyls.map((v) => ({
            ...(v.ALBUM_MASTER || {}),
            STATUS: v.STATUS,
            PURCHASE_PRICE: v.PURCHASE_PRICE,
            PURCHASE_DATE: v.PURCHASE_DATE
          }));
          setDbData(formatted);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    if (userId) {
      fetchPublicData();
    }
  }, [userId]);

  if (isLoading) {
    return <div className={styles.loading}>{t('publicGrid.loading')}</div>;
  }

  // 비공개 프로필 잠금 — 실제 차단은 RLS가 하므로(데이터가 아예 안 옴)
  // 이 화면은 "왜 안 보이는지"를 알려주는 UX다. 본인·관리자는 통과.
  const viewerIsAdmin = user?.app_metadata?.role === 'admin';
  // 수락된 팔로워는 비공개 프로필도 열람 가능 (RLS의 can_view_profile과 동일 규칙)
  if (ownerIsPublic === false && user?.id !== userId && !viewerIsAdmin && followStatus !== 'following') {
    // 비공개여도 팔로워/팔로잉 "숫자"는 공개, 목록은 잠금. 팔로우는 요청제.
    return (
      <div className={styles.pageWrapper}>
        <header className={styles.header}>
          <img src={avatarUrl} alt="Avatar" className={styles.avatar} />
          <h1 className={styles.title}>{t('publicGrid.privateTitle')}</h1>
          <p className={styles.subtitle}>{t('publicGrid.privateDesc')}</p>
          <div className={styles.socialRow}>
            {followCounts && (
              <span className={styles.followCounts}>
                <span onClick={() => setFollowListTab('followers')} style={{ cursor: 'pointer' }}>
                  <strong>{followCounts.followers}</strong> {t('publicGrid.followers')}
                </span>
                {' · '}
                <span onClick={() => setFollowListTab('following')} style={{ cursor: 'pointer' }}>
                  <strong>{followCounts.following}</strong> {t('publicGrid.following')}
                </span>
              </span>
            )}
            {user && (
              <button
                className={`${styles.followBtn} ${followStatus !== 'none' ? styles.followBtnActive : ''}`}
                onClick={toggleFollow}
              >
                {followBtnLabel}
              </button>
            )}
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#d4af37', fontVariationSettings: "'FILL' 1" }}>lock</span>
        </header>
        {followListTab && (
          <FollowListModal
            userId={userId}
            initialTab={followListTab}
            onClose={() => setFollowListTab(null)}
            listsHidden
          />
        )}
      </div>
    );
  }

  const handleAlbumClick = (album: PublicVinyl) => {
    if (!user) {
      setShowLoginPrompt(true);
    } else {
      const viewerStatus = user.id === userId ? album.STATUS : viewerStatusMap[String(album.ALBUM_ID)];
      setSelectedAlbum({ ...album, STATUS: viewerStatus });
    }
  };

  // Filter based on the share link type
  const isWishlist = filterType === 'wishlist';
  const displayData = dbData.filter(v => isWishlist ? v.STATUS === 'WISH' : v.STATUS !== 'WISH');
  const recordCount = displayData.length;
  const pageTitle = isWishlist
    ? t('publicGrid.wishlistTitle', { name: profileName })
    : t('publicGrid.collectionTitle', { name: profileName });

  // 취향 일치율 — 이미 로드된 주인장 컬렉션(dbData)과 뷰어 보관함
  // (viewerStatusMap)으로 계산하므로 추가 쿼리가 없다. 정의는
  // get_taste_matches RPC와 동일: 겹침 ÷ min(내 수집 수, 상대 수집 수).
  const isOtherProfile = !!user && user.id !== userId;
  const ownerOwnedIds = dbData.filter((v) => v.STATUS !== 'WISH').map((v) => String(v.ALBUM_ID));
  const myOwnedCount = Object.values(viewerStatusMap).filter((s) => s === 'OWNED').length;
  const overlapCount = ownerOwnedIds.filter((id) => viewerStatusMap[id] === 'OWNED').length;
  const matchPercent =
    isOtherProfile && overlapCount > 0
      ? Math.round((100 * overlapCount) / Math.max(Math.min(myOwnedCount, ownerOwnedIds.length), 1))
      : null;

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.header}>
        <Link href={`/user/${userId}`}>
          <img src={avatarUrl} alt="Avatar" className={styles.avatar} style={{ cursor: 'pointer' }} />
        </Link>
        <h1 className={styles.title}>{pageTitle}</h1>
        <p className={styles.subtitle}>{recordCount} Records</p>
        <div className={styles.socialRow}>
          {followCounts && (
            <span className={styles.followCounts}>
              <span onClick={() => setFollowListTab('followers')} style={{ cursor: 'pointer' }}>
                <strong>{followCounts.followers}</strong> {t('publicGrid.followers')}
              </span>
              {' · '}
              <span onClick={() => setFollowListTab('following')} style={{ cursor: 'pointer' }}>
                <strong>{followCounts.following}</strong> {t('publicGrid.following')}
              </span>
            </span>
          )}
          {isOtherProfile && matchPercent !== null && (
            <span className={styles.matchBadge}>{t('feed.matchPercent', { percent: matchPercent })}</span>
          )}
          {isOtherProfile && (
            <button
              className={`${styles.followBtn} ${followStatus !== 'none' ? styles.followBtnActive : ''}`}
              onClick={toggleFollow}
            >
              {followBtnLabel}
            </button>
          )}
        </div>
      </header>

      <div className={styles.grid}>
        {displayData.map(album => (
          <div key={album.ALBUM_ID} className={styles.card} onClick={() => handleAlbumClick(album)} style={{ cursor: 'pointer' }}>
            <div className={styles.coverWrapper}>
              <img src={album.COVER_URL || album.IMAGE_URL} alt={album.TITLE} className={styles.cover} />
              {album.STATUS === 'WISH' && <div className={styles.wishBadge}>WISH</div>}
            </div>
            <div className={styles.info}>
              <p className={styles.albumTitle}>{album.TITLE}</p>
              <p className={styles.albumArtist}>{album.ARTIST}</p>
            </div>
          </div>
        ))}
      </div>

      {selectedAlbum && <DetailModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />}

      {followListTab && (
        <FollowListModal
          userId={userId}
          initialTab={followListTab}
          onClose={() => setFollowListTab(null)}
          isOwner={user?.id === userId}
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
};
