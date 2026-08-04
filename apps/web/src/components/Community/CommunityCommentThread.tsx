'use client';

import React from 'react';
import {
  useAuthStore,
  getCommunityComments,
  addCommunityComment,
  updateCommunityComment,
  deleteCommunityComment,
  likeCommunityComment,
  unlikeCommunityComment,
  reportCommunityComment,
  acceptCommunityAnswer,
  unacceptCommunityAnswer,
  getErrorMessage,
  CommunityComment,
} from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import styles from './CommunityCommentThread.module.css';

// 댓글(자유/정보/청음실/팁) 겸 답변(QnA) 스레드. SpinSocialModal의 재귀 렌더 +
// 1단계 대댓글 패턴을 재사용하되, isQna일 때만 "채택" 버튼과 채택 배지를
// 추가로 보여준다 — 데이터 모양은 동일(COMMUNITY_COMMENT), UI만 다르다.
export const CommunityCommentThread: React.FC<{
  postId: number;
  isQna: boolean;
  isPostAuthor: boolean;
  acceptedCommentId: number | null;
  onAcceptedChange: (commentId: number | null) => void;
}> = ({ postId, isQna, isPostAuthor, acceptedCommentId, onAcceptedChange }) => {
  const { t } = useLocale();
  const { user } = useAuthStore();
  const [comments, setComments] = React.useState<CommunityComment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [content, setContent] = React.useState('');
  const [replyTo, setReplyTo] = React.useState<{ id: number; name: string } | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const [reportTarget, setReportTarget] = React.useState<number | null>(null);
  const [reportReason, setReportReason] = React.useState('');
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editContent, setEditContent] = React.useState('');

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const load = React.useCallback(() => {
    setIsLoading(true);
    getCommunityComments(postId).then(setComments).finally(() => setIsLoading(false));
  }, [postId]);

  React.useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await addCommunityComment(postId, content, replyTo?.id);
      setContent('');
      setReplyTo(null);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, t));
    }
  };

  const handleDelete = async (commentId: number) => {
    try {
      await deleteCommunityComment(commentId);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, t));
    }
  };

  const handleToggleLike = async (c: CommunityComment) => {
    setComments((prev) => toggleLikeLocal(prev, c.COMMENT_ID));
    try {
      if (c.LIKED_BY_ME) await unlikeCommunityComment(c.COMMENT_ID);
      else await likeCommunityComment(c.COMMENT_ID);
    } catch {
      load();
    }
  };

  const handleAccept = async (commentId: number) => {
    if (!window.confirm(t('communityBoard.acceptConfirm'))) return;
    try {
      await acceptCommunityAnswer(postId, commentId);
      onAcceptedChange(commentId);
    } catch (err) {
      showToast(getErrorMessage(err, t));
    }
  };

  const handleUnaccept = async () => {
    try {
      await unacceptCommunityAnswer(postId);
      onAcceptedChange(null);
    } catch (err) {
      showToast(getErrorMessage(err, t));
    }
  };

  const submitReport = async () => {
    if (reportTarget == null) return;
    try {
      await reportCommunityComment(reportTarget, reportReason);
      showToast(t('communityBoard.reportSuccess'));
    } catch (err) {
      showToast(getErrorMessage(err, t));
    } finally {
      setReportTarget(null);
      setReportReason('');
    }
  };

  const canDelete = (c: CommunityComment) => user?.id === c.USER_ID;
  // 수정 권한은 삭제보다 좁다(RLS도 UPDATE는 작성자 본인만 허용 — 삭제는
  // 게시글 작성자·관리자도 가능) — 우연히 조건식이 같을 뿐 별도 이름으로 둔다.
  const canEdit = (c: CommunityComment) => user?.id === c.USER_ID;

  const startEdit = (c: CommunityComment) => {
    setEditingId(c.COMMENT_ID);
    setEditContent(c.CONTENT);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const saveEdit = async (commentId: number) => {
    if (!editContent.trim()) return;
    try {
      await updateCommunityComment(commentId, editContent);
      cancelEdit();
      load();
    } catch (err) {
      showToast(getErrorMessage(err, t));
    }
  };

  const renderComment = (c: CommunityComment, isReply: boolean) => {
    const isAccepted = isQna && !isReply && acceptedCommentId === c.COMMENT_ID;
    return (
      <div key={c.COMMENT_ID} className={`${styles.item} ${isReply ? styles.reply : ''} ${isAccepted ? styles.accepted : ''}`}>
        {isAccepted && <div className={styles.acceptedBadge}>{t('communityBoard.acceptedBadge')}</div>}
        <div className={styles.itemHeader}>
          {c.PROFILE_IMAGE_URL ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={c.PROFILE_IMAGE_URL} alt="" className={styles.avatar} />
          ) : (
            <div className={styles.avatarFallback} />
          )}
          <span className={styles.name}>{c.DISPLAY_NAME || t('communityBoard.authorFallback')}</span>
          <span className={styles.date}>{new Date(c.CREATED_AT).toLocaleDateString()}</span>
        </div>
        {editingId === c.COMMENT_ID ? (
          <div className={styles.editForm}>
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className={styles.editInput}
              maxLength={1000}
            />
            <button type="button" className={styles.actionBtn} onClick={() => saveEdit(c.COMMENT_ID)}>{t('communityBoard.updateButton')}</button>
            <button type="button" className={styles.actionBtn} onClick={cancelEdit}>{t('common.cancel')}</button>
          </div>
        ) : (
          <p className={styles.content}>{c.CONTENT}</p>
        )}
        <div className={styles.actions}>
          <button type="button" className={`${styles.actionBtn} ${c.LIKED_BY_ME ? styles.resonanceActive : ''}`} onClick={() => handleToggleLike(c)} title={t('communityBoard.resonanceCta')}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, fontVariationSettings: c.LIKED_BY_ME ? "'FILL' 1" : "'FILL' 0" }}>music_note</span>
            {c.LIKE_COUNT > 0 && c.LIKE_COUNT}
          </button>
          {!isReply && (
            <button type="button" className={styles.actionBtn} onClick={() => setReplyTo({ id: c.COMMENT_ID, name: c.DISPLAY_NAME || t('communityBoard.authorFallback') })}>
              {t('communityBoard.replyCta')}
            </button>
          )}
          {isQna && !isReply && isPostAuthor && (
            isAccepted ? (
              <button type="button" className={styles.acceptBtn} onClick={handleUnaccept}>{t('communityBoard.acceptCancelCta')}</button>
            ) : (
              <button type="button" className={styles.acceptBtn} onClick={() => handleAccept(c.COMMENT_ID)}>{t('communityBoard.acceptCta')}</button>
            )
          )}
          {canEdit(c) && editingId !== c.COMMENT_ID && (
            <button type="button" className={styles.actionBtn} onClick={() => startEdit(c)}>{t('communityBoard.editButton')}</button>
          )}
          {canDelete(c) && (
            <button type="button" className={styles.actionBtn} onClick={() => handleDelete(c.COMMENT_ID)}>{t('communityBoard.deleteButton')}</button>
          )}
          <button type="button" className={styles.actionBtn} onClick={() => setReportTarget(c.COMMENT_ID)}>{t('communityBoard.reportCta')}</button>
        </div>
        {c.replies.map((r) => renderComment(r, true))}
      </div>
    );
  };

  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>{isQna ? t('communityBoard.answersTitle') : t('communityBoard.commentsTitle')}</h3>

      {isLoading && <p className={styles.status}>{t('communityBoard.loading')}</p>}
      {!isLoading && comments.length === 0 && <p className={styles.status}>{t('communityBoard.empty')}</p>}
      {comments.map((c) => renderComment(c, false))}

      {user ? (
        <form className={styles.form} onSubmit={handleSubmit}>
          {replyTo && (
            <div className={styles.replyBanner}>
              {t('communityBoard.replyingTo', { name: replyTo.name })}
              <button type="button" onClick={() => setReplyTo(null)}>{t('communityBoard.replyCancel')}</button>
            </div>
          )}
          <div className={styles.formRow}>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={isQna ? t('communityBoard.answerPlaceholder') : t('communityBoard.commentPlaceholder')}
              className={styles.input}
              maxLength={1000}
            />
            <button type="submit" className={styles.submitBtn}>{t('communityBoard.commentSubmit')}</button>
          </div>
        </form>
      ) : (
        <p className={styles.status}>{t('communityBoard.loginRequired')}</p>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}

      {reportTarget != null && (
        <div className={styles.reportBackdrop} onClick={() => setReportTarget(null)}>
          <div className={styles.reportCard} onClick={(e) => e.stopPropagation()}>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder={t('communityBoard.reportReasonPlaceholder')}
              className={styles.reportTextarea}
              maxLength={300}
            />
            <button type="button" className={styles.submitBtn} onClick={submitReport}>{t('communityBoard.reportSubmit')}</button>
          </div>
        </div>
      )}
    </div>
  );
};

const toggleLikeLocal = (comments: CommunityComment[], commentId: number): CommunityComment[] =>
  comments.map((c) => {
    if (c.COMMENT_ID === commentId) {
      return { ...c, LIKED_BY_ME: !c.LIKED_BY_ME, LIKE_COUNT: c.LIKE_COUNT + (c.LIKED_BY_ME ? -1 : 1) };
    }
    if (c.replies.length) return { ...c, replies: toggleLikeLocal(c.replies, commentId) };
    return c;
  });
