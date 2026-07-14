'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore, getUnreadNotificationCount, subscribeToNotifications } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import styles from './SideNav.module.css';

export const SideNav: React.FC = () => {
  const pathname = usePathname();
  const { user, initializeAuth } = useAuthStore();
  const { locale, setLocale, t } = useLocale();
  const [unreadCount, setUnreadCount] = React.useState(0);

  React.useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // 미읽음 알림 배지 — 최초 로드 + Realtime(새 알림) + 알림함 열람 시 초기화
  React.useEffect(() => {
    if (!user?.id) { setUnreadCount(0); return; }
    getUnreadNotificationCount().then(setUnreadCount);
    const unsubscribe = subscribeToNotifications(() => {
      getUnreadNotificationCount().then(setUnreadCount);
    });
    const onRead = () => setUnreadCount(0);
    window.addEventListener('NOTIFICATIONS_READ', onRead);
    return () => {
      unsubscribe();
      window.removeEventListener('NOTIFICATIONS_READ', onRead);
    };
  }, [user?.id]);

  type NavItem = { name: string; path: string; icon: string; badge?: number };
  const navItems: NavItem[] = [
    { name: t('nav.collection'), path: '/collection', icon: 'shelves' },
    { name: t('nav.search'), path: '/search', icon: 'travel_explore' },
    { name: t('nav.wishlist'), path: '/wishlist', icon: 'bookmark' },
    { name: t('nav.log'), path: '/log', icon: 'graphic_eq' },
    { name: t('nav.feed'), path: '/feed', icon: 'rss_feed' },
    { name: t('nav.story'), path: '/story', icon: 'auto_stories' },
    { name: t('nav.notifications'), path: '/notifications', icon: 'notifications', badge: unreadCount },
    { name: t('nav.my'), path: '/my', icon: 'person' },
    { name: t('nav.support'), path: '/support', icon: 'support_agent' },
  ];

  const adminNavItem: NavItem = { name: t('nav.admin'), path: '/admin', icon: 'admin_panel_settings' };

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
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  <span
                    className={`material-symbols-outlined ${styles.navIcon}`}
                    style={{ fontVariationSettings: isActive ? "'FILL' 1, 'wght' 400" : "'FILL' 0, 'wght' 300" }}
                  >
                    {item.icon}
                  </span>
                  {!!item.badge && item.badge > 0 && (
                    <span
                      style={{
                        position: 'absolute', top: '-4px', right: '-6px',
                        minWidth: '16px', height: '16px', padding: '0 4px',
                        borderRadius: '999px', background: '#ff4d6d', color: '#fff',
                        fontSize: '10px', fontWeight: 700, lineHeight: '16px',
                        textAlign: 'center',
                      }}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </span>
                <span className={styles.navLabel}>{item.name}</span>
              </Link>
            );
          })}
        </div>

      {/* Bottom */}
      <div className={styles.bottom}>
        <div
          className={styles.navItem}
          style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
          onClick={() => setLocale(locale === 'ko' ? 'en' : 'ko')}
        >
          <span className={`material-symbols-outlined ${styles.navIcon}`}>language</span>
          <span className={styles.navLabel}>{locale === 'ko' ? 'EN' : 'KO'}</span>
        </div>
        <div className={styles.bottomDivider} />
        {user ? (
          <div className={styles.navItem} style={{ color: 'var(--text-muted)' }} onClick={async () => {
            const { signOut } = await import('@vinyla/core-api');
            await signOut();
            window.location.href = '/';
          }}>
            <span className={`material-symbols-outlined ${styles.navIcon}`}>logout</span>
            <span className={styles.navLabel}>{t('nav.logout')}</span>
          </div>
        ) : (
          <Link href="/" className={styles.navItem} style={{ color: 'var(--text-muted)' }}>
            <span className={`material-symbols-outlined ${styles.navIcon}`}>login</span>
            <span className={styles.navLabel}>{t('common.login')}</span>
          </Link>
        )}
      </div>
    </nav>
    </>
  );
};
