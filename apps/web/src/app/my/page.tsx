'use client';

import React, { useEffect, useState } from 'react';
import styles from './page.module.css';
import { useAuthStore, getUserVinyls, mapToFrontendModel, UserStats, BADGES, evaluateBadges, getBadgeText, getSignupNumber, NICKNAME_MAX_LENGTH } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { FeaturedLPModal } from '../../components/Modal/FeaturedLPModal';
import BadgeSelectModal from '../../components/Modal/BadgeSelectModal';
import FoundingBadgeCelebrationModal from '../../components/Modal/FoundingBadgeCelebrationModal';
import DeleteAccountModal from '../../components/Modal/DeleteAccountModal';
import { ImageCropModal } from '../../components/Modal/ImageCropModal';
import { copyToClipboard } from '../../utils/shareUtils';

type FrontendVinyl = ReturnType<typeof mapToFrontendModel>;

const AVAILABLE_GENRES = [
  'Pop', 'Rock', 'Jazz', 'Electronic', 'Hip Hop', 'R&B / Soul', 'Folk', 'Classical', 'Blues', 'Reggae', 'Cinematic', 'Ambient', 'World'
];

export default function MyProfilePage() {
  const { user, initializeAuth, updateProfileWithAvatarFile, updateFeaturedAlbum, updateUnlockedBadges, updateSelectedBadge, markFoundingCelebrationSeen, deleteAccount } = useAuthStore();
  const { locale, t } = useLocale();
  const [collectionValue, setCollectionValue] = useState(0);
  const [actualSpentValue, setActualSpentValue] = useState(0);
  const [ownedCount, setOwnedCount] = useState(0);
  const [topGenre, setTopGenre] = useState('-');
  const [actualTopGenre, setActualTopGenre] = useState('-');
  const [recentAdditions, setRecentAdditions] = useState<FrontendVinyl[]>([]);
  const [allAlbumsList, setAllAlbumsList] = useState<FrontendVinyl[]>([]);
  const [signupNumber, setSignupNumber] = useState<number | null>(null);
  const [showFoundingCelebration, setShowFoundingCelebration] = useState(false);

  const featuredAlbumId = user?.user_metadata?.featured_album_id || null;
  const featuredAlbum = featuredAlbumId ? allAlbumsList.find(a => String(a.ALBUM_ID) === String(featuredAlbumId)) : undefined;

  const [isFeaturedModalOpen, setIsFeaturedModalOpen] = useState(false);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState<string | null>(null);
  const [isAvatarRemoved, setIsAvatarRemoved] = useState(false);

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
  const [isSpentPublic, setIsSpentPublic] = useState(false);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    const handleToast = (e: Event) => {
      setToastMessage((e as CustomEvent<{ message: string }>).detail.message);
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
        // 최근 수집 기록: 저장 시점 최신순 상위 3개 (정렬 없이 자르면 DB 반환
        // 순서 = 사실상 오래된 순이 그대로 나온다)
        setRecentAdditions(
          [...mappedOwned]
            .sort((a, b) => new Date(b.PURCHASE_DATE || 0).getTime() - new Date(a.PURCHASE_DATE || 0).getTime())
            .slice(0, 3)
        );

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

        const fetchedSignupNumber = await getSignupNumber(user.id);
        setSignupNumber(fetchedSignupNumber);

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
          wishGenres,
          signupNumber: fetchedSignupNumber ?? undefined
        };

        const newlyUnlocked = evaluateBadges(stats);
        const previouslyUnlocked = user.user_metadata?.unlocked_badges || [];

        const newBadges = newlyUnlocked.filter(b => !previouslyUnlocked.includes(b));
        if (newBadges.length > 0) {
           const nextBadges = Array.from(new Set([...previouslyUnlocked, ...newlyUnlocked]));
           updateUnlockedBadges(nextBadges);

           const toastWorthyBadges = newBadges.filter(b => b !== 'founding_100');
           if (toastWorthyBadges.length > 0) {
             const newBadgeNames = toastWorthyBadges
               .map(id => BADGES.find(b => b.id === id))
               .filter((b): b is NonNullable<typeof b> => Boolean(b))
               .map(b => getBadgeText(b, locale, t).name)
               .join(', ');

             const event = new CustomEvent('SHOW_TOAST', { detail: { message: t('my.badgeUnlocked', { names: newBadgeNames }) } });
             window.dispatchEvent(event);
           }
        }

        // founding_100's grand celebration is keyed off "have they seen it
        // yet" rather than "was it newly unlocked this session" — accounts
        // that silently got the badge before this modal existed would
        // otherwise never see it, since it'd never show up as "new" again.
        if (newlyUnlocked.includes('founding_100') && !user.user_metadata?.founding_celebration_seen) {
          setShowFoundingCelebration(true);
          markFoundingCelebrationSeen();
        }
        // --- 끝 ---
      } else {
        setActualTopGenre('-');
      }
    }
    loadStats();
  }, [user, updateUnlockedBadges, markFoundingCelebrationSeen, locale, t]);

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      await updateProfileWithAvatarFile(editName, [editGenre], selectedAvatarFile || undefined, isAvatarRemoved);
      setIsEditing(false);
      setTopGenre(editGenre);
      setIsAvatarRemoved(false);
    } catch {
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: t('my.profileSaveFailed') } }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setTempImageUrl(url);
      setIsCropModalOpen(true);
      e.target.value = ''; // Reset input so same file can be selected again
    }
  };

  const handleCropComplete = (croppedFile: File, croppedUrl: string) => {
    setSelectedAvatarFile(croppedFile);
    setPreviewAvatarUrl(croppedUrl);
    setIsAvatarRemoved(false);
    setIsCropModalOpen(false);
    setTempImageUrl(null);
  };

  const handleRemoveAvatar = () => {
    setSelectedAvatarFile(null);
    setPreviewAvatarUrl('/logo.png');
    setIsAvatarRemoved(true);
  };

  const handleShareProfile = async () => {
    if (user?.id) {
      const name = encodeURIComponent(user.user_metadata?.displayName || 'Collector');
      const avatar = encodeURIComponent(user.user_metadata?.avatar_url || '/logo.png');
      const badge = encodeURIComponent(user.user_metadata?.selected_badge || '');
      const genre = encodeURIComponent(topGenre || '');
      const featured = encodeURIComponent(user.user_metadata?.featured_album_id || '');
      const sp = isSpentPublic ? '1' : '0';
      
      const link = `${window.location.origin}/user/${user.id}/dashboard?n=${name}&a=${avatar}&b=${badge}&g=${genre}&f=${featured}&sp=${sp}`;
      await copyToClipboard(link);

      const event = new CustomEvent('SHOW_TOAST', { detail: { message: t('my.profileLinkCopied') } });
      window.dispatchEvent(event);
    }
  };

  const stats: { label: string; value: string; unit: string; sub: string; isSpent?: boolean }[] = [
    { label: t('stats.marketPrice'), value: collectionValue.toLocaleString(), unit: '₩', sub: t('stats.marketPriceSub') },
    { label: t('stats.actualSpent'), value: actualSpentValue.toLocaleString(), unit: '₩', sub: t('stats.actualSpentSub'), isSpent: true },
    { label: t('stats.ownedLp'), value: ownedCount.toLocaleString(), unit: '', sub: t('stats.ownedLpSub') },
    { label: t('stats.interestGenre'), value: topGenre, unit: '', sub: t('stats.interestGenreSub') },
    { label: t('stats.actualTopGenre'), value: actualTopGenre, unit: '', sub: t('stats.actualTopGenreSub') },
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
              <h2 style={{ marginBottom: 24, fontSize: 24, fontWeight: 700 }}>{t('my.editProfile')}</h2>

              <div className={styles.editField}>
                <label>{t('my.photoUploadLabel')}</label>
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
                    <span className={styles.avatarUploadTitle}>{t('my.editPhoto')}</span>
                    <span className={styles.avatarUploadDesc}>{t('my.editPhotoDesc')}</span>
                    {previewAvatarUrl !== '/logo.png' && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        style={{ marginTop: '8px', background: 'none', border: 'none', color: '#eb5757', cursor: 'pointer', fontSize: '13px', padding: 0, textDecoration: 'underline' }}
                      >
                        {t('my.removePhoto')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.editField}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>{t('setup.nicknameLabel')}</label>
                  <span style={{ fontSize: '12px', opacity: 0.6 }}>{t('setup.nicknameCounter', { current: editName.length, max: NICKNAME_MAX_LENGTH })}</span>
                </div>
                <input
                  type="text"
                  value={editName}
                  maxLength={NICKNAME_MAX_LENGTH}
                  onChange={e => setEditName(e.target.value.slice(0, NICKNAME_MAX_LENGTH))}
                  className={styles.editInput}
                />
              </div>

              <div className={styles.editField}>
                <label>{t('my.genreSettingsLabel')}</label>
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
                  {t('my.accountDelete')}
                </button>
                <button className={styles.btnSecondary} onClick={() => setIsEditing(false)} disabled={isSaving}>{t('common.cancel')}</button>
                <button className={styles.btnPrimary} onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? t('my.uploading') : t('common.save')}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.avatarRing}>
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className={styles.avatarImage}
                />
              </div>

              <div className={styles.profileInfo}>
                <p className={styles.profileEyebrow}>{t('my.memberSince')}</p>
                <div className={styles.nameRow}>
                  <h1 className={styles.profileName}>{displayName}</h1>
                  <button className={styles.editBtnToggle} onClick={() => setIsEditing(true)}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
                  </button>
                  <button className={styles.editBtnToggle} onClick={handleShareProfile} title={t('common.share')} style={{ marginLeft: '8px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>ios_share</span>
                  </button>
                </div>
                <div
                  className={`${styles.collectorBadge} ${selectedBadgeObj?.id === 'founding_100' ? styles.collectorBadgeHolo : ''}`}
                  onClick={() => setIsBadgeModalOpen(true)}
                  style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <span className={`material-symbols-outlined ${styles.collectorBadgeIcon} ${selectedBadgeObj?.id === 'founding_100' ? styles.collectorBadgeIconHolo : ''}`} style={{ fontVariationSettings: "'FILL' 1", fontSize: '13px' }}>
                    {selectedBadgeObj ? selectedBadgeObj.icon : 'diamond'}
                  </span>
                  <span className={`${styles.collectorBadgeText} ${selectedBadgeObj?.id === 'founding_100' ? styles.collectorBadgeTextHolo : ''}`}>
                    {selectedBadgeObj ? getBadgeText(selectedBadgeObj, locale, t, { number: signupNumber ?? '' }).name : t('my.verifiedCollector')}
                  </span>
                </div>
              </div>
            </>
          )}

          {!isEditing && (
            <div className={styles.featuredContainer}>
              <div className={styles.featuredFrame} onClick={() => setIsFeaturedModalOpen(true)}>
                {featuredAlbum ? (
                  <>
                    <img src={featuredAlbum.COVER_URL || featuredAlbum.IMAGE_URL} alt={featuredAlbum.TITLE} className={styles.featuredCover} />
                    {featuredAlbum.STATUS === 'WISH' && (
                      <div className={styles.featuredWishBadge}>WISH</div>
                    )}
                    {featuredAlbum.STATUS === 'OWNED' && (
                      <div className={styles.featuredOwnedBadge}>COLLECTED</div>
                    )}
                  </>
                ) : (
                  <div className={styles.featuredEmpty}>
                    <span className="material-symbols-outlined">add_circle</span>
                    <p>{t('my.noFeaturedLp')}</p>
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
              {stat.isSpent && (
                <button
                  onClick={() => setIsSpentPublic(v => !v)}
                  style={{
                    marginTop: '8px',
                    background: 'none',
                    border: `1px solid ${isSpentPublic ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.15)'}`,
                    borderRadius: '20px',
                    color: isSpentPublic ? '#d4af37' : 'rgba(255,255,255,0.4)',
                    fontSize: '12px',
                    padding: '4px 10px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>
                    {isSpentPublic ? 'visibility' : 'visibility_off'}
                  </span>
                  {isSpentPublic ? t('my.spentPublic') : t('my.spentPrivate')}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.journey}>
        <div className={styles.journeySectionHeader}>
          <div className={styles.journeyAccentLine} />
          <h2 className={styles.journeySectionTitle}>{t('my.journeyTitle')}</h2>
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
            <p style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 24, marginTop: 16 }}>{t('my.noRecentLp')}</p>
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
        signupNumber={signupNumber}
        onEquip={async (badgeId) => {
          await updateSelectedBadge(badgeId);
        }}
      />

      <FoundingBadgeCelebrationModal
        isOpen={showFoundingCelebration}
        onClose={() => setShowFoundingCelebration(false)}
        signupNumber={signupNumber}
      />

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={async () => {
          await deleteAccount();
        }}
      />

      <ImageCropModal
        isOpen={isCropModalOpen}
        imageSrc={tempImageUrl || ''}
        onClose={() => {
          setIsCropModalOpen(false);
          setTempImageUrl(null);
        }}
        onCropComplete={handleCropComplete}
      />

      {/* Toast notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(30, 27, 22, 0.95)',
          border: '1px solid rgba(212, 175, 55, 0.4)',
          borderRadius: '100px',
          padding: '14px 28px',
          color: '#fff',
          fontSize: '15px',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 99999,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)',
          whiteSpace: 'nowrap',
          animation: 'fadeInUp 0.3s ease',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#d4af37', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
