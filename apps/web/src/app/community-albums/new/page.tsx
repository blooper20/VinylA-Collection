'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  useAuthStore,
  searchAppleMusicAlbums,
  fetchAppleMusicAlbumTracks,
  reserveCommunityAlbumId,
  createCommunityAlbum,
  uploadUserCover,
  upsertUserVinyl,
  getErrorMessage,
  AppleMusicSearchResult,
} from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { CommunityAlbumFormFields, FormSide } from '../../../components/CommunityAlbum/CommunityAlbumFormFields';
import styles from './page.module.css';

type Source = 'APPLE_MUSIC' | 'MANUAL';

// Discogs 카탈로그에 없는 앨범을 유저가 직접 등록한다 — 애플뮤직 검색으로
// 커버·트랙리스트를 자동으로 가져오거나(선택 후에도 트랙 편집은 계속 가능),
// 거기에도 없으면 전부 수동 입력. 등록 즉시 본인 컬렉션에도 추가된다.
export default function RegisterCommunityAlbumPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useLocale();

  const [appleQuery, setAppleQuery] = useState('');
  const [appleResults, setAppleResults] = useState<AppleMusicSearchResult[]>([]);
  const [isSearchingApple, setIsSearchingApple] = useState(false);
  const [hasSearchedApple, setHasSearchedApple] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [source, setSource] = useState<Source>('MANUAL');
  const [appleCollectionId, setAppleCollectionId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [sides, setSides] = useState<FormSide[]>([{ heading: 'A Side', tracks: [''] }]);

  const [reservedAlbumId, setReservedAlbumId] = useState<number | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  const handleAppleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appleQuery.trim() || isSearchingApple) return;
    setIsSearchingApple(true);
    setHasSearchedApple(true);
    try {
      const results = await searchAppleMusicAlbums(appleQuery.trim());
      setAppleResults(results);
    } finally {
      setIsSearchingApple(false);
    }
  };

  const pickAppleResult = async (r: AppleMusicSearchResult) => {
    setIsSearchingApple(true);
    try {
      const page = await fetchAppleMusicAlbumTracks(r.collectionId);
      setSource('APPLE_MUSIC');
      setAppleCollectionId(r.collectionId);
      setTitle(page?.name || r.collectionName);
      setArtist(r.artistName);
      setReleaseYear(r.releaseYear ? String(r.releaseYear) : '');
      setImageUrl(r.artworkUrl || null);
      setSides([{ heading: 'A Side', tracks: page?.tracks?.length ? page.tracks : [''] }]);
      setShowForm(true);
    } finally {
      setIsSearchingApple(false);
    }
  };

  const startManualEntry = () => {
    setSource('MANUAL');
    setAppleCollectionId(null);
    setTitle('');
    setArtist('');
    setReleaseYear('');
    setImageUrl(null);
    setSides([{ heading: 'A Side', tracks: [''] }]);
    setShowForm(true);
  };

  const handleUploadCover = async (square: Blob): Promise<string | null> => {
    if (!user?.id || isUploadingCover) return null;
    setIsUploadingCover(true);
    try {
      const albumId = reservedAlbumId ?? (await reserveCommunityAlbumId());
      setReservedAlbumId(albumId);
      return await uploadUserCover(albumId, square);
    } catch (e) {
      showToast(getErrorMessage(e, t));
      return null;
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      showToast(t('detail.loginRequired'));
      return;
    }
    if (isSubmitting) return;
    const tracks = sides.flatMap((s) =>
      s.tracks.filter((tr) => tr.trim()).map((tr) => ({ side: s.heading.trim(), title: tr.trim() }))
    );
    setIsSubmitting(true);
    try {
      const { albumId } = await createCommunityAlbum(user.id, {
        albumId: reservedAlbumId ?? undefined,
        title,
        artist,
        releaseYear: releaseYear.trim() ? Number(releaseYear) : null,
        imageUrl,
        tracks,
        source,
        appleCollectionId,
      });
      await upsertUserVinyl({ USER_ID: user.id, ALBUM_ID: albumId, STATUS: 'OWNED' });
      showToast(t('community.submitSuccess'));
      router.push('/community-albums');
    } catch (e) {
      showToast(getErrorMessage(e, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>{t('community.pageTitle')}</h1>
      <p className={styles.pageHint}>{t('community.pageHint')}</p>

      {!showForm && (
        <section className={styles.appleSearchSection}>
          <h2 className={styles.stepTitle}>{t('community.appleSearchStepTitle')}</h2>
          <form className={styles.appleSearchBar} onSubmit={handleAppleSearch}>
            <input
              type="text"
              value={appleQuery}
              onChange={(e) => setAppleQuery(e.target.value)}
              placeholder={t('community.appleSearchPlaceholder')}
              className={styles.appleSearchInput}
            />
            <button type="submit" className={styles.appleSearchBtn} disabled={isSearchingApple}>
              {isSearchingApple ? t('community.appleSearchSearching') : t('community.appleSearchButton')}
            </button>
          </form>

          {appleResults.length > 0 && (
            <div className={styles.appleResultsGrid}>
              {appleResults.map((r) => (
                <button
                  key={r.collectionId}
                  type="button"
                  className={styles.appleResultCard}
                  onClick={() => pickAppleResult(r)}
                >
                  {r.artworkUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={r.artworkUrl} alt="" className={styles.appleResultCover} />
                  )}
                  <div className={styles.appleResultTitle}>{r.collectionName}</div>
                  <div className={styles.appleResultArtist}>{r.artistName}</div>
                </button>
              ))}
            </div>
          )}
          {hasSearchedApple && !isSearchingApple && appleResults.length === 0 && (
            <p className={styles.appleNoResults}>{t('community.appleSearchNoResults')}</p>
          )}

          <button type="button" className={styles.manualEntryCta} onClick={startManualEntry}>
            {t('community.manualEntryCta')}
          </button>
        </section>
      )}

      {showForm && (
        <>
          <h2 className={styles.stepTitle}>{t('community.manualStepTitle')}</h2>
          <CommunityAlbumFormFields
            imageUrl={imageUrl}
            onImageUrlChange={setImageUrl}
            title={title}
            onTitleChange={setTitle}
            artist={artist}
            onArtistChange={setArtist}
            releaseYear={releaseYear}
            onReleaseYearChange={setReleaseYear}
            sides={sides}
            onSidesChange={setSides}
            isUploadingCover={isUploadingCover}
            onUploadCover={handleUploadCover}
            isSubmitting={isSubmitting}
            submitLabel={t('community.submitButton')}
            submittingLabel={t('community.submitting')}
            confirmBeforeSubmit
            onSubmit={handleSubmit}
          />
        </>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
