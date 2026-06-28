'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@vinyla/core-api';
import styles from './SideNav.module.css';

const navItems = [
  { name: '컬렉션', path: '/',         icon: 'shelves' },
  { name: '탐색',   path: '/search',   icon: 'travel_explore' },
  { name: '위시리스트', path: '/wishlist', icon: 'bookmark' },
  { name: '마이페이지', path: '/my',    icon: 'person' },
];

export const SideNav: React.FC = () => {
  const pathname = usePathname();
  const { user, initializeAuth } = useAuthStore();

  React.useEffect(() => {
    initializeAuth();
  }, []);

  return (
    <nav className={styles.sidebar}>
      {/* Brand */}
      <div className={styles.brand}>
        <div className={styles.brandIcon}>
          <span className="material-symbols-outlined">album</span>
        </div>
        <div className={styles.brandText}>
          <span className={styles.brandName}>VinylA</span>
          <span className={styles.brandTagline}>vinyl archive</span>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Main Nav */}
      <div className={styles.nav}>
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.name}
              href={item.path}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <span
                className={`material-symbols-outlined ${styles.navIcon}`}
                style={{ fontVariationSettings: isActive ? "'FILL' 1, 'wght' 400" : "'FILL' 0, 'wght' 300" }}
              >
                {item.icon}
              </span>
              <span className={styles.navLabel}>{item.name}</span>
            </Link>
          );
        })}
      </div>

      {/* Bottom */}
      <div className={styles.bottom}>
        <div className={styles.bottomDivider} />
        {user ? (
          <div className={styles.navItem} style={{ color: 'var(--text-muted)' }} onClick={async () => {
            const { signOut } = await import('@vinyla/core-api');
            await signOut();
            window.location.href = '/login';
          }}>
            <span className={`material-symbols-outlined ${styles.navIcon}`}>logout</span>
            <span className={styles.navLabel}>로그아웃</span>
          </div>
        ) : (
          <Link href="/login" className={styles.navItem} style={{ color: 'var(--text-muted)' }}>
            <span className={`material-symbols-outlined ${styles.navIcon}`}>login</span>
            <span className={styles.navLabel}>로그인</span>
          </Link>
        )}
      </div>
    </nav>
  );
};
