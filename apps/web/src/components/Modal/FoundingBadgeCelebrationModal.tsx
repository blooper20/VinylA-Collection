'use client';

import React from 'react';
import styles from './FoundingBadgeCelebrationModal.module.css';
import { useLocale } from '@vinyla/i18n';

interface FoundingBadgeCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  signupNumber: number | null;
}

const PARTICLE_ANGLES = Array.from({ length: 20 }, (_, i) => i * 18);

export default function FoundingBadgeCelebrationModal({ isOpen, onClose, signupNumber }: FoundingBadgeCelebrationModalProps) {
  const { t } = useLocale();

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.glow} />
      <div className={styles.particles}>
        {PARTICLE_ANGLES.map((angle, i) => (
          <span
            key={i}
            className={styles.particle}
            style={{ '--angle': `${angle}deg`, animationDelay: `${(i % 5) * 0.08}s` } as React.CSSProperties}
          />
        ))}
      </div>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.iconWrapper}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>workspace_premium</span>
        </div>
        <h2 className={styles.title}>{t('founding.celebrationTitle')}</h2>
        <p className={styles.body}>{t('founding.celebrationBody', { number: signupNumber ?? '' })}</p>
        <button className={styles.confirmBtn} onClick={onClose}>{t('founding.confirmButton')}</button>
      </div>
    </div>
  );
}
