'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { createDiscogsSearchSession, DiscogsSearchSession, AlbumItem, SearchStatus, SearchMode, useAuthStore, getUserVinyls } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { MockVinylData, USER_VINYL } from '@vinyla/shared-types';
import { DetailModal } from '../../components/Modal/DetailModal';
import styles from './page.module.css';

// 검색 결과(AlbumItem)에서 DetailModal로 넘기는 앨범 형태
type SelectedAlbum = {
  ALBUM_ID: number | string;
  TITLE: string;
  ARTIST: string;
  IMAGE_URL: string;
  RELEASE_YEAR: number | string;
  GENRES?: string[];
  STATUS?: 'OWNED' | 'WISH' | 'NONE';
  coverCandidates?: { appleMusic?: string; aladin?: string; discogs?: string };
  // The specific Discogs release this search hit matched — lets the
  // tracklist fetch use this exact pressing's real tracks/sides instead of
  // the master's generic one. Undefined for Aladin-sourced items.
  DISCOGS_RELEASE_ID?: number;
};

// ISO 3166-1 alpha-2 codes for every UN member/observer state plus Hong Kong
// and Taiwan, which Discogs tags as their own release country distinct from
// China. Used to build the search page's country filter dropdown.
const COUNTRY_CODES = [
  'AF','AL','DZ','AD','AO','AG','AR','AM','AU','AT','AZ','BS','BH','BD','BB','BY','BE','BZ','BJ','BT',
  'BO','BA','BW','BR','BN','BG','BF','BI','CV','KH','CM','CA','CF','TD','CL','CN','CO','KM','CG','CD',
  'CR','CI','HR','CU','CY','CZ','DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FJ','FI',
  'FR','GA','GM','GE','DE','GH','GR','GD','GT','GN','GW','GY','HT','HN','HK','HU','IS','IN','ID','IR',
  'IQ','IE','IL','IT','JM','JP','JO','KZ','KE','KI','KP','KR','KW','KG','LA','LV','LB','LS','LR','LY',
  'LI','LT','LU','MG','MW','MY','MV','ML','MT','MH','MR','MU','MX','FM','MD','MC','MN','ME','MA','MZ',
  'MM','NA','NR','NP','NL','NZ','NI','NE','NG','MK','NO','OM','PK','PW','PA','PG','PY','PE','PH','PL',
  'PT','QA','RO','RU','RW','KN','LC','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SK','SI','SB',
  'SO','ZA','SS','ES','LK','SD','SR','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TO','TT','TN',
  'TR','TM','TV','UG','UA','AE','GB','US','UY','UZ','VU','VA','VE','VN','YE','ZM','ZW',
] as const;

// Discogs' own release-country strings occasionally deviate from
// Intl.DisplayNames's full English name (verified live: "United States"/
// "United Kingdom" return 0 results, "US"/"UK" are the values Discogs
// actually stores) — the dropdown label stays localized/full, only the
// value sent to Discogs is overridden.
const DISCOGS_COUNTRY_VALUE_OVERRIDES: Record<string, string> = { US: 'US', GB: 'UK' };

// Shown as one-tap shortcuts above the alphabetical list when the user
// hasn't typed anything yet — the markets most relevant to this Korean-first
// vinyl app's users, so they don't have to scroll/type for the common case.
const COUNTRY_QUICK_PICKS = ['KR', 'US', 'GB', 'JP', 'DE'] as const;

// ISO 3166-1 alpha-2 -> flag emoji via the regional indicator symbol trick
// (each letter maps to its Unicode "regional indicator" codepoint; two of
// them side by side render as that country's flag in every modern platform).
const countryCodeToFlag = (code: string): string =>
  String.fromCodePoint(...code.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

const genres = [
  { title: '팝',            sub: 'Pop',         height: 260, img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=800&auto=format&fit=crop' },
  { title: '록',            sub: 'Rock',        height: 320, img: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=800&auto=format&fit=crop' },
  { title: '재즈',          sub: 'Jazz',        height: 280, img: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?q=80&w=800&auto=format&fit=crop' },
  { title: '일렉트로닉',    sub: 'Electronic',  height: 240, img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop' },
  { title: '힙합',          sub: 'Hip Hop',     height: 300, img: 'https://images.unsplash.com/photo-1601643157091-ce5c665179ab?q=80&w=800&auto=format&fit=crop' },
  { title: '펑크 소울',     sub: 'Funk / Soul', height: 360, img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?q=80&w=800&auto=format&fit=crop' },
  { title: '인디 / 포크',   sub: 'Folk',        height: 280, img: 'https://images.unsplash.com/photo-1501612780327-45045538702b?q=80&w=800&auto=format&fit=crop' },
  { title: '클래식',        sub: 'Classical',   height: 260, img: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?q=80&w=800&auto=format&fit=crop' },
  { title: '블루스',        sub: 'Blues',       height: 240, img: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=800&auto=format&fit=crop' },
  { title: '레게',          sub: 'Reggae',      height: 300, img: 'https://upload.wikimedia.org/wikipedia/commons/6/60/Lenke_djembe_from_Mali.jpeg' },
  { title: '시네마틱',      sub: 'Cinematic',   height: 400, img: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=800&auto=format&fit=crop' },
  { title: '앰비언트',      sub: 'Ambient',     height: 220, img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop' },
  { title: '월드',          sub: 'World',       height: 260, img: 'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=800&auto=format&fit=crop' },
];

// ─── Skeleton card placeholder ───────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className={styles.masonryItem} style={{ pointerEvents: 'none' }}>
      <div className={styles.skeletonImage} />
      <div className={styles.genreContent}>
        <div className={styles.skeletonLine} style={{ width: '70%', height: 18, marginBottom: 8 }} />
        <div className={styles.skeletonLine} style={{ width: '45%', height: 14 }} />
      </div>
    </div>
  );
}

// ─── Result card with entrance animation ─────────────────────────────────────
function AlbumCard({ item, onSelect }: { item: AlbumItem; onSelect: (item: AlbumItem) => void }) {
  return (
    <div
      className={`${styles.masonryItem} ${styles.albumCardIn}`}
      onClick={() => onSelect(item)}
      style={{ cursor: 'pointer' }}
    >
      <img
        src={item.thumb || '/logo_real_transparent.png'}
        alt={item.title}
        className={styles.genreImage}
        style={{ 
          height: 260, 
          objectFit: item.thumb ? 'cover' : 'contain', 
          backgroundColor: item.thumb ? 'transparent' : '#161616',
          padding: item.thumb ? 0 : 30,
          border: item.thumb ? 'none' : '1px solid rgba(255,255,255,0.08)'
        }}
        loading="lazy"
      />
      <div className={styles.genreContent}>
        <h3 className={styles.genreTitle} style={{ fontSize: '18px' }}>{item.title}</h3>
        <p className={styles.genreSub}>{item.artist ? `${item.artist}` : ''}</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AlbumItem[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [totalToCheck, setTotalToCheck] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedAlbum, setSelectedAlbum] = useState<SelectedAlbum | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState<SearchMode>('auto');
  // Discogs release country filter ('' = no filter / "전체"). Beyond letting
  // a user pick "the pressing I actually own" among many legit results, it
  // doubles as a same-name-artist disambiguator for common names (e.g.
  // "Crush" pulls in hundreds of unrelated Western releases before 크러쉬's
  // own catalog; scoping to South Korea collapses that noise).
  const [country, setCountry] = useState<string>('');
  const observerTarget = useRef<HTMLDivElement>(null);

  const { user, initializeAuth } = useAuthStore();
  const { locale, t } = useLocale();
  const [userVinyls, setUserVinyls] = useState<USER_VINYL[]>([]);

  // Label localized to the site's locale, but the value sent to Discogs is
  // always the English name it stores release countries under (with the
  // US/UK override) — sorted by label so the dropdown reads alphabetically
  // in whichever language is showing.
  const countryOptions = useMemo(() => {
    const labelNames = new Intl.DisplayNames([locale === 'ko' ? 'ko' : 'en'], { type: 'region' });
    const valueNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return COUNTRY_CODES
      .map((code) => ({
        code,
        value: DISCOGS_COUNTRY_VALUE_OVERRIDES[code] ?? valueNames.of(code) ?? code,
        label: labelNames.of(code) ?? code,
        flag: countryCodeToFlag(code),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, locale === 'ko' ? 'ko' : 'en'));
  }, [locale]);

  const countryQuickPicks = useMemo(() => {
    const byCode = new Map(countryOptions.map((o) => [o.code, o]));
    return COUNTRY_QUICK_PICKS.map((code) => byCode.get(code)).filter((o): o is (typeof countryOptions)[number] => !!o);
  }, [countryOptions]);

  React.useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  React.useEffect(() => {
    async function loadData() {
      if (!user) {
        setUserVinyls([]);
        return;
      }
      const vinyls = await getUserVinyls(user.id);
      setUserVinyls(vinyls || []);
    }
    
    if (user !== undefined) loadData();

    const handleRefresh = () => loadData();
    window.addEventListener('REFRESH_VINYLS', handleRefresh);
    return () => window.removeEventListener('REFRESH_VINYLS', handleRefresh);
  }, [user]);

  // cancel token: if user starts a new search, discard stale callbacks
  const searchIdRef = useRef(0);
  // The live Discogs session — kept across scroll-triggered loads so paging
  // actually advances (a fresh session per load would refetch batch 0
  // forever). Replaced whenever a brand-new search starts.
  const sessionRef = useRef<DiscogsSearchSession | null>(null);

  React.useEffect(() => {
    const handleToast = (e: Event) => {
      setToastMessage((e as CustomEvent<{ message: string }>).detail.message);
      setTimeout(() => setToastMessage(null), 3000);
    };
    window.addEventListener('SHOW_TOAST', handleToast);
    return () => window.removeEventListener('SHOW_TOAST', handleToast);
  }, []);

  const executeSearch = useCallback(async (q: string, append: boolean = false, modeOverride?: SearchMode, countryOverride?: string) => {
    if (!q.trim()) {
      if (!append) setResults([]);
      setStatus('idle');
      return;
    }

    // Scroll-triggered load: advance the live session instead of starting a
    // fresh one — a new session restarts at batch 0 and would only ever
    // refetch the same first pages.
    if (append) {
      const more = await sessionRef.current?.loadMore();
      if (more === false) setHasMore(false);
      return;
    }

    const currentSearchId = ++searchIdRef.current;
    setResults([]);
    setTotalToCheck(0);
    setHasMore(true);
    setStatus('fetching_discogs');

    const session = createDiscogsSearchSession(
      q,
      (album) => {
        if (searchIdRef.current !== currentSearchId) return;
        setResults((prev) => {
          if (prev.some((a) => a.id === album.id)) return prev;
          return [...prev, album];
        });
      },
      (newStatus, total, error) => {
        if (searchIdRef.current !== currentSearchId) return;
        setStatus(newStatus);

        if (newStatus === 'error' && error) {
          import('@vinyla/core-api').then(({ getErrorMessage }) => {
            window.dispatchEvent(new CustomEvent('SHOW_TOAST', {
              detail: { message: getErrorMessage(error, t) }
            }));
          });
        }

        if (total !== undefined) {
          // total is already session-cumulative across batches
          setTotalToCheck(total);
          if ((newStatus === 'done' || newStatus === 'error') && total === 0) {
            setHasMore(false);
          }
        }
      },
      q.startsWith('#') ? 'auto' : (modeOverride ?? searchMode),
      q.startsWith('#') ? undefined : ((countryOverride ?? country) || undefined)
    );
    sessionRef.current = session;
    const more = await session.loadMore();
    if (searchIdRef.current === currentSearchId && more === false) setHasMore(false);
  }, [t, searchMode, country]);

  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && query.trim() && status === 'done' && hasMore) {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            executeSearch(query, true);
          }, 300);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
    // hasMore를 deps에 넣으면 무한 스크롤 fetch가 재트리거되므로 제외 (동작 유지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, executeSearch]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  }, [query, executeSearch]);

  const handleGenreClick = useCallback((genreTitle: string, genreSub: string) => {
    setQuery(`#${genreSub}`); // Show in search bar for context
    executeSearch(`#${genreSub}`);
  }, [executeSearch]);

  // 필터를 바꾸면 이미 입력해둔 검색어로 곧바로 다시 검색 (장르 검색 중엔 적용 안 됨).
  // setSearchMode는 다음 렌더까지 반영되지 않으므로, 이번 검색에는 modeOverride로 새 값을 바로 넘긴다.
  const handleModeChange = useCallback((mode: SearchMode) => {
    setSearchMode(mode);
    if (query.trim() && !query.startsWith('#')) {
      executeSearch(query, false, mode);
    }
  }, [query, executeSearch]);

  // setCountry는 다음 렌더까지 반영되지 않으므로, 이번 검색에는 countryOverride로 새 값을 바로 넘긴다.
  const handleCountryChange = useCallback((newCountry: string) => {
    setCountry(newCountry);
    if (query.trim() && !query.startsWith('#')) {
      executeSearch(query, false, undefined, newCountry);
    }
  }, [query, executeSearch]);

  // Searchable country combobox — a plain <select> makes browsing 196
  // countries painful (native type-ahead only jumps to the next name
  // starting with the last key pressed). This is a text input that filters
  // the list as you type, plus a manually-built dropdown listbox.
  const [countryInputValue, setCountryInputValue] = useState('');
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryHighlight, setCountryHighlight] = useState(0);
  // Anchor rect for the portaled dropdown (see below) — recomputed while
  // open so it tracks the input through scroll/resize.
  const [countryDropdownRect, setCountryDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const countryWrapRef = useRef<HTMLDivElement>(null);
  const countryInputRef = useRef<HTMLInputElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);

  const countryAllOption = useMemo(() => ({ code: '', value: '', label: t('search.countryAll'), flag: '🌐' }), [t]);

  // Keeps the input showing the *selected* country's label whenever the
  // dropdown isn't actively being edited — otherwise a stray typed query
  // (abandoned without picking anything) would stick in the box.
  React.useEffect(() => {
    if (countryOpen) return;
    const selected = country ? countryOptions.find((o) => o.value === country) : undefined;
    setCountryInputValue(selected ? `${selected.flag} ${selected.label}` : countryAllOption.label);
  }, [country, countryOptions, countryOpen, countryAllOption]);

  const filteredCountryOptions = useMemo(() => {
    const q = countryInputValue.trim().toLowerCase();
    if (!q) return [countryAllOption, ...countryOptions];
    const matches = countryOptions.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
    return countryAllOption.label.toLowerCase().includes(q) ? [countryAllOption, ...matches] : matches;
  }, [countryInputValue, countryOptions, countryAllOption]);

  React.useEffect(() => {
    if (!countryOpen) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideInput = countryWrapRef.current?.contains(target);
      // The dropdown itself is portaled to <body> (see render below), so it's
      // no longer a DOM descendant of countryWrapRef — check it separately or
      // every click on an option would register as "outside" and close first.
      const insideDropdown = countryDropdownRef.current?.contains(target);
      if (!insideInput && !insideDropdown) setCountryOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [countryOpen]);

  // .hero has overflow:hidden (clips the decorative gradient background),
  // which would clip an absolutely-positioned dropdown too since it'd be a
  // descendant — portal it to <body> instead and track the input's rect
  // manually so it still appears anchored right below the input.
  React.useEffect(() => {
    if (!countryOpen) return;
    const updateRect = () => {
      const el = countryInputRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setCountryDropdownRect({ top: rect.bottom + 8, left: rect.left, width: Math.max(rect.width, 240) });
    };
    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [countryOpen]);

  const selectCountryOption = useCallback((value: string) => {
    handleCountryChange(value);
    setCountryOpen(false);
    countryInputRef.current?.blur();
  }, [handleCountryChange]);

  const handleCountryInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!countryOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setCountryOpen(true);
        setCountryHighlight(0);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCountryHighlight((h) => Math.min(h + 1, filteredCountryOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCountryHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filteredCountryOptions[countryHighlight];
      if (opt) selectCountryOption(opt.value);
    } else if (e.key === 'Escape') {
      setCountryOpen(false);
      countryInputRef.current?.blur();
    }
  }, [countryOpen, filteredCountryOptions, countryHighlight, selectCountryOption]);

  const isLoading = status === 'fetching_discogs' || status === 'enriching';
  const isEnriching = status === 'enriching';

  const skeletonCount = status === 'fetching_discogs' && results.length === 0 
    ? 12 
    : isEnriching ? Math.max(0, totalToCheck - results.length) : 0;

  const mainResults = results.filter(r => !r.isFeature);
  const featuredResults = results.filter(r => r.isFeature);

  const sectionTitle = isLoading
    ? isEnriching
      ? t('search.enrichingProgress', { current: results.length, total: totalToCheck })
      : t('search.loadingDiscogs')
    : mainResults.length > 0
      ? t('search.resultsCount', { count: mainResults.length })
      : status === 'done'
        ? t('search.noResults')
        : status === 'error'
          ? t('search.rateLimited')
          : t('search.genreSectionDefault');

  return (
    <div className={styles.container}>
      <header className={styles.hero}>
        <div className={styles.heroGradient} />
        <div className={styles.heroInner}>
          <span className={styles.heroEyebrow}>Discover Archive</span>
          <h1 className={styles.heroTitle}>
            {t('search.heroLine1')}<br />
            <em>{t('search.heroEm')}</em>{t('search.heroSuffix')}
          </h1>
          <form className={styles.searchBar} onSubmit={handleSearch}>
            <span className={`material-symbols-outlined ${styles.searchIcon}`}>search</span>
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              className={styles.searchInput}
            />
            <button type="submit" style={{ display: 'none' }}>{t('search.submitButton')}</button>
          </form>
          {!query.startsWith('#') && (
            <div className={styles.searchModeRow} role="radiogroup" aria-label="search mode">
              {([
                ['auto', t('search.modeAuto')],
                ['artist', t('search.modeArtist')],
                ['album', t('search.modeAlbum')],
                ['track', t('search.modeTrack')],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={`${styles.searchModeBtn} ${searchMode === mode ? styles.searchModeBtnActive : ''}`}
                  onClick={() => handleModeChange(mode)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {!query.startsWith('#') && (
            <div className={styles.searchModeRow}>
              <div className={styles.countrySelectWrap} ref={countryWrapRef}>
                <span className={`material-symbols-outlined ${styles.countrySelectIcon}`}>public</span>
                <input
                  ref={countryInputRef}
                  type="text"
                  role="combobox"
                  aria-expanded={countryOpen}
                  aria-autocomplete="list"
                  aria-label="search country"
                  className={`${styles.countrySelect} ${country ? styles.countrySelectActive : ''}`}
                  value={countryInputValue}
                  onFocus={() => { setCountryOpen(true); setCountryHighlight(0); setCountryInputValue(''); }}
                  onChange={(e) => { setCountryInputValue(e.target.value); setCountryOpen(true); setCountryHighlight(0); }}
                  onKeyDown={handleCountryInputKeyDown}
                />
                <span className={`material-symbols-outlined ${styles.countrySelectChevron}`}>expand_more</span>
                {countryOpen && countryDropdownRect && typeof document !== 'undefined' && createPortal(
                  <div
                    ref={countryDropdownRef}
                    className={styles.countryDropdown}
                    style={{
                      position: 'fixed',
                      top: countryDropdownRect.top,
                      left: countryDropdownRect.left,
                      width: countryDropdownRect.width,
                    }}
                  >
                    {!countryInputValue.trim() && countryQuickPicks.length > 0 && (
                      <>
                        <div className={styles.countryDropdownSectionLabel}>{t('search.countryQuickPicks')}</div>
                        <div className={styles.countryQuickPickRow}>
                          {countryQuickPicks.map((opt) => (
                            <button
                              key={opt.code}
                              type="button"
                              className={`${styles.countryQuickPickChip} ${opt.value === country ? styles.countryQuickPickChipActive : ''}`}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectCountryOption(opt.value)}
                            >
                              <span>{opt.flag}</span> {opt.label}
                            </button>
                          ))}
                        </div>
                        <div className={styles.countryDropdownDivider} />
                      </>
                    )}
                    <ul className={styles.countryDropdownList} role="listbox">
                      {filteredCountryOptions.length === 0 && (
                        <li className={styles.countryDropdownEmpty}>{t('search.countryNoMatch')}</li>
                      )}
                      {filteredCountryOptions.map((opt, idx) => (
                        <li
                          key={opt.value || 'all'}
                          role="option"
                          aria-selected={opt.value === country}
                          className={[
                            styles.countryDropdownItem,
                            idx === countryHighlight ? styles.countryDropdownItemHighlight : '',
                            opt.value === country ? styles.countryDropdownItemSelected : '',
                          ].filter(Boolean).join(' ')}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setCountryHighlight(idx)}
                          onClick={() => selectCountryOption(opt.value)}
                        >
                          <span className={styles.countryDropdownItemFlag}>{opt.flag}</span>
                          <span className={styles.countryDropdownItemLabel}>{opt.label}</span>
                          {opt.value === country && (
                            <span className={`material-symbols-outlined ${styles.countryDropdownItemCheck}`}>check</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>,
                  document.body
                )}
              </div>
            </div>
          )}
          <Link href="/community-albums" className={styles.communityCta}>
            {t('search.communityCta')}
          </Link>
        </div>
      </header>

      <main className={styles.content}>
        <section>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{sectionTitle}</h2>
            {isEnriching && (
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: totalToCheck ? `${(results.length / totalToCheck) * 100}%` : '0%' }}
                />
              </div>
            )}
          </div>

          <div className={styles.masonryGrid}>
            {/* Actual found albums */}
            {mainResults.map((item) => (
              <AlbumCard
                key={item.id}
                item={item}
                onSelect={(a) => {
                  const existing = userVinyls.find(v => v.ALBUM_ID === a.id);
                  setSelectedAlbum({
                    ALBUM_ID: a.id,
                    TITLE: a.title,
                    ARTIST: a.artist,
                    IMAGE_URL: a.thumb,
                    RELEASE_YEAR: a.year,
                    GENRES: a.genre,
                    STATUS: existing ? existing.STATUS : undefined,
                    coverCandidates: a.coverCandidates,
                    DISCOGS_RELEASE_ID: a.releaseId
                  });
                }}
              />
            ))}

            {/* Skeleton placeholders while validating */}
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <SkeletonCard key={`sk-${i}`} />
            ))}

            {/* Genre cards when idle */}
            {status === 'idle' && genres.map((genre, idx) => (
              <div 
                key={idx} 
                className={styles.masonryItem}
                onClick={() => handleGenreClick(genre.title, genre.sub)}
                style={{ cursor: 'pointer' }}
              >
                <img
                  src={genre.img}
                  alt={genre.title}
                  className={styles.genreImage}
                  style={{ height: genre.height }}
                  loading="lazy"
                />
                <div className={styles.genreContent}>
                  <h3 className={styles.genreTitle}>{locale === 'ko' ? genre.title : genre.sub}</h3>
                  {locale === 'ko' && <p className={styles.genreSub}>{genre.sub}</p>}
                </div>
              </div>
            ))}

            {/* Full-screen spinner removed in favor of Skeletons */}
            {status === 'fetching_discogs' && results.length === 0 && (
              <div style={{ width: '100%', height: '20vh' }}></div>
            )}
          </div>
        </section>

        {/* Featured / Compilation Section */}
        {featuredResults.length > 0 && (
          <section style={{ marginTop: '4rem' }}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{t('search.featuredSection', { count: featuredResults.length })}</h2>
            </div>
            <div className={styles.masonryGrid}>
              {featuredResults.map((item) => (
                <AlbumCard
                  key={item.id}
                  item={item}
                  onSelect={(a) => {
                    const existing = userVinyls.find(v => v.ALBUM_ID === a.id);
                    setSelectedAlbum({
                      ALBUM_ID: a.id,
                      TITLE: a.title,
                      ARTIST: a.artist,
                      IMAGE_URL: a.thumb,
                      RELEASE_YEAR: a.year,
                      GENRES: a.genre,
                      STATUS: existing ? existing.STATUS : undefined,
                      coverCandidates: a.coverCandidates
                    });
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Loading indicator during infinite scroll fetching */}
        {query.trim() !== '' && status !== 'idle' && hasMore && (
          <div ref={observerTarget} style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2rem' }}>
            {status !== 'done' && status !== 'error' && <div className={styles.spinner} style={{ width: 30, height: 30, borderWidth: 3 }} />}
          </div>
        )}
      </main>

      {selectedAlbum && (
        <DetailModal
          album={selectedAlbum as MockVinylData}
          onClose={() => setSelectedAlbum(null)}
          coverCandidates={selectedAlbum.coverCandidates}
        />
      )}

      {toastMessage && (
        <div className={styles.toast}>
          <span className="material-symbols-outlined">check_circle</span>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
