'use client';

import React from 'react';
import styles from './page.module.css';

const wantedRecords = [
  { 
    title: 'Bitches Brew', 
    artist: 'Miles Davis', 
    priority: 'HIGH', 
    priorityClass: styles.priorityHigh, 
    progress: '90%', 
    shops: 4, 
    img: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=200&auto=format&fit=crop' 
  },
  { 
    title: 'A Love Supreme', 
    artist: 'John Coltrane', 
    priority: 'MEDIUM', 
    priorityClass: styles.priorityMedium, 
    progress: '45%', 
    shops: 2, 
    img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=200&auto=format&fit=crop' 
  },
  { 
    title: 'Pastel Blues', 
    artist: 'Nina Simone', 
    priority: 'LOW', 
    priorityClass: styles.priorityLow, 
    progress: '15%', 
    shops: 1, 
    img: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=200&auto=format&fit=crop' 
  },
];

export default function WishlistPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <span className={styles.headerSubtitle}>Wishlist Spotlight</span>
        <h1 className={styles.headerTitle}>Rare Findings</h1>
      </header>

      <div className={styles.grid}>
        {/* Spotlight Card */}
        <div className={styles.spotlightCard}>
          <div className={styles.spotlightImageContainer}>
            <img 
              src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop" 
              alt="Rare Vinyl LP" 
              className={styles.spotlightImage} 
            />
            <div className={styles.spotlightBadge}>RARE FIND</div>
          </div>
          <div className={styles.spotlightContent}>
            <div>
              <h2 className={styles.spotlightTitle}>The Black Saint and the Sinner Lady</h2>
              <p className={styles.spotlightArtist}>Charles Mingus (1963 Mono Pressing)</p>
            </div>
            <div className={styles.spotlightTags}>
              <span className={styles.tag}>JAZZ</span>
              <span className={styles.tag}>IMPROV</span>
            </div>
            <div className={styles.spotlightPrice}>$1,240</div>
          </div>
        </div>

        {/* Wanted List */}
        <div>
          <div className={styles.listHeader}>
            <h3 className={styles.listTitle}>WANTED RECORDS ({wantedRecords.length})</h3>
            <span className="material-symbols-outlined">sort</span>
          </div>

          <div className={styles.wantedList}>
            {wantedRecords.map((record, idx) => (
              <div key={idx} className={styles.wantedItem}>
                <div className={`${styles.priorityLine} ${record.priorityClass}`} />
                <div 
                  className={styles.itemImage} 
                  style={{ backgroundImage: `url(${record.img})` }} 
                />
                <div className={styles.itemContent}>
                  <h4 className={styles.itemTitle}>{record.title}</h4>
                  <p className={styles.itemArtist}>{record.artist}</p>
                  <div>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: record.progress }} />
                    </div>
                    <div className={styles.priorityLabel}>{record.priority} PRIORITY</div>
                  </div>
                </div>
                <div className={styles.itemActions}>
                  <button className="material-symbols-outlined" style={{ background: 'none', border: 'none', color: 'var(--text-secondary)' }}>
                    more_vert
                  </button>
                  <span className={styles.shopCount}>{record.shops} SHOP</span>
                </div>
              </div>
            ))}
          </div>

          {/* Curator's Log */}
          <div className={styles.curatorLog}>
            <div className={styles.logHeader}>
              <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>edit_note</span>
              <h3 className={styles.logTitle}>Curator's Log</h3>
            </div>
            <div className={styles.logContent}>
              <p className={styles.logText}>
                "Still tracking that 1963 Mingus pressing. The dynamic range on the mono version is significantly superior to the '70s reissues. Priority remains high for the quarter. Need to check the Tokyo markets next Tuesday."
              </p>
              <div className={styles.logFooter}>
                <span className={styles.logDate}>Updated 2h ago</span>
                <button className={styles.editButton}>EDIT LOG</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
