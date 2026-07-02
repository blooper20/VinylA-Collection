'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, NICKNAME_MAX_LENGTH } from '@vinyla/core-api';
import styles from './setup.module.css';

const INTERESTS = ['Jazz', 'Rock', 'Classical', 'Hip-Hop', 'Pop', 'Electronic', 'R&B', 'Folk'];

export default function SetupPage() {
  const router = useRouter();
  const { user, updateProfile, initializeAuth, isLoading } = useAuthStore();
  const [name, setName] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    initializeAuth();
  }, []);

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
      alert('이름을 입력해주세요.');
      return;
    }
    
    try {
      setIsSubmitting(true);
      await updateProfile(name, selectedInterests);
      router.replace('/');
    } catch (error) {
      console.error('Failed to update profile:', error);
      alert('프로필 설정에 실패했습니다.');
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
            <img src="/logo.png" alt="VinylA Logo" className={styles.labelLogo} />
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
        <p className={styles.subtitle}>당신만의 컬렉션을 시작하기 위해 프로필을 완성해주세요.</p>

        <div className={styles.formGroup}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label className={styles.label}>닉네임</label>
            <span style={{ fontSize: '12px', opacity: 0.6 }}>{name.length}/{NICKNAME_MAX_LENGTH}자</span>
          </div>
          <input
            type="text"
            className={styles.input}
            placeholder="닉네임을 입력하세요"
            value={name}
            maxLength={NICKNAME_MAX_LENGTH}
            onChange={(e) => setName(e.target.value.slice(0, NICKNAME_MAX_LENGTH))}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>관심 장르 (선택)</label>
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

        <button 
          className={styles.submitBtn} 
          onClick={handleSave}
          disabled={isSubmitting}
        >
          {isSubmitting ? '저장 중...' : '시작하기'}
        </button>
      </div>
    </div>
  );
}
