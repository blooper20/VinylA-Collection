import React, { useState } from 'react';
import styles from './BadgeSelectModal.module.css';
import { BADGES, BadgeCategory, BadgeTier } from '@vinyla/core-api';

interface BadgeSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  unlockedBadgeIds: string[];
  selectedBadgeId: string | null;
  onEquip: (badgeId: string) => void;
}

const CATEGORIES: { id: BadgeCategory | 'all', label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'collection', label: '보유량' },
  { id: 'wealth', label: '자산 및 지출' },
  { id: 'wishlist', label: '위시리스트' },
  { id: 'genre', label: '장르 탐험' },
];

function getTierClass(tier: BadgeTier): string {
  switch (tier) {
    case 'bronze': return styles.tierBronze;
    case 'silver': return styles.tierSilver;
    case 'gold': return styles.tierGold;
    case 'platinum': return styles.tierPlatinum;
    case 'diamond': return styles.tierDiamond;
    default: return '';
  }
}

export default function BadgeSelectModal({
  isOpen,
  onClose,
  unlockedBadgeIds,
  selectedBadgeId,
  onEquip
}: BadgeSelectModalProps) {
  const [activeTab, setActiveTab] = useState<BadgeCategory | 'all'>('all');

  if (!isOpen) return null;

  const filteredBadges = BADGES.filter(b => activeTab === 'all' || b.category === activeTab);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>칭호 선택</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className={styles.tabBar}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`${styles.tabBtn} ${activeTab === cat.id ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className={styles.content}>
          {filteredBadges.map((badge) => {
            const isUnlocked = unlockedBadgeIds.includes(badge.id);
            const isSelected = selectedBadgeId === badge.id;
            const tierClass = isUnlocked ? getTierClass(badge.tier) : '';

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
                className={`${styles.badgeItem} ${isUnlocked ? styles.unlocked : styles.locked} ${isSelected ? styles.selected : ''} ${tierClass}`}
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
