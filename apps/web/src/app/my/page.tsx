'use client';

import React from 'react';
import styles from './page.module.css';

const timeline = [
  { date: 'Oct 24, 2023', caption: 'Acquired at Vintage Records NYC', img: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=400&auto=format&fit=crop' },
  { date: 'Sep 12, 2023', caption: 'Gifted by a friend', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop' },
  { date: 'Aug 05, 2023', caption: 'Found in a thrift store', img: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=400&auto=format&fit=crop' },
];

export default function MyProfilePage() {
  return (
    <div className={`${styles.container} hide-scroll`}>
      {/* Profile Header */}
      <header className={styles.header}>
        <div className={styles.profileSection}>
          <div className={styles.avatarWrapper}>
            <div className={styles.avatarImage} />
          </div>
          <div className={styles.profileInfo}>
            <h1 className={styles.userName}>Alexander Wright</h1>
            <div className={styles.badge}>
              <span className={`material-symbols-outlined ${styles.badgeIcon}`}>verified</span>
              <span className={styles.badgeText}>Elite Curator</span>
            </div>
          </div>
        </div>
      </header>

      {/* Vault Analytics */}
      <section>
        <div className={styles.analyticsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Collection Value</span>
            <span className={styles.statValue}>$12,450</span>
            <span className={styles.statSubtext}>Estimated Market Value</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Records</span>
            <span className={styles.statValue}>342</span>
            <span className={styles.statSubtext}>+12 this month</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Top Genre</span>
            <span className={styles.statValue}>Jazz Noir</span>
            <span className={styles.statSubtext}>45% of collection</span>
          </div>
        </div>
      </section>

      {/* Musical Journey (Timeline) */}
      <section>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Musical Journey</h2>
        </div>
        <div className={styles.timeline}>
          {timeline.map((item, idx) => (
            <div key={idx} className={styles.timelineItem}>
              <div className={styles.polaroid}>
                <div 
                  className={styles.polaroidImage} 
                  style={{ backgroundImage: `url(${item.img})` }} 
                />
                <span className={styles.polaroidCaption}>{item.caption}</span>
              </div>
              <span className={styles.timelineDate}>{item.date}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Profile Actions */}
      <section className={styles.actionSection}>
        <button className={styles.actionPrimary}>Edit Collection</button>
        <button className={styles.actionSecondary}>Export Vault Data</button>
      </section>
    </div>
  );
}
