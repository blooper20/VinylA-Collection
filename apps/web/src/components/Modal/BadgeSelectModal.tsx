import React, { useState } from 'react';
import styles from './BadgeSelectModal.module.css';
import { BADGES, BadgeCategory, BadgeTier, getBadgeText } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';

interface BadgeSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  unlockedBadgeIds: string[];
  selectedBadgeId: string | null;
  onEquip: (badgeId: string) => void;
}

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
  const { locale, t } = useLocale();

  if (!isOpen) return null;

  const CATEGORIES: { id: BadgeCategory | 'all', label: string }[] = [
    { id: 'all', label: t('badgeSelect.categoryAll') },
    { id: 'collection', label: t('badgeSelect.categoryCollection') },
    { id: 'wealth', label: t('badgeSelect.categoryWealth') },
    { id: 'wishlist', label: t('badgeSelect.categoryWishlist') },
    { id: 'genre', label: t('badgeSelect.categoryGenre') },
  ];

  const filteredBadges = BADGES.filter(b => activeTab === 'all' || b.category === activeTab);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{t('badgeSelect.title')}</h3>
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
                    <div className={styles.badgeName}>{t('badgeSelect.hiddenName')}</div>
                    <div className={styles.badgeDesc}>{t('badgeSelect.hiddenDesc')}</div>
                  </div>
                </div>
              );
            }

            const { name, description } = getBadgeText(badge, locale, t);

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
                  <div className={styles.badgeName}>{name}</div>
                  <div className={styles.badgeDesc}>{description}</div>
                </div>
                {isUnlocked && (
                  <div>
                    {isSelected ? (
                      <div className={styles.equippedBtn}>{t('badgeSelect.equipped')}</div>
                    ) : (
                      <button className={styles.equipBtn}>{t('badgeSelect.equip')}</button>
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
