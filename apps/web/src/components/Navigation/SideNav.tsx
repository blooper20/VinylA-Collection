'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@vinyla/core-api';
import styles from './SideNav.module.css';

const navItems = [
  { name: '컬렉션', path: '/collection', icon: 'shelves' },
  { name: '탐색',   path: '/search',     icon: 'travel_explore' },
  { name: '위시리스트', path: '/wishlist',   icon: 'bookmark' },
  { name: '마이페이지', path: '/my',         icon: 'person' },
  { name: '문의하기', path: '/support',    icon: 'support_agent' },
];

const adminNavItem = { name: '관리자', path: '/admin', icon: 'admin_panel_settings' };

export const SideNav: React.FC = () => {
  const pathname = usePathname();
  const { user, initializeAuth } = useAuthStore();

  React.useEffect(() => {
    initializeAuth();
  }, []);

  if (pathname === '/' || pathname === '/login' || pathname === '/unauthorized') {
    return null;
  }

  return (
    <>
      <nav className={styles.sidebar}>
        {/* Brand */}
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <img src="/logo.png" alt="VinylA Collection Logo" className={styles.logoImage} />
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>VinylA</span>
            <span className={styles.brandTagline}>Collection</span>
          </div>
        </div>

        <div className={styles.divider} />

        {/* Main Nav — admin item only for accounts with app_metadata.role === 'admin' */}
        <div className={styles.nav}>
          {[...navItems, ...(user?.app_metadata?.role === 'admin' ? [adminNavItem] : [])].map((item) => {
            const isActive = item.path === '/admin' ? pathname.startsWith('/admin') : pathname === item.path;
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
            window.location.href = '/';
          }}>
            <span className={`material-symbols-outlined ${styles.navIcon}`}>logout</span>
            <span className={styles.navLabel}>로그아웃</span>
          </div>
        ) : (
          <Link href="/" className={styles.navItem} style={{ color: 'var(--text-muted)' }}>
            <span className={`material-symbols-outlined ${styles.navIcon}`}>login</span>
            <span className={styles.navLabel}>로그인</span>
          </Link>
        )}
      </div>
    </nav>
    </>
  );
};
