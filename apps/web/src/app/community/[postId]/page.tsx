'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  useAuthStore,
  getCommunityPost,
  incrementCommunityPostViewCount,
  deleteCommunityPost,
  reportCommunityPost,
  getErrorMessage,
  CommunityPostWithMeta,
} from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { CommunityCommentThread } from '../../../components/Community/CommunityCommentThread';
import styles from './page.module.css';

export default function CommunityPostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useLocale();
  const postId = Number(params.postId);

  const [post, setPost] = React.useState<CommunityPostWithMeta | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [toast, setToast] = React.useState<string | null>(null);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [reportReason, setReportReason] = React.useState('');

  React.useEffect(() => {
    if (!Number.isFinite(postId)) return;
    getCommunityPost(postId).then(setPost).finally(() => setIsLoading(false));
    incrementCommunityPostViewCount(postId);
  }, [postId]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async () => {
    if (!window.confirm(t('communityBoard.deleteConfirm'))) return;
    try {
      await deleteCommunityPost(postId);
      router.push('/community');
    } catch (err) {
      showToast(getErrorMessage(err, t));
    }
  };

  const submitReport = async () => {
    try {
      await reportCommunityPost(postId, reportReason);
      showToast(t('communityBoard.reportSuccess'));
    } catch (err) {
      showToast(getErrorMessage(err, t));
    } finally {
      setReportOpen(false);
      setReportReason('');
    }
  };

  if (isLoading) return <div className={styles.container}><p className={styles.status}>{t('communityBoard.loading')}</p></div>;
  if (!post) return <div className={styles.container}><p className={styles.status}>{t('communityBoard.empty')}</p></div>;

  const isAuthor = user?.id === post.AUTHOR_ID;
  const isQna = post.CATEGORY === 'QNA';

  return (
    <div className={styles.container}>
      <Link href="/community" className={styles.backLink}>← {t('communityBoard.pageTitle')}</Link>

      <span className={styles.category}>{t(`communityBoard.categories.${post.CATEGORY}` as any)}</span>
      <h1 className={styles.title}>{post.TITLE}</h1>
      <div className={styles.meta}>
        {post.AUTHOR_NAME || t('communityBoard.authorFallback')} · {new Date(post.CREATED_AT).toLocaleDateString()}
        {' · '}{t('communityBoard.viewCount', { count: post.VIEW_COUNT })}
      </div>

      {post.CATEGORY === 'INFO' && post.PLACE_NAME && (
        <div className={styles.location}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>location_on</span>
          <span><strong>{post.PLACE_NAME}</strong>{post.PLACE_ADDRESS ? ` · ${post.PLACE_ADDRESS}` : ''}</span>
        </div>
      )}

      {post.MEDIA_ITEMS.length > 0 && (
        <div className={styles.mediaGrid}>
          {post.MEDIA_ITEMS.map((m, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img key={i} src={m.url} alt="" className={styles.mediaImg} />
          ))}
        </div>
      )}

      {post.CATEGORY === 'ARRIVAL' && post.albums.length > 0 && (
        <div className={styles.albumGrid}>
          {post.albums.map((a) => (
            <div key={a.ALBUM_ID} className={styles.albumCard}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.IMAGE_URL || ''} alt="" className={styles.albumCover} />
              <div className={styles.albumText}>
                <div className={styles.albumTitle}>{a.TITLE}</div>
                <div className={styles.albumArtist}>{a.ARTIST}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className={styles.content}>{post.CONTENT}</p>

      <div className={styles.actions}>
        {isAuthor && <button type="button" className={styles.actionBtn} onClick={handleDelete}>{t('communityBoard.deleteButton')}</button>}
        <button type="button" className={styles.actionBtn} onClick={() => setReportOpen(true)}>{t('communityBoard.reportCta')}</button>
      </div>

      <CommunityCommentThread
        postId={postId}
        isQna={isQna}
        isPostAuthor={isAuthor}
        acceptedCommentId={post.ACCEPTED_COMMENT_ID}
        onAcceptedChange={(commentId) => setPost((p) => (p ? { ...p, ACCEPTED_COMMENT_ID: commentId } : p))}
      />

      {toast && <div className={styles.toast}>{toast}</div>}

      {reportOpen && (
        <div className={styles.reportBackdrop} onClick={() => setReportOpen(false)}>
          <div className={styles.reportCard} onClick={(e) => e.stopPropagation()}>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder={t('communityBoard.reportReasonPlaceholder')}
              className={styles.reportTextarea}
              maxLength={300}
            />
            <button type="button" className={styles.reportSubmitBtn} onClick={submitReport}>{t('communityBoard.reportSubmit')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
