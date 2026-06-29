'use client';

import React, { useEffect, useState } from 'react';
import styles from './page.module.css';
import { useAuthStore, getUserVinyls, mapToFrontendModel } from '@vinyla/core-api';

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
  const { user, initializeAuth, updateProfileWithAvatarFile } = useAuthStore();
  const [collectionValue, setCollectionValue] = useState(0);
  const [ownedCount, setOwnedCount] = useState(0);
  const [topGenre, setTopGenre] = useState('-');
  const [actualTopGenre, setActualTopGenre] = useState('-');
  const [recentAdditions, setRecentAdditions] = useState<any[]>([]);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [previewAvatarUrl, setPreviewAvatarUrl] = useState('');
  const [editGenre, setEditGenre] = useState('');

  useEffect(() => {
    initializeAuth();
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
        const mapped = data.map(v => mapToFrontendModel(v, null));
        const owned = mapped.filter(v => v.STATUS === 'OWNED');
        
        setOwnedCount(owned.length);
        
        const value = owned.reduce((sum, item) => sum + (item.PURCHASE_PRICE || 0), 0);
        setCollectionValue(value);

        // Compute actual top genre
        const genreCounts: Record<string, number> = {};
        owned.forEach(item => {
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

        // timeline: top 3 recent additions
        setRecentAdditions(owned.slice(0, 3));
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
    { label: '컬렉션 가치',  value: collectionValue.toLocaleString(), unit: '₩', sub: '시장 추정가 기준' },
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
                <div className={styles.avatarUploadContainer}>
                  <img 
                    src={previewAvatarUrl} 
                    className={styles.avatarPreview}
                    alt="preview"
                  />
                  <div className={styles.avatarUploadAction}>
                    <label className={styles.btnSecondary} style={{ display: 'inline-block', cursor: 'pointer' }}>
                      사진 선택
                      <input 
                        type="file" 
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                      />
                    </label>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                      * Supabase Storage에 'avatars' 버킷이 필요합니다.
                    </p>
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
                <h1 className={styles.profileName}>{displayName}</h1>
                <div className={styles.collectorBadge}>
                  <span className={`material-symbols-outlined ${styles.collectorBadgeIcon}`} style={{ fontVariationSettings: "'FILL' 1", fontSize: '13px' }}>diamond</span>
                  <span className={styles.collectorBadgeText}>Verified Collector</span>
                </div>
              </div>
              
              <button className={styles.editBtnToggle} onClick={() => setIsEditing(true)}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
              </button>
            </>
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
    </div>
  );
}
