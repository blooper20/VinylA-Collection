'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useAuthStore,
  getCommunityAlbumById,
  communityAlbumHasOtherAdopters,
  updateCommunityAlbum,
  uploadUserCover,
  getErrorMessage,
} from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { CommunityAlbumFormFields, FormSide } from '../../../../components/CommunityAlbum/CommunityAlbumFormFields';
import styles from '../../new/page.module.css';

// AlbumTrack[]의 side별 flat 배열을 폼이 쓰는 "사이드 묶음" 구조로 되돌린다 —
// DetailModal.tsx의 CUSTOM_PRESSING 편집 진입 로직과 동일한 패턴.
const tracksToSides = (tracks: { side?: string; title: string }[]): FormSide[] => {
  const groups: FormSide[] = [];
  for (const track of tracks) {
    const heading = track.side || 'A Side';
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) last.tracks.push(track.title);
    else groups.push({ heading, tracks: [track.title] });
  }
  return groups.length > 0 ? groups : [{ heading: 'A Side', tracks: [''] }];
};

export default function EditCommunityAlbumPage() {
  const params = useParams();
  const albumId = Number(params?.albumId);
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useLocale();

  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'forbidden' | 'locked'>('loading');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [sides, setSides] = useState<FormSide[]>([{ heading: 'A Side', tracks: [''] }]);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!albumId || user === undefined) return;
    if (!user) { setStatus('forbidden'); return; }
    getCommunityAlbumById(albumId).then(async (album) => {
      if (!album) { setStatus('not-found'); return; }
      if (album.SUBMITTED_BY !== user.id) { setStatus('forbidden'); return; }
      if (await communityAlbumHasOtherAdopters(albumId)) { setStatus('locked'); return; }
      setTitle(album.TITLE);
      setArtist(album.ARTIST);
      setReleaseYear(album.RELEASE_YEAR ? String(album.RELEASE_YEAR) : '');
      setImageUrl(album.IMAGE_URL);
      setSides(tracksToSides(album.TRACKS));
      setStatus('ready');
    }).catch(() => setStatus('not-found'));
  }, [albumId, user]);

  const handleUploadCover = async (square: Blob): Promise<string | null> => {
    if (isUploadingCover) return null;
    setIsUploadingCover(true);
    try {
      return await uploadUserCover(albumId, square);
    } catch (e) {
      showToast(getErrorMessage(e, t));
      return null;
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    const tracks = sides.flatMap((s) =>
      s.tracks.filter((tr) => tr.trim()).map((tr) => ({ side: s.heading.trim(), title: tr.trim() }))
    );
    setIsSubmitting(true);
    try {
      await updateCommunityAlbum(albumId, {
        title,
        artist,
        releaseYear: releaseYear.trim() ? Number(releaseYear) : null,
        imageUrl,
        tracks,
      });
      showToast(t('community.updateSuccess'));
      router.push('/community-albums');
    } catch (e) {
      showToast(getErrorMessage(e, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading') {
    return <div className={styles.container}><p className={styles.pageHint}>{t('community.loading')}</p></div>;
  }
  if (status === 'not-found') {
    return <div className={styles.container}><p className={styles.pageHint}>{t('community.loadFailed')}</p></div>;
  }
  if (status === 'forbidden') {
    return <div className={styles.container}><p className={styles.pageHint}>{t('community.editableOnlyBySubmitter')}</p></div>;
  }
  if (status === 'locked') {
    return <div className={styles.container}><p className={styles.pageHint}>{t('community.lockedByAdopters')}</p></div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>{t('community.editButton')}</h1>
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
        submitLabel={t('community.updateButton')}
        submittingLabel={t('community.submitting')}
        onSubmit={handleSubmit}
      />
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
