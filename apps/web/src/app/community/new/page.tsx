'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  useAuthStore,
  createCommunityPost,
  uploadCommunityPostMedia,
  getErrorMessage,
} from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { CommunityPostCategory } from '@vinyla/shared-types';
import { CommunityMediaPicker, CommunityMediaSlot } from '../../../components/Community/CommunityMediaPicker';
import { AlbumMultiSelectPicker, PickedAlbum } from '../../../components/Community/AlbumMultiSelectPicker';
import { LocationPicker, PickedLocation } from '../../../components/Community/LocationPicker';
import { ComingSoonNotice } from '../../../components/Community/ComingSoonNotice';
import styles from './page.module.css';

// LOCATION은 실제 DB 카테고리가 아니다 — 지도 SDK 도입 전까지는 선택해도
// "준비 중" 안내만 뜨고 글쓰기 폼 자체가 나타나지 않는다.
type CategoryChoice = CommunityPostCategory | 'LOCATION';
const CATEGORIES: CategoryChoice[] = ['FREE', 'ARRIVAL', 'LISTENING_ROOM', 'INFO', 'TIP', 'QNA', 'LOCATION'];

// 카테고리에 따라 입력폼이 달라지는 커뮤니티 글쓰기 화면. 제목+사진+내용은
// 전 카테고리 공통이고, 오늘 온 전리품(앨범 다중 첨부)·정보게시판(위치 공유)만
// 전용 필드가 추가된다.
export default function CommunityNewPostPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useLocale();

  const [category, setCategory] = React.useState<CategoryChoice>('FREE');
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [media, setMedia] = React.useState<CommunityMediaSlot[]>([]);
  const [albums, setAlbums] = React.useState<PickedAlbum[]>([]);
  const [location, setLocation] = React.useState<PickedLocation | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (category === 'LOCATION') return; // 준비 중 카테고리 — 폼 자체가 안 보이므로 방어적 가드
    if (!user?.id) {
      setError(t('communityBoard.loginRequired'));
      return;
    }
    if (!title.trim()) {
      setError(t('communityBoard.submitFailedTitleRequired'));
      return;
    }
    if (!content.trim()) {
      setError(t('communityBoard.submitFailedContentRequired'));
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const mediaItems = await Promise.all(
        media.map(async (m) => (m.kind === 'existing' ? { url: m.url, type: 'image' as const } : await uploadCommunityPostMedia(m.file)))
      );
      const postId = await createCommunityPost({
        category,
        title,
        content,
        mediaItems,
        albumIds: category === 'ARRIVAL' ? albums.map((a) => a.ALBUM_ID) : undefined,
        placeName: category === 'INFO' ? location?.placeName : undefined,
        placeAddress: category === 'INFO' ? location?.placeAddress : undefined,
        latitude: category === 'INFO' ? location?.latitude : undefined,
        longitude: category === 'INFO' ? location?.longitude : undefined,
      });
      router.push(`/community/${postId}`);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('communityBoard.writeCta')}</h1>

      <div className={styles.categoryTabs}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.categoryTab} ${category === c ? styles.categoryTabActive : ''}`}
            onClick={() => setCategory(c)}
          >
            {t(`communityBoard.categories.${c}` as any)}
          </button>
        ))}
      </div>
      <p className={styles.categoryHint}>{t(`communityBoard.categoryHint.${category}` as any)}</p>

      {category === 'LOCATION' ? (
        <ComingSoonNotice />
      ) : (
      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label}>{t('communityBoard.titleLabel')}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('communityBoard.titlePlaceholder')}
          className={styles.input}
          maxLength={100}
        />

        <label className={styles.label}>{t('communityBoard.photoLabel')}</label>
        <CommunityMediaPicker value={media} onChange={setMedia} disabled={isSubmitting} />

        {category === 'ARRIVAL' && (
          <>
            <label className={styles.label}>{t('communityBoard.albumPickerLabel')}</label>
            <AlbumMultiSelectPicker value={albums} onChange={setAlbums} />
          </>
        )}

        {category === 'INFO' && (
          <>
            <label className={styles.label}>{t('communityBoard.locationLabel')}</label>
            <LocationPicker value={location} onChange={setLocation} />
          </>
        )}

        <label className={styles.label}>{t('communityBoard.contentLabel')}</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('communityBoard.contentPlaceholder')}
          className={styles.textarea}
          maxLength={5000}
        />

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
          {isSubmitting ? t('communityBoard.submitting') : t('communityBoard.submitButton')}
        </button>
      </form>
      )}
    </div>
  );
}
