'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCommunityAlbums, CommunityAlbum, useAuthStore, getUserVinyls } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { MockVinylData, USER_VINYL } from '@vinyla/shared-types';
import { DetailModal } from '../../components/Modal/DetailModal';
import styles from './page.module.css';

// Discogs 카탈로그에 없어 유저가 직접 등록한 앨범들을 모아 보여주는 위키형
// 목록 — 메인 Discogs 검색과는 완전히 분리된 화면이다(메인 검색 매칭 로직은
// 건드리지 않는다는 결정에 따름).
export default function CommunityAlbumsPage() {
  const { t } = useLocale();
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [albums, setAlbums] = useState<CommunityAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<CommunityAlbum | null>(null);
  const [userVinyls, setUserVinyls] = useState<USER_VINYL[]>([]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsLoading(true);
      getCommunityAlbums({ query })
        .then(setAlbums)
        .finally(() => setIsLoading(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const loadUserVinyls = () => {
      if (!user?.id) { setUserVinyls([]); return; }
      getUserVinyls(user.id).then(setUserVinyls).catch(() => {});
    };
    loadUserVinyls();
    window.addEventListener('REFRESH_VINYLS', loadUserVinyls);
    return () => window.removeEventListener('REFRESH_VINYLS', loadUserVinyls);
  }, [user?.id]);

  const toDetailAlbum = (a: CommunityAlbum): MockVinylData => {
    const numericId = Number(a.ALBUM_ID);
    const existing = userVinyls.find((v) => Number(v.ALBUM_ID) === numericId);
    return {
      ALBUM_ID: a.ALBUM_ID,
      TITLE: a.TITLE,
      ARTIST: a.ARTIST,
      // DetailModal은 next/image에 이 값을 그대로 src로 넘긴다 — 빈 문자열이면
      // Next.js가 콘솔 에러를 던지므로, 커버가 없을 때 앱 전역에서 쓰는 것과
      // 동일한 플레이스홀더로 대체한다(packages/core-api/src/supabaseDb.ts의
      // mapToFrontendModel과 동일한 URL).
      IMAGE_URL: a.IMAGE_URL || 'https://images.unsplash.com/photo-1518655048521-f130df041f66?q=80&w=400',
      RELEASE_YEAR: a.RELEASE_YEAR || undefined,
      SOURCE: a.SOURCE,
      SUBMITTED_BY: a.SUBMITTED_BY,
      COMMUNITY_TRACKS: a.TRACKS,
      STATUS: existing?.STATUS,
    } as MockVinylData;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('community.tabTitle')}</h1>
          <p className={styles.subtitle}>{t('community.subtitle')}</p>
        </div>
        <Link href="/community-albums/new" className={styles.registerBtn}>
          {t('community.registerNewCta')}
        </Link>
      </header>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('community.searchPlaceholder')}
        className={styles.searchInput}
      />

      {isLoading && <p className={styles.status}>{t('community.loading')}</p>}
      {!isLoading && albums.length === 0 && <p className={styles.status}>{t('community.empty')}</p>}

      <div className={styles.grid}>
        {albums.map((a) => (
          <button key={a.ALBUM_ID} type="button" className={styles.card} onClick={() => setSelected(a)}>
            {a.IMAGE_URL ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={a.IMAGE_URL} alt="" className={styles.cover} />
            ) : (
              <div className={styles.coverPlaceholder} />
            )}
            <div className={styles.cardTitle}>{a.TITLE}</div>
            <div className={styles.cardArtist}>{a.ARTIST}</div>
            {a.submitterName && (
              <div className={styles.cardSubmitter}>{t('community.submittedBy', { name: a.submitterName })}</div>
            )}
          </button>
        ))}
      </div>

      {selected && <DetailModal album={toDetailAlbum(selected)} onClose={() => setSelected(null)} />}
    </div>
  );
}
