'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './SideNav.module.css';

export const SideNav: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { name: 'Gallery', path: '/', icon: 'grid_view' },
    { name: 'Vault', path: '/my', icon: 'shelves' },
    { name: 'Discovery', path: '/search', icon: 'explore' },
  ];

  return (
    <nav className={`${styles.sidebar} group`}>
      <div className={styles.header}>
        <div className={styles.avatar}>
          <span className="material-symbols-outlined">heart_minus</span>
        </div>
        <div className={styles.brandLabel}>
          <div className={styles.brandTitle}>The Vault</div>
          <div className={styles.brandSubtitle}>Elite Membership</div>
        </div>
      </div>

      <div className={styles.navLinks}>
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link href={item.path} key={item.name} className={`${styles.navItem} ${isActive ? styles.active : ''}`}>
              <span className={`material-symbols-outlined ${styles.navIcon}`} style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                {item.icon}
              </span>
              <span className={styles.navLabel}>{item.name}</span>
            </Link>
          );
        })}
        
        <Link href="/settings" className={`${styles.navItem} ${styles.settingsLink}`}>
          <span className={`material-symbols-outlined ${styles.navIcon}`}>settings</span>
          <span className={styles.navLabel}>Settings</span>
        </Link>
      </div>
    </nav>
  );
};
