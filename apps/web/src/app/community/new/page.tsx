'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  useAuthStore,
  createCommunityPost,
  uploadCommunityPostMedia,
  getAlbumMaster,
  getErrorMessage,
} from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { CommunityPostCategory } from '@vinyla/shared-types';
import { CommunityMediaPicker, CommunityMediaSlot } from '../../../components/Community/CommunityMediaPicker';
import { AlbumMultiSelectPicker, PickedAlbum } from '../../../components/Community/AlbumMultiSelectPicker';
import { ComingSoonNotice } from '../../../components/Community/ComingSoonNotice';
import styles from './page.module.css';

// LOCATION은 실제 DB 카테고리가 아니다 — 지도 SDK 도입 전까지는 선택해도
// "준비 중" 안내만 뜨고 글쓰기 폼 자체가 나타나지 않는다.
type CategoryChoice = CommunityPostCategory | 'LOCATION';
const CATEGORIES: CategoryChoice[] = ['FREE', 'ARRIVAL', 'LISTENING_ROOM', 'INFO', 'TIP', 'QNA', 'LOCATION'];

const isCategoryChoice = (v: string | null): v is CategoryChoice =>
  !!v && (CATEGORIES as string[]).includes(v);

// 카테고리에 따라 입력폼이 달라지는 커뮤니티 글쓰기 화면. 제목+사진+내용은
// 전 카테고리 공통이고, 오늘 온 전리품(앨범 다중 첨부)만 전용 필드가 추가된다.
// (위치 공유는 정보게시판 개념 변경 — 예약판매/신반 발매정보/팝업스토어 소식 —
// 으로 더 이상 쓰이지 않는다. 장소 기반 정보는 추후 로케이션 게시판으로 옮겨간다.)
// useSearchParams()(보관함 저장 직후 "?category=ARRIVAL&albumId=" 유도 링크용)가
// 정적 생성 페이지를 전부 강제 동적 렌더링으로 만들지 않도록, 그 훅을 쓰는
// 부분만 Suspense로 감싼다.
export default function CommunityNewPostPage() {
  return (
    <Suspense fallback={null}>
      <CommunityNewPostPageInner />
    </Suspense>
  );
}

function CommunityNewPostPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { t } = useLocale();

  const categoryParam = searchParams.get('category');
  const albumIdParam = searchParams.get('albumId');

  const [category, setCategory] = React.useState<CategoryChoice>(
    isCategoryChoice(categoryParam) ? categoryParam : 'FREE'
  );
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [media, setMedia] = React.useState<CommunityMediaSlot[]>([]);
  const [albums, setAlbums] = React.useState<PickedAlbum[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 보관함에 방금 추가한 앨범을 "오온음(ARRIVAL)" 글에 자동 첨부 — 방문자가
  // 앨범 다중선택 피커를 다시 열어 고르지 않아도 되게 미리 채워둔다.
  React.useEffect(() => {
    if (!albumIdParam) return;
    const albumId = Number(albumIdParam);
    if (!Number.isFinite(albumId)) return;
    getAlbumMaster(albumId).then((master) => {
      if (!master) return;
      setAlbums((prev) => prev.some((a) => a.ALBUM_ID === albumId)
        ? prev
        : [...prev, { ALBUM_ID: albumId, TITLE: master.TITLE, ARTIST: master.ARTIST, IMAGE_URL: master.IMAGE_URL || null }]);
    });
  }, [albumIdParam]);

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
        media.map(async (m) => (m.kind === 'existing' ? { url: m.url, type: m.type } : await uploadCommunityPostMedia(m.file)))
      );
      const postId = await createCommunityPost({
        category,
        title,
        content,
        mediaItems,
        albumIds: category === 'ARRIVAL' ? albums.map((a) => a.ALBUM_ID) : undefined,
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
          placeholder={t(`communityBoard.titlePlaceholders.${category}` as any)}
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

        <label className={styles.label}>{t('communityBoard.contentLabel')}</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t(`communityBoard.contentPlaceholders.${category}` as any)}
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
