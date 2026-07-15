'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from '../notices.module.css';
import {
  getNotice,
  getNoticeComments,
  addNoticeComment,
  deleteNoticeComment,
  likeNoticeComment,
  unlikeNoticeComment,
  useAuthStore,
  NoticeComment,
} from '@vinyla/core-api';
import { NOTICE } from '@vinyla/shared-types';
import { useLocale } from '@vinyla/i18n';

export default function NoticeDetailPage() {
  const { t } = useLocale();
  const { user, initializeAuth } = useAuthStore();
  const params = useParams();
  const id = Number(params?.id);
  const [notice, setNotice] = useState<NOTICE | null | undefined>(undefined);
  const [comments, setComments] = useState<NoticeComment[] | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // 브라우저 기본 confirm() 대신 /log 페이지와 동일한 인라인 확인 행 패턴
  const [deletingCommentId, setDeletingCommentId] = useState<number | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const isAdmin = user?.app_metadata?.role === 'admin';

  useEffect(() => { initializeAuth(); }, [initializeAuth]);

  useEffect(() => {
    if (!id) return;
    getNotice(id).then(setNotice).catch(() => setNotice(null));
  }, [id]);

  const loadComments = useCallback(() => {
    if (!id) return;
    getNoticeComments(id).then(setComments).catch(() => setComments([]));
  }, [id]);

  useEffect(loadComments, [loadComments]);

  const handleSubmitComment = async () => {
    if (!id || !commentInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addNoticeComment(id, commentInput);
      setCommentInput('');
      loadComments();
    } catch (e: any) {
      alert(e?.message || '댓글 작성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDeleteComment = async (commentId: number) => {
    if (deleteSubmitting) return;
    setDeleteSubmitting(true);
    try {
      await deleteNoticeComment(commentId);
      setComments((prev) => (prev || []).filter((c) => c.COMMENT_ID !== commentId));
      setDeletingCommentId(null);
    } catch (e: any) {
      alert(e?.message || '댓글 삭제에 실패했습니다.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleToggleLike = async (c: NoticeComment) => {
    if (!user) return alert(t('spinSocial.loginRequired'));
    setComments((prev) =>
      (prev || []).map((x) =>
        x.COMMENT_ID === c.COMMENT_ID
          ? { ...x, LIKED_BY_ME: !x.LIKED_BY_ME, LIKE_COUNT: Math.max(0, x.LIKE_COUNT + (x.LIKED_BY_ME ? -1 : 1)) }
          : x
      )
    );
    try {
      if (c.LIKED_BY_ME) await unlikeNoticeComment(c.COMMENT_ID);
      else await likeNoticeComment(c.COMMENT_ID);
    } catch {
      loadComments();
    }
  };

  return (
    <div className={styles.container}>
      <Link href="/notices" className={styles.backLink}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
        {t('notice.backToList')}
      </Link>

      {notice === undefined ? (
        <p className={styles.loadingText}>{t('notice.loading')}</p>
      ) : notice === null ? (
        <p className={styles.loadingText}>{t('notice.notFound')}</p>
      ) : (
        <>
          <header className={styles.detailHeader}>
            <h1 className={styles.detailTitle}>
              {notice.IS_PINNED && <span className={styles.pinBadge}>{t('notice.pinned')}</span>}
              {notice.TITLE}
            </h1>
            <span className={styles.detailDate}>{new Date(notice.CREATED_AT).toLocaleString()}</span>
          </header>

          <p className={styles.detailContent}>{notice.CONTENT}</p>

          {notice.MEDIA_ITEMS?.length > 0 && (
            <div className={styles.mediaGrid}>
              {notice.MEDIA_ITEMS.map((m, idx) =>
                m.type === 'video' ? (
                  <video key={idx} className={styles.mediaVideo} src={m.url} controls playsInline />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img key={idx} className={styles.mediaImage} src={m.url} alt="" />
                )
              )}
            </div>
          )}

          <section className={styles.commentsSection}>
            <p className={styles.commentsTitle}>{t('notice.commentsTitle')}</p>

            {comments === null ? (
              <p className={styles.loadingText}>{t('notice.loading')}</p>
            ) : comments.length === 0 ? (
              <p className={styles.commentsEmpty}>{t('notice.commentEmpty')}</p>
            ) : (
              <div className={styles.commentList}>
                {comments.map((c) => {
                  const canDelete = !!user && (user.id === c.USER_ID || isAdmin);
                  return (
                    <div key={c.COMMENT_ID} className={styles.commentItem}>
                      <div className={styles.commentHead}>
                        <span className={styles.commentAuthor}>{c.DISPLAY_NAME || t('feed.anonymous')}</span>
                        <span className={styles.commentDate}>{new Date(c.CREATED_AT).toLocaleDateString()}</span>
                      </div>
                      <p className={styles.commentContent}>{c.CONTENT}</p>
                      {deletingCommentId === c.COMMENT_ID ? (
                        <div className={styles.commentDeleteConfirmRow}>
                          <span>{t('log.deleteConfirm')}</span>
                          <button
                            type="button"
                            className={styles.commentDeleteConfirmYes}
                            onClick={() => handleConfirmDeleteComment(c.COMMENT_ID)}
                            disabled={deleteSubmitting}
                          >
                            {deleteSubmitting ? t('log.editSaving') : t('log.deleteConfirmYes')}
                          </button>
                          <button
                            type="button"
                            className={styles.commentDeleteConfirmNo}
                            onClick={() => setDeletingCommentId(null)}
                            disabled={deleteSubmitting}
                          >
                            {t('log.deleteConfirmNo')}
                          </button>
                        </div>
                      ) : (
                        <div className={styles.commentActions}>
                          <button type="button" className={styles.commentLikeBtn} onClick={() => handleToggleLike(c)}>
                            <span className="material-symbols-outlined" style={{ fontSize: '15px', fontVariationSettings: c.LIKED_BY_ME ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
                            {c.LIKE_COUNT}
                          </button>
                          {canDelete && (
                            <button type="button" className={styles.commentDeleteBtn} onClick={() => setDeletingCommentId(c.COMMENT_ID)}>
                              {t('spinSocial.delete')}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {notice.IS_COMMENTS_ENABLED ? (
              <div className={styles.commentInputRow}>
                <input
                  className={styles.commentInput}
                  value={commentInput}
                  maxLength={500}
                  placeholder={user ? t('spinSocial.commentPlaceholder') : t('spinSocial.loginRequired')}
                  disabled={!user || submitting}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmitComment(); }}
                />
                <button
                  type="button"
                  className={styles.commentSubmitBtn}
                  onClick={handleSubmitComment}
                  disabled={!user || submitting || !commentInput.trim()}
                >
                  {t('spinSocial.submit')}
                </button>
              </div>
            ) : (
              <p className={styles.commentsDisabled}>{t('notice.commentsDisabled')}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
