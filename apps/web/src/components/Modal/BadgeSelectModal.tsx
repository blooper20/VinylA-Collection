import React from 'react';
import styles from './BadgeSelectModal.module.css';
import { Badge, BADGES } from '../../lib/badges';

interface BadgeSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  unlockedBadgeIds: string[];
  selectedBadgeId: string | null;
  onEquip: (badgeId: string) => void;
}

export default function BadgeSelectModal({
  isOpen,
  onClose,
  unlockedBadgeIds,
  selectedBadgeId,
  onEquip
}: BadgeSelectModalProps) {
  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>호칭 선택</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className={styles.content}>
          {BADGES.map((badge) => {
            const isUnlocked = unlockedBadgeIds.includes(badge.id);
            const isSelected = selectedBadgeId === badge.id;

            // If it's hidden and locked, we mask it
            if (!isUnlocked && badge.isHidden) {
              return (
                <div key={badge.id} className={`${styles.badgeItem} ${styles.locked}`}>
                  <div className={styles.iconWrapper}>
                    <span className="material-symbols-outlined">lock</span>
                  </div>
                  <div className={styles.badgeInfo}>
                    <div className={styles.badgeName}>???</div>
                    <div className={styles.badgeDesc}>비밀 업적을 달성하여 해금하세요.</div>
                  </div>
                </div>
              );
            }

            return (
              <div 
                key={badge.id} 
                className={`${styles.badgeItem} ${isUnlocked ? styles.unlocked : styles.locked} ${isSelected ? styles.selected : ''}`}
                onClick={() => isUnlocked && onEquip(badge.id)}
              >
                <div className={styles.iconWrapper}>
                  <span className="material-symbols-outlined">{badge.icon}</span>
                </div>
                <div className={styles.badgeInfo}>
                  <div className={styles.badgeName}>{badge.name}</div>
                  <div className={styles.badgeDesc}>{badge.description}</div>
                </div>
                {isUnlocked && (
                  <div>
                    {isSelected ? (
                      <div className={styles.equippedBtn}>장착 중</div>
                    ) : (
                      <button className={styles.equipBtn}>장착</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
