'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  useAuthStore,
  getCommunityPost,
  updateCommunityPost,
  uploadCommunityPostMedia,
  getErrorMessage,
  CommunityPostWithMeta,
} from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { CommunityMediaPicker, CommunityMediaSlot } from '../../../../components/Community/CommunityMediaPicker';
import { AlbumMultiSelectPicker, PickedAlbum } from '../../../../components/Community/AlbumMultiSelectPicker';
// 글쓰기 폼과 시각적으로 동일한 화면이라 CSS 모듈을 그대로 재사용한다 —
// 카테고리 탭만 없을 뿐 title/label/input/textarea/submitBtn 클래스는 동일.
import styles from '../../new/page.module.css';

// 자랑 하위 카테고리 중 앨범 다중 첨부가 있는 3개만 소스를 다르게 제한한다
// (오온음=보유+위시, 컬렉션=보유만, 위시리스트=위시만) — community/new/page.tsx의
// ALBUM_PICKER_SOURCE와 동일한 매핑.
const ALBUM_PICKER_SOURCE: Partial<Record<string, 'owned' | 'wish' | 'both'>> = {
  ARRIVAL: 'both',
  COLLECTION: 'owned',
  WISHLIST: 'wish',
};

// 카테고리는 수정 화면에서 바꿀 수 없다 — 글쓰기 폼의 탭 선택은 최초 작성
// 시점에만 의미가 있고, 이후 카테고리를 바꾸면 그 카테고리 전용 필드(앨범
// 첨부 등)의 정합성이 깨지기 쉽다.
export default function CommunityEditPostPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useLocale();
  const postId = Number(params.postId);

  const [post, setPost] = React.useState<CommunityPostWithMeta | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [media, setMedia] = React.useState<CommunityMediaSlot[]>([]);
  const [albums, setAlbums] = React.useState<PickedAlbum[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!Number.isFinite(postId)) return;
    getCommunityPost(postId).then((p) => {
      setPost(p);
      if (p) {
        setTitle(p.TITLE);
        setContent(p.CONTENT);
        setMedia(p.MEDIA_ITEMS.map((m) => ({ kind: 'existing', url: m.url, type: m.type })));
        setAlbums(p.albums.map((a) => ({ ALBUM_ID: a.ALBUM_ID, TITLE: a.TITLE, ARTIST: a.ARTIST, IMAGE_URL: a.IMAGE_URL })));
      }
    }).finally(() => setIsLoading(false));
  }, [postId]);

  const isAuthor = !!post && user?.id === post.AUTHOR_ID;
  const albumSource = post ? ALBUM_PICKER_SOURCE[post.CATEGORY] : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;
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
      await updateCommunityPost(postId, {
        title,
        content,
        mediaItems,
        albumIds: albumSource ? albums.map((a) => a.ALBUM_ID) : undefined,
      });
      router.push(`/community/${postId}`);
    } catch (err) {
      setError(getErrorMessage(err, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className={styles.container}><p>{t('communityBoard.loading')}</p></div>;
  if (!post) return <div className={styles.container}><p>{t('communityBoard.empty')}</p></div>;
  if (!isAuthor) return <div className={styles.container}><p>{t('communityBoard.editableOnlyBySubmitter')}</p></div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('communityBoard.editButton')}</h1>
      <p className={styles.categoryHint}>{t(`communityBoard.categories.${post.CATEGORY}` as any)}</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <label className={styles.label}>{t('communityBoard.titleLabel')}</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={styles.input}
          maxLength={100}
        />

        <label className={styles.label}>{t('communityBoard.photoLabel')}</label>
        <CommunityMediaPicker value={media} onChange={setMedia} disabled={isSubmitting} />

        {albumSource && (
          <>
            <label className={styles.label}>{t('communityBoard.albumPickerLabel')}</label>
            <AlbumMultiSelectPicker value={albums} onChange={setAlbums} source={albumSource} />
          </>
        )}

        <label className={styles.label}>{t('communityBoard.contentLabel')}</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={styles.textarea}
          maxLength={5000}
        />

        {error && <p className={styles.error}>{error}</p>}

        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href={`/community/${postId}`} className={styles.submitBtn} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', textAlign: 'center', textDecoration: 'none', flex: 1 }}>
            {t('common.cancel')}
          </Link>
          <button type="submit" className={styles.submitBtn} disabled={isSubmitting} style={{ flex: 1 }}>
            {isSubmitting ? t('communityBoard.submitting') : t('communityBoard.updateButton')}
          </button>
        </div>
      </form>
    </div>
  );
}
