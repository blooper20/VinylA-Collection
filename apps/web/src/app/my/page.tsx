'use client';

import React, { useEffect, useState } from 'react';
import styles from './page.module.css';
import { useAuthStore, getUserVinyls, mapToFrontendModel } from '@vinyla/core-api';
import { FeaturedLPModal } from '../../components/Modal/FeaturedLPModal';
import BadgeSelectModal from '../../components/Modal/BadgeSelectModal';
import DeleteAccountModal from '../../components/Modal/DeleteAccountModal';
import { UserStats, BADGES, evaluateBadges } from '../../lib/badges';

const PRESET_AVATARS = [
  '/logo.png',
  'https://i.pravatar.cc/150?img=12',
  'https://i.pravatar.cc/150?img=5',
  'https://i.pravatar.cc/150?img=11',
  'https://i.pravatar.cc/150?img=68',
];

const AVAILABLE_GENRES = [
  'Pop', 'Rock', 'Jazz', 'Electronic', 'Hip Hop', 'R&B / Soul', 'Folk', 'Classical', 'Blues', 'Reggae', 'Cinematic', 'Ambient', 'World'
];

export default function MyProfilePage() {
  const { user, initializeAuth, updateProfileWithAvatarFile, updateFeaturedAlbum, updateUnlockedBadges, updateSelectedBadge, deleteAccount } = useAuthStore();
  const [collectionValue, setCollectionValue] = useState(0);
  const [actualSpentValue, setActualSpentValue] = useState(0);
  const [ownedCount, setOwnedCount] = useState(0);
  const [topGenre, setTopGenre] = useState('-');
  const [actualTopGenre, setActualTopGenre] = useState('-');
  const [recentAdditions, setRecentAdditions] = useState<any[]>([]);
  const [allAlbumsList, setAllAlbumsList] = useState<any[]>([]);

  const featuredAlbumId = user?.user_metadata?.featured_album_id || null;
  const featuredAlbum = allAlbumsList.find(a => a.ALBUM_ID === featuredAlbumId);

  const [isFeaturedModalOpen, setIsFeaturedModalOpen] = useState(false);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const selectedBadgeId = user?.user_metadata?.selected_badge || null;
  const selectedBadgeObj = selectedBadgeId ? BADGES.find(b => b.id === selectedBadgeId) : null;
  const unlockedBadgeIds = user?.user_metadata?.unlocked_badges || [];

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  useEffect(() => {
    const handleToast = (e: any) => {
      setToastMessage(e.detail.message);
      setTimeout(() => setToastMessage(null), 3000);
    };
    window.addEventListener('SHOW_TOAST', handleToast);
    return () => window.removeEventListener('SHOW_TOAST', handleToast);
  }, []);

  useEffect(() => {
    async function loadStats() {
      if (!user) return;
      
      const currentName = user.user_metadata?.displayName || 'Collector';
      const currentAvatar = user.user_metadata?.avatar_url || '/logo.png';
      let currentGenre = '-';
      if (user.user_metadata?.interests && user.user_metadata.interests.length > 0) {
        currentGenre = user.user_metadata.interests[0];
      }
      
      setTopGenre(currentGenre);
      setEditName(currentName);
      setPreviewAvatarUrl(currentAvatar);
      setEditGenre(currentGenre !== '-' ? currentGenre : 'Pop');

      const data = await getUserVinyls(user.id);
      if (data && data.length > 0) {
        const owned = data.filter(v => v.STATUS === 'OWNED');
        setOwnedCount(owned.length);
        
        // Calculate estimated market value
        const value = owned.reduce((sum, item) => {
          const estimatedKrw = item.ALBUM_MASTER?.MARKET_PRICE || 0;
          return sum + estimatedKrw;
        }, 0);
        setCollectionValue(value);

        // Calculate actual spent cost
        const spent = owned.reduce((sum, item) => sum + (item.PURCHASE_PRICE || 0), 0);
        setActualSpentValue(spent);

        const mapped = data.map(v => mapToFrontendModel(v, null));
        
        // Compute actual top genre
        const genreCounts: Record<string, number> = {};
        mapped.filter(v => v.STATUS === 'OWNED').forEach(item => {
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

        const mappedOwned = mapped.filter(v => v.STATUS === 'OWNED');
        const mappedWish = mapped.filter(v => v.STATUS === 'WISH');

        setAllAlbumsList(mapped.filter(v => v.STATUS !== 'NONE'));
        setRecentAdditions(mappedOwned.slice(0, 3));

        // --- 호칭 획득 로직 ---
        let highestMarketPrice = 0;
        let highestPurchasePrice = 0;
        mappedOwned.forEach(item => {
          const mp = item.MARKET_PRICE || 0;
          if (mp > highestMarketPrice) highestMarketPrice = mp;
          if ((item.PURCHASE_PRICE || 0) > highestPurchasePrice) highestPurchasePrice = item.PURCHASE_PRICE || 0;
        });

        let totalWishPrice = 0;
        const wishGenres: Record<string, number> = {};
        mappedWish.forEach(item => {
          totalWishPrice += (item.MARKET_PRICE || 0);
          if (item.GENRES && Array.isArray(item.GENRES)) {
            item.GENRES.forEach((g: string) => {
              wishGenres[g] = (wishGenres[g] || 0) + 1;
            });
          }
        });

        const stats: UserStats = {
          ownedCount: mappedOwned.length,
          wishCount: mappedWish.length,
          totalMarketPrice: value,
          totalWishPrice,
          highestMarketPrice,
          highestPurchasePrice,
          averageMarketPrice: mappedOwned.length > 0 ? value / mappedOwned.length : 0,
          favoriteGenre: currentGenre,
          ownedGenres: genreCounts,
          wishGenres
        };

        const newlyUnlocked = evaluateBadges(stats);
        const previouslyUnlocked = user.user_metadata?.unlocked_badges || [];
        
        const newBadges = newlyUnlocked.filter(b => !previouslyUnlocked.includes(b));
        if (newBadges.length > 0) {
           const nextBadges = Array.from(new Set([...previouslyUnlocked, ...newlyUnlocked]));
           updateUnlockedBadges(nextBadges);
           const newBadgeNames = newBadges.map(id => BADGES.find(b => b.id === id)?.name).filter(Boolean).join(', ');
           
           // Notify user
           const event = new CustomEvent('SHOW_TOAST', { detail: { message: `🎉 새로운 호칭 획득: ${newBadgeNames}` } });
           window.dispatchEvent(event);
        }
        // --- 끝 ---
      } else {
        setActualTopGenre('-');
      }
    }
    loadStats();
  }, [user]);

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      await updateProfileWithAvatarFile(editName, [editGenre], selectedAvatarFile || undefined);
      setIsEditing(false);
      setTopGenre(editGenre);
    } catch (e) {
      alert('프로필 업데이트에 실패했습니다. (Storage 버킷 설정을 확인해주세요)');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedAvatarFile(file);
      setPreviewAvatarUrl(URL.createObjectURL(file));
    }
  };

  const stats = [
    { label: '시장 추정가',  value: collectionValue.toLocaleString(), unit: '₩', sub: 'Discogs 기준 최저가 합산' },
    { label: '실제 지출액',  value: actualSpentValue.toLocaleString(), unit: '₩', sub: '입력된 구매가 합산' },
    { label: '보유 LP',      value: ownedCount.toLocaleString(),       unit: '',   sub: '등록된 전체 LP 수' },
    { label: '관심 장르',    value: topGenre,      unit: '',   sub: '프로필 설정 기준' },
    { label: '실제 관심 장르', value: actualTopGenre,  unit: '',   sub: '내 콜렉션 데이터 기준' },
  ];

  const displayName = user?.user_metadata?.displayName || 'Collector';
  const avatarUrl = user?.user_metadata?.avatar_url || '/logo.png';

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroInner}>
          {isEditing ? (
            <div className={styles.editProfileBox}>
              <h2 style={{ marginBottom: 24, fontSize: 24, fontWeight: 700 }}>프로필 수정</h2>
              
              <div className={styles.editField}>
                <label>프로필 사진 업로드</label>
                <div className={styles.avatarUploadWrapper}>
                  <label className={styles.avatarUploadLabel}>
                    <img 
                      src={previewAvatarUrl} 
                      className={styles.avatarPreview}
                      alt="preview"
                    />
                    <div className={styles.avatarUploadOverlay}>
                      <span className="material-symbols-outlined">photo_camera</span>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                  </label>
                  <div className={styles.avatarUploadText}>
                    <span className={styles.avatarUploadTitle}>사진 변경하기</span>
                    <span className={styles.avatarUploadDesc}>클릭하여 새로운 프로필 사진을 선택하세요.</span>
                  </div>
                </div>
              </div>

              <div className={styles.editField}>
                <label>닉네임</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={e => setEditName(e.target.value)} 
                  className={styles.editInput} 
                />
              </div>

              <div className={styles.editField}>
                <label>관심 장르 설정</label>
                <select 
                  value={editGenre} 
                  onChange={e => setEditGenre(e.target.value)} 
                  className={styles.editSelect}
                >
                  {AVAILABLE_GENRES.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className={styles.editActions}>
                <button 
                  className={styles.btnSecondary} 
                  style={{ color: '#eb5757', borderColor: 'transparent', marginRight: 'auto', paddingLeft: 0 }} 
                  onClick={() => setIsDeleteModalOpen(true)} 
                  disabled={isSaving}
                >
                  회원 탈퇴
                </button>
                <button className={styles.btnSecondary} onClick={() => setIsEditing(false)} disabled={isSaving}>취소</button>
                <button className={styles.btnPrimary} onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? '업로드 중...' : '저장하기'}
                </button>
              </div>
            </div>
          ) : (
            <>
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
                <div className={styles.nameRow}>
                  <h1 className={styles.profileName}>{displayName}</h1>
                  <button className={styles.editBtnToggle} onClick={() => setIsEditing(true)}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
                  </button>
                </div>
                <div 
                  className={styles.collectorBadge} 
                  onClick={() => setIsBadgeModalOpen(true)}
                  style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <span className={`material-symbols-outlined ${styles.collectorBadgeIcon}`} style={{ fontVariationSettings: "'FILL' 1", fontSize: '13px' }}>
                    {selectedBadgeObj ? selectedBadgeObj.icon : 'diamond'}
                  </span>
                  <span className={styles.collectorBadgeText}>
                    {selectedBadgeObj ? selectedBadgeObj.name : 'Verified Collector'}
                  </span>
                </div>
              </div>
            </>
          )}

          {!isEditing && (
            <div className={styles.featuredContainer}>
              <div className={styles.featuredFrame} onClick={() => setIsFeaturedModalOpen(true)}>
                {featuredAlbum ? (
                  <img src={featuredAlbum.COVER_URL || featuredAlbum.IMAGE_URL} alt={featuredAlbum.TITLE} className={styles.featuredCover} />
                ) : (
                  <div className={styles.featuredEmpty}>
                    <span className="material-symbols-outlined">add_circle</span>
                    <p>대표 LP 설정</p>
                  </div>
                )}
              </div>
            </div>
          )}
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

      <FeaturedLPModal 
        isOpen={isFeaturedModalOpen}
        onClose={() => setIsFeaturedModalOpen(false)}
        albums={allAlbumsList}
        currentFeaturedId={featuredAlbumId}
        onSelect={updateFeaturedAlbum}
      />
      
      <BadgeSelectModal 
        isOpen={isBadgeModalOpen}
        onClose={() => setIsBadgeModalOpen(false)}
        unlockedBadgeIds={unlockedBadgeIds}
        selectedBadgeId={selectedBadgeId}
        onEquip={async (badgeId) => {
          await updateSelectedBadge(badgeId);
        }}
      />

      <DeleteAccountModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={async () => {
          await deleteAccount();
        }}
      />
    </div>
  );
}
