import React, { forwardRef, useEffect, useState } from 'react';
import styles from './BadgeShareTemplate.module.css';
import { Badge, BadgeTier } from '@vinyla/core-api';

interface BadgeShareTemplateProps {
  badge: Badge;
  badgeText: { name: string; description: string };
  username: string;
  isHolographic: boolean;
}

const TIER_HEX: Record<BadgeTier, string> = {
  bronze: '#cd7f32',
  silver: '#c0c0c0',
  gold: '#d4af37',
  platinum: '#e5e4e2',
  diamond: '#b9f2ff',
};

const TIER_LABEL: Record<BadgeTier, string> = {
  bronze: 'BRONZE TIER',
  silver: 'SILVER TIER',
  gold: 'GOLD TIER',
  platinum: 'PLATINUM TIER',
  diamond: 'DIAMOND TIER',
};

const TIER_CLASS: Record<BadgeTier, string> = {
  bronze: styles.tierBronze,
  silver: styles.tierSilver,
  gold: styles.tierGold,
  platinum: styles.tierPlatinum,
  diamond: styles.tierDiamond,
};

// dom-to-image-more snapshots the DOM through an SVG foreignObject and can't
// reach across CORS to read the Google-Fonts-hosted Material Symbols
// stylesheet, so a live <span className="material-symbols-outlined"> silently
// falls back to the raw ligature text (e.g. "workspace_premium") in the
// exported image. Pre-rendering the glyph onto an offscreen <canvas> — a
// same-origin Canvas 2D call, no stylesheet fetch involved — and embedding the
// result as a data: <img> sidesteps that entirely.
const useIconDataUrl = (icon: string, tier: BadgeTier, isHolographic: boolean) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await document.fonts.load('400 200px "Material Symbols Outlined"');
      } catch { /* best effort — the font is almost certainly already loaded elsewhere on the page */ }
      if (cancelled) return;

      const size = 480;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.font = `400 ${size * 0.52}px "Material Symbols Outlined"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (isHolographic) {
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, '#ff6ec4');
        gradient.addColorStop(0.25, '#ffd76e');
        gradient.addColorStop(0.5, '#6effe0');
        gradient.addColorStop(0.75, '#6e9fff');
        gradient.addColorStop(1, '#d76eff');
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = TIER_HEX[tier];
      }

      ctx.fillText(icon, size / 2, size / 2 + size * 0.03);
      if (!cancelled) setDataUrl(canvas.toDataURL('image/png'));
    })();
    return () => { cancelled = true; };
  }, [icon, tier, isHolographic]);

  return dataUrl;
};

export const BadgeShareTemplate = forwardRef<HTMLDivElement, BadgeShareTemplateProps>(
  ({ badge, badgeText, username, isHolographic }, ref) => {
    const tierClass = TIER_CLASS[badge.tier];
    const iconDataUrl = useIconDataUrl(badge.icon, badge.tier, isHolographic);

    return (
      <div className={styles.offscreenContainer}>
        <div ref={ref} className={`${styles.storyFrame} ${tierClass}`}>
          <div className={styles.glow} />

          <div className={styles.contentGroup}>
            <div className={`${styles.chip} ${isHolographic ? styles.holographicText : ''}`}>
              {badge.isHidden ? '★ HIDDEN BADGE ★' : TIER_LABEL[badge.tier]}
            </div>

            <div className={styles.medalWrapper}>
              {isHolographic && (
                <>
                  <span className={`${styles.sparkle} ${styles.sparkleTopLeft}`}>✦</span>
                  <span className={`${styles.sparkle} ${styles.sparkleTopRight}`}>✦</span>
                  <span className={`${styles.sparkle} ${styles.sparkleBottomLeft}`}>✦</span>
                </>
              )}
              <div className={`${styles.medal} ${isHolographic ? styles.medalHolo : ''}`}>
                <div className={styles.medalInner}>
                  {iconDataUrl && <img src={iconDataUrl} alt={badge.icon} className={styles.iconImage} />}
                </div>
              </div>
            </div>

            <div className={styles.infoBox}>
              <h2 className={`${styles.name} ${isHolographic ? styles.holographicText : ''}`}>
                {badgeText.name}
              </h2>
              <div className={styles.divider} />
              <p className={styles.description}>{badgeText.description}</p>
            </div>
          </div>

          <div className={styles.watermark}>
            <span className={styles.user}>@{username}</span>
            <div className={styles.brandWrapper}>
              <img
                src="/logo_transparent.png"
                alt="VinylA Collection Logo"
                style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                onError={(e) => { e.currentTarget.src = '/logo.png'; e.currentTarget.style.mixBlendMode = 'screen'; }}
                crossOrigin="anonymous"
              />
              <span className={styles.brand}>Curated by VinylA Collection</span>
            </div>
            <span className={styles.url}>vinyla.vercel.app</span>
          </div>
        </div>
      </div>
    );
  }
);

BadgeShareTemplate.displayName = 'BadgeShareTemplate';
