'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore, getUnreadNotificationCount, subscribeToNotifications } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { CommunityPostCategory } from '@vinyla/shared-types';
import styles from './SideNav.module.css';

type SideNavMode = 'collection' | 'community';
// LOCATION은 실제 DB 카테고리가 아니다(CommunityPostCategory에 없음) — 지도
// SDK 도입 전까지 "준비 중" 안내만 보여주는 자리표시 카테고리라 UI 쪽 목록에만 존재한다.
type CommunityNavCategory = CommunityPostCategory | 'LOCATION';
const FLIP_MS = 220;
const COMMUNITY_CATEGORIES: CommunityNavCategory[] = ['FREE', 'ARRIVAL', 'LISTENING_ROOM', 'INFO', 'TIP', 'QNA', 'LOCATION'];
const CATEGORY_ICON: Record<CommunityNavCategory, string> = {
  ARRIVAL: 'inventory_2',
  FREE: 'chat_bubble',
  QNA: 'help',
  INFO: 'storefront',
  LISTENING_ROOM: 'speaker',
  TIP: 'lightbulb',
  LOCATION: 'map',
};

// useSearchParams()(카테고리 하이라이트용)가 정적 생성 페이지를 전부 강제
// 동적 렌더링으로 만들지 않도록, 그 훅을 쓰는 부분만 Suspense로 감싼다.
export const SideNav: React.FC = () => (
  <Suspense fallback={null}>
    <SideNavInner />
  </Suspense>
);

const SideNavInner: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, initializeAuth } = useAuthStore();
  const { locale, setLocale, t } = useLocale();
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [expanded, setExpanded] = React.useState(false);
  const navRef = React.useRef<HTMLElement>(null);
  const toggleRef = React.useRef<HTMLButtonElement>(null);

  // 커뮤니티 모드로 전환하면 사이드 메뉴 자체가 통째로 바뀐다(컬렉션 관련
  // 항목 ↔ 게시판 카테고리 목록). pathname 기반이라 뒤로가기/직접 URL
  // 진입에도 항상 올바른 모드로 맞춰진다.
  const pathMode: SideNavMode = pathname.startsWith('/community') ? 'community' : 'collection';
  const [displayMode, setDisplayMode] = React.useState<SideNavMode>(pathMode);
  const [flipDeg, setFlipDeg] = React.useState(0);
  const [flipInstant, setFlipInstant] = React.useState(false);
  const isFlippingRef = React.useRef(false);

  // 카드 뒤집기 트릭: 0deg → -90deg로 애니메이션(뒤집혀 사라짐) → 그 순간
  // 메뉴 목록을 교체하고 트랜지션 없이 +90deg로 순간 이동(반대편에서 보이지
  // 않는 채로 대기) → 다시 0deg로 애니메이션(뒤집히며 나타남). 두 번의
  // requestAnimationFrame으로 "트랜지션 없는 순간 이동"이 실제로 한 프레임
  // 그려진 뒤에 트랜지션을 되살려야 브라우저가 두 번째 회전도 애니메이션한다.
  const flipToMode = React.useCallback((nextMode: SideNavMode) => {
    if (isFlippingRef.current || nextMode === displayMode) return;
    isFlippingRef.current = true;
    setFlipInstant(false);
    setFlipDeg(-90);
    window.setTimeout(() => {
      setDisplayMode(nextMode);
      setFlipInstant(true);
      setFlipDeg(90);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFlipInstant(false);
          setFlipDeg(0);
          window.setTimeout(() => { isFlippingRef.current = false; }, FLIP_MS);
        });
      });
    }, FLIP_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMode]);

  React.useEffect(() => {
    if (pathMode !== displayMode && !isFlippingRef.current) flipToMode(pathMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathMode]);

  const switchMode = (nextMode: SideNavMode) => {
    if (nextMode === displayMode) return;
    flipToMode(nextMode);
    router.push(nextMode === 'community' ? '/community' : '/collection');
  };

  React.useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // 라우트가 바뀌면 (뒤로가기 등 Link onClick을 거치지 않는 경우 포함) 자동으로 접는다
  React.useEffect(() => {
    setExpanded(false);
  }, [pathname]);

  // 펼친 상태에서 사이드바 바깥을 탭/클릭하면 접는다.
  // 모바일 플로팅 토글 버튼은 <nav> 밖에 있어서 "바깥"으로 오인되면
  // pointerdown이 먼저 닫고 click이 다시 여는 무한 토글 버그가 생긴다 — 제외.
  React.useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (navRef.current?.contains(target)) return;
      if (toggleRef.current?.contains(target)) return;
      setExpanded(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [expanded]);

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

  // 컬렉션(+위시리스트)과 소셜(피드+다이어리)은 페이지 내 탭으로 통합 —
  // match는 그룹의 다른 탭 경로에서도 메뉴가 활성으로 보이게 한다
  type NavItem = { name: string; path: string; icon: string; badge?: number; match?: string[] };
  const collectionNavItems: NavItem[] = [
    { name: t('nav.collection'), path: '/collection', icon: 'shelves', match: ['/collection', '/wishlist'] },
    { name: t('nav.search'), path: '/search', icon: 'travel_explore' },
    { name: t('nav.social'), path: '/feed', icon: 'rss_feed', match: ['/feed', '/log'] },
    { name: t('nav.notice'), path: '/notices', icon: 'campaign' },
    { name: t('nav.notifications'), path: '/notifications', icon: 'notifications', badge: unreadCount },
    { name: t('nav.my'), path: '/my', icon: 'person' },
    { name: t('nav.support'), path: '/support', icon: 'support_agent' },
  ];

  const currentCategoryParam = searchParams.get('category');
  const communityNavItems: NavItem[] = [
    { name: t('communityBoard.allCategoriesTab'), path: '/community', icon: 'forum' },
    ...COMMUNITY_CATEGORIES.map((c) => ({
      name: t(`communityBoard.categories.${c}` as any),
      path: `/community?category=${c}`,
      icon: CATEGORY_ICON[c],
    })),
  ];

  const adminNavItem: NavItem = { name: t('nav.admin'), path: '/admin', icon: 'admin_panel_settings' };

  const activeNavItems = displayMode === 'community'
    ? communityNavItems
    : [...collectionNavItems, ...(user?.app_metadata?.role === 'admin' ? [adminNavItem] : [])];

  const isItemActive = (item: NavItem) => {
    if (displayMode === 'community') {
      if (pathname !== '/community') return false;
      const itemCategory = item.path.includes('category=') ? item.path.split('category=')[1] : null;
      return itemCategory ? currentCategoryParam === itemCategory : !currentCategoryParam;
    }
    if (item.path === '/admin') return pathname.startsWith('/admin');
    if (item.match) return item.match.includes(pathname);
    return pathname === item.path;
  };

  return (
    <>
      <button
        ref={toggleRef}
        type="button"
        className={styles.mobileToggle}
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? t('nav.collapse') : t('nav.expand')}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
          {expanded ? 'close' : 'menu'}
        </span>
      </button>

      {expanded && <div className={styles.backdrop} onClick={() => setExpanded(false)} />}

      <nav ref={navRef} className={`${styles.sidebar} ${expanded ? styles.expanded : ''}`}>
        {/* Brand — 로고 호버/탭 시 인스타그램 핸들 툴팁, 툴팁을 클릭해야 이동 */}
        <div className={styles.brand}>
          <div className={styles.brandLink}>
            <div className={styles.brandIcon}>
              <img src="/logo.png" alt="VinylA Collection Logo" className={styles.logoImage} />
            </div>
            <a
              href="https://www.instagram.com/vinyla_collection/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.brandTooltip}
              aria-label="VinylA 공식 인스타그램 @vinyla_collection"
            >
              @vinyla_collection
            </a>
          </div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>VinylA</span>
            <span className={styles.brandTagline}>Collection</span>
          </div>
        </div>

        <div className={styles.divider} />

        {/* 컬렉션 ↔ 커뮤니티 모드 스위치 — 누르면 메뉴 전체가 뒤집히며 교체된다.
            접힌 레일에서는 두 버튼이 나란히 들어갈 공간이 없어 라벨 없는
            전환 아이콘 하나만 보여주고, 펼쳐지면(호버/탭) 라벨 달린 두 버튼으로
            바뀐다 — .navLabel과 같은 opacity 트랜지션 대신 display 자체를
            토글해 접힌 상태에서 텅 빈 사각형 두 개로 보이는 문제를 없앤다. */}
        <button
          type="button"
          className={styles.modeToggleCollapsed}
          onClick={() => switchMode(displayMode === 'collection' ? 'community' : 'collection')}
          aria-label={t('nav.communityBoard')}
        >
          <span className={`material-symbols-outlined ${styles.navIcon}`}>sync_alt</span>
        </button>
        <div className={styles.modeSwitchExpanded}>
          <button
            type="button"
            className={`${styles.modeSwitchBtn} ${displayMode === 'collection' ? styles.modeSwitchActive : ''}`}
            onClick={() => switchMode('collection')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>shelves</span>
            <span className={styles.navLabel}>{t('nav.collection')}</span>
          </button>
          <button
            type="button"
            className={`${styles.modeSwitchBtn} ${displayMode === 'community' ? styles.modeSwitchActive : ''}`}
            onClick={() => switchMode('community')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>forum</span>
            <span className={styles.navLabel}>{t('nav.communityBoard')}</span>
          </button>
        </div>

        {/* Main Nav — 모드에 따라 완전히 다른 목록이 3D 플립으로 전환된다 */}
        <div className={styles.navFlipViewport}>
          <div
            className={styles.navFlipInner}
            style={{
              transform: `rotateX(${flipDeg}deg)`,
              transition: flipInstant ? 'none' : `transform ${FLIP_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
          >
            <div className={styles.nav}>
              {activeNavItems.map((item) => {
                const isActive = isItemActive(item);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setExpanded(false)}
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
          </div>
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
