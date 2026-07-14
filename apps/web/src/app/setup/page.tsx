'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, NICKNAME_MAX_LENGTH, setMyProfileVisibility } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import styles from './setup.module.css';

const INTERESTS = ['Jazz', 'Rock', 'Classical', 'Hip-Hop', 'Pop', 'Electronic', 'R&B', 'Folk'];

export default function SetupPage() {
  const router = useRouter();
  const { t } = useLocale();
  const { user, updateProfile, initializeAuth, isLoading } = useAuthStore();
  // null = 사용자가 아직 직접 수정하지 않음 → Google 계정 이름을 기본값으로 보여준다.
  const [editedName, setEditedName] = useState<string | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  // 프로필은 기본 비공개(opt-in 공개) — 원치 않은 공개를 막기 위한 정책
  const [isPublicProfile, setIsPublicProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const googleName = (user?.user_metadata?.full_name || user?.user_metadata?.name || '').slice(0, NICKNAME_MAX_LENGTH);
  const name = editedName ?? googleName;

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (!isLoading && user?.user_metadata?.displayName) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert(t('setup.nameRequired'));
      return;
    }

    try {
      setIsSubmitting(true);
      await updateProfile(name, selectedInterests);
      // DB 기본값이 비공개라 공개를 선택한 경우에만 반영하면 된다
      if (isPublicProfile) {
        await setMyProfileVisibility(true);
      }
      router.replace('/search');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert(t('setup.saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || (user && user.user_metadata?.displayName)) {
    return <div className={styles.container}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.vinylDecoration}>
        <div className={styles.vinylReflection} />
        <div className={styles.spinningVinyl}>
          <div className={styles.vinylLabel}>
            <img src="/logo.png" alt="VinylA Collection Logo" className={styles.labelLogo} />
            <div className={styles.vinylLabelInner} />
          </div>
        </div>
        <div className={styles.tonearm}>
          <div className={styles.tonearmRod} />
          <div className={styles.tonearmHead} />
          <div className={styles.tonearmPivot}>
            <div className={styles.tonearmPivotCenter} />
          </div>
        </div>
      </div>

      <div className={styles.setupBox}>
        <h1 className={styles.title}>Welcome to VinylA</h1>
        <p className={styles.subtitle}>{t('setup.subtitle')}</p>

        <div className={styles.formGroup}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className={styles.label}>{t('setup.nicknameLabel')}</label>
            <span style={{ fontSize: '12px', opacity: 0.6 }}>
              {t('setup.nicknameCounter', { current: name.length, max: NICKNAME_MAX_LENGTH })}
            </span>
          </div>
          <input
            type="text"
            className={styles.input}
            placeholder={t('setup.nicknamePlaceholder')}
            value={name}
            maxLength={NICKNAME_MAX_LENGTH}
            onChange={(e) => setEditedName(e.target.value.slice(0, NICKNAME_MAX_LENGTH))}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('setup.interestsLabel')}</label>
          <div className={styles.tagsContainer}>
            {INTERESTS.map(interest => {
              const isSelected = selectedInterests.includes(interest);
              return (
                <button 
                  key={interest} 
                  className={`${styles.tag} ${isSelected ? styles.tagSelected : ''}`}
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('setup.visibilityLabel')}</label>
          <div className={styles.tagsContainer}>
            <button
              className={`${styles.tag} ${!isPublicProfile ? styles.tagSelected : ''}`}
              onClick={() => setIsPublicProfile(false)}
            >
              {t('setup.visibilityPrivateChip')}
            </button>
            <button
              className={`${styles.tag} ${isPublicProfile ? styles.tagSelected : ''}`}
              onClick={() => setIsPublicProfile(true)}
            >
              {t('setup.visibilityPublicChip')}
            </button>
          </div>
          <p style={{ fontSize: '12px', opacity: 0.6, lineHeight: 1.6, margin: '8px 0 0' }}>
            {t('setup.visibilityNotice')}
          </p>
        </div>

        <button
          className={styles.submitBtn}
          onClick={handleSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? t('setup.savingButton') : t('setup.startButton')}
        </button>
      </div>
    </div>
  );
}
