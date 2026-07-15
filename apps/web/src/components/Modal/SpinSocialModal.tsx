'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  useAuthStore,
  ListeningLogWithAlbum,
  SpinSocialSummary,
  SpinComment,
  getSpinSocialSummary,
  getSpinLogComments,
  likeSpinLog,
  unlikeSpinLog,
  saveSpinLog,
  unsaveSpinLog,
  reportSpinLog,
  addSpinLogComment,
  deleteSpinLogComment,
  getAlbumMaster,
  getProfilesLite,
} from '@vinyla/core-api';
import { MockVinylData } from '@vinyla/shared-types';
import { useLocale } from '@vinyla/i18n';
import Link from 'next/link';
import { copyToClipboard } from '../../utils/shareUtils';
import { ReportModal } from './ReportModal';
import { DetailModal } from './DetailModal';

const profileHref = (id: string, name?: string | null, currentUser?: any) => {
  if (currentUser && currentUser.id === id) {
    const avatar = currentUser.user_metadata?.avatar_url || '/logo.png';
    const badge = currentUser.user_metadata?.selected_badge || '';
    const genre = currentUser.user_metadata?.interests?.[0] || '';
    const featured = currentUser.user_metadata?.featured_album_id || '';
    return `/user/${id}/dashboard?n=${encodeURIComponent(name || 'Collector')}&a=${encodeURIComponent(avatar)}&b=${encodeURIComponent(badge)}&g=${encodeURIComponent(genre)}&f=${encodeURIComponent(featured)}`;
  }
  return `/user/${id}/dashboard?n=${encodeURIComponent(name || 'Collector')}`;
};

interface SpinSocialModalProps {
  entry: ListeningLogWithAlbum;
  /** 공유 링크 표시용 — 기록 주인의 닉네임 (없으면 링크에 이름 생략) */
  ownerName?: string | null;
  onClose: () => void;
  /** 좋아요/댓글 수가 바뀔 때 목록 화면의 카운트를 갱신 */
  onSummaryChange?: (logId: number, summary: SpinSocialSummary) => void;
}

// 스피닝 다이어리 기록 상세 — 좋아요/댓글(답글)/공유/저장/신고.
// 상호작용 권한(볼 수 있는 기록인지)은 RLS가 판정하므로 여기서는 UI만 담당.
export const SpinSocialModal: React.FC<SpinSocialModalProps> = ({ entry, ownerName, onClose, onSummaryChange }) => {
  const { t } = useLocale();
  const { user } = useAuthStore();
  const [summary, setSummary] = useState<SpinSocialSummary>({
    likeCount: 0, commentCount: 0, likedByMe: false, savedByMe: false,
  });
  const [comments, setComments] = useState<SpinComment[] | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: number; name: string } | null>(null);
  const [reportTarget, setReportTarget] = useState<{ id: number, type: 'log' | 'comment' } | null>(null);
  const [fullAlbum, setFullAlbum] = useState<MockVinylData | null>(null);
  const [ownerImg, setOwnerImg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logId = entry.LOG_ID;
  const album = entry.ALBUM_MASTER;

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 2500);
  };

  const applySummary = (next: SpinSocialSummary) => {
    setSummary(next);
    onSummaryChange?.(logId, next);
  };

  const loadComments = async () => {
    const list = await getSpinLogComments(logId);
    setComments(list);
  };

  useEffect(() => {
    // 모달이 떠 있는 동안 뒤 페이지 스크롤 잠금
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    getSpinSocialSummary([logId]).then((map) => {
      if (map[logId]) applySummary(map[logId]);
    });
    loadComments();
    getProfilesLite([entry.USER_ID]).then((map) => setOwnerImg(map[entry.USER_ID]?.img || null));
    return () => { if (noticeTimer.current) clearTimeout(noticeTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logId]);

  const toggleLike = async () => {
    if (!user) return showNotice(t('spinSocial.loginRequired'));
    const next = {
      ...summary,
      likedByMe: !summary.likedByMe,
      likeCount: Math.max(0, summary.likeCount + (summary.likedByMe ? -1 : 1)),
    };
    const prev = summary;
    applySummary(next); // 낙관적 — 실패 시 원복
    try {
      if (prev.likedByMe) await unlikeSpinLog(logId);
      else await likeSpinLog(logId);
    } catch {
      applySummary(prev);
    }
  };

  const toggleSave = async () => {
    if (!user) return showNotice(t('spinSocial.loginRequired'));
    const next = {
      ...summary,
      savedByMe: !summary.savedByMe,
      // savedByMe는 카운트를 표시하지 않으므로 변경 없음
    };
    applySummary(next);
    try {
      if (next.savedByMe) await saveSpinLog(logId);
      else await unsaveSpinLog(logId);
    } catch (e: any) {
      applySummary(summary);
      showNotice(e.message || t('spinSocial.networkError'));
    }
  };

  const handleAlbumClick = async () => {
    if (!album) return;
    try {
      setSubmitting(true);
      const master = await getAlbumMaster(album.ALBUM_ID);
      if (master) setFullAlbum(master as MockVinylData);
    } catch (e) {
      console.error(e);
      showNotice(t('spinSocial.networkError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleShare = async () => {
    const name = ownerName ? `n=${encodeURIComponent(ownerName)}&` : '';
    await copyToClipboard(`${window.location.origin}/user/${entry.USER_ID}/dashboard?${name}tab=diary`);
    showNotice(t('spinSocial.linkCopied'));
  };

  const handleReportLog = () => {
    if (!user) return showNotice(t('spinSocial.loginRequired'));
    setReportTarget({ id: logId, type: 'log' });
  };

  const handleReportComment = (commentId: number) => {
    if (!user) return showNotice(t('spinSocial.loginRequired'));
    setReportTarget({ id: commentId, type: 'comment' });
  };

  const handleSubmitComment = async () => {
    if (!user) return showNotice(t('spinSocial.loginRequired'));
    if (!commentInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addSpinLogComment(logId, commentInput, replyTo?.id);
      setCommentInput('');
      setReplyTo(null);
      await loadComments();
      applySummary({ ...summary, commentCount: summary.commentCount + 1 });
    } catch {
      showNotice(t('error.DB-001' as any));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (comment: SpinComment) => {
    const removed = 1 + comment.replies.length;
    try {
      await deleteSpinLogComment(comment.COMMENT_ID);
      await loadComments();
      applySummary({ ...summary, commentCount: Math.max(0, summary.commentCount - removed) });
    } catch {
      showNotice(t('error.DB-003' as any));
    }
  };

  // 댓글 작성자 본인 또는 기록 주인만 삭제 버튼 노출 (실제 판정은 RLS)
  const canDelete = (c: SpinComment) => !!user && (user.id === c.USER_ID || user.id === entry.USER_ID);

  const actionBtn = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    background: 'none', border: 'none', cursor: 'pointer',
    color: active ? '#d4af37' : 'rgba(255,255,255,0.6)',
    fontSize: '13px', fontWeight: 600, padding: '6px 8px',
  });

  const renderComment = (c: SpinComment, isReply = false) => (
    <div key={c.COMMENT_ID} style={{ marginLeft: isReply ? '34px' : 0, padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {c.PROFILE_IMAGE_URL ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={c.PROFILE_IMAGE_URL} alt="" style={{ width: '20px', height: '20px', borderRadius: '10px', objectFit: 'cover', background: 'rgba(255,255,255,0.08)' }} />
        ) : (
          <div style={{ width: '20px', height: '20px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>person</span>
          </div>
        )}
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#d4af37' }}>
          {c.DISPLAY_NAME || t('feed.anonymous')}
        </span>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
          {new Date(c.CREATED_AT).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
        </span>
      </div>
      <p style={{ margin: '4px 0 2px', fontSize: '13px', color: c.IS_HIDDEN ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {c.IS_HIDDEN ? '관리자에 의해 비공개 처리된 댓글입니다.' : c.CONTENT}
      </p>
      <div style={{ display: 'flex', gap: '10px' }}>
        {!isReply && (
          <button
            onClick={() => setReplyTo({ id: c.COMMENT_ID, name: c.DISPLAY_NAME || t('feed.anonymous') })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'rgba(255,255,255,0.45)', padding: 0 }}
          >
            {t('spinSocial.reply')}
          </button>
        )}
        {canDelete(c) && (
          <button
            onClick={() => handleDeleteComment(c)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#eb5757', padding: 0 }}
          >
            {t('spinSocial.delete')}
          </button>
        )}
        {user && user.id !== c.USER_ID && !c.IS_HIDDEN && (
          <button
            onClick={() => handleReportComment(c.COMMENT_ID)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'rgba(255,255,255,0.3)', padding: 0 }}
          >
            {t('spinSocial.report')}
          </button>
        )}
      </div>
      {c.replies.map((r) => renderComment(r, true))}
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, backdropFilter: 'blur(8px)'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1814',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          width: '440px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden'
        }}
      >
        {/* 유저 프로필 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Link href={profileHref(entry.USER_ID, entry.DISPLAY_NAME || ownerName, user)} style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flex: 1 }}>
            {ownerImg ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={ownerImg} alt="" style={{ width: '28px', height: '28px', borderRadius: '14px', objectFit: 'cover', background: 'rgba(255,255,255,0.1)' }} />
            ) : (
              <div style={{ width: '28px', height: '28px', borderRadius: '14px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'rgba(255,255,255,0.6)' }}>person</span>
              </div>
            )}
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>
              {entry.DISPLAY_NAME || ownerName || t('feed.anonymous')}
            </span>
          </Link>
          <button onClick={onClose} aria-label="close" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>close</span>
          </button>
        </div>

        {/* 본문 스크롤 영역: 앨범 카드 ~ 댓글 목록 (헤더/입력창은 고정) */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>

        {/* 앨범 카드 (클릭 시 상세 모달) */}
        <div
          onClick={handleAlbumClick}
          style={{ display: 'flex', gap: '14px', margin: '0 18px', padding: '12px 14px', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', borderRadius: '12px' }}
        >
          {album && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={album.IMAGE_URL} alt={album.TITLE} style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {album?.TITLE}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{album?.ARTIST}</div>
          </div>
          <span className="material-symbols-outlined" style={{ alignSelf: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '20px' }}>chevron_right</span>
        </div>

        <div style={{ padding: '12px 18px 0', fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
          {new Date(entry.LISTENED_AT).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
          {entry.MOOD ? ` · ${entry.MOOD}` : ''}
        </div>

        {entry.NOTE && (
          <p style={{ margin: 0, padding: '12px 18px 0', fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {entry.NOTE}
          </p>
        )}

        {/* 미디어 렌더링 (사진/영상) */}
        {entry.MEDIA_URL && (
          <div style={{ padding: '12px 18px 0' }}>
            {entry.MEDIA_TYPE === 'video' ? (
              <video 
                src={entry.MEDIA_URL} 
                controls 
                autoPlay 
                loop 
                muted 
                playsInline
                style={{ width: '100%', maxHeight: '300px', borderRadius: '8px', objectFit: 'contain', background: '#000' }} 
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img 
                src={entry.MEDIA_URL} 
                alt="Diary Media" 
                style={{ width: '100%', maxHeight: '300px', borderRadius: '8px', objectFit: 'contain', background: '#000' }} 
              />
            )}
          </div>
        )}

        {/* 액션 바: 좋아요 · 공유 · 저장 · 신고 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={toggleLike} style={actionBtn(summary.likedByMe)}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: summary.likedByMe ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
            {summary.likeCount}
          </button>
          <span style={{ ...actionBtn(false), cursor: 'default' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chat_bubble</span>
            {summary.commentCount}
          </span>
          <button onClick={handleShare} style={actionBtn(false)}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>ios_share</span>
            {t('spinSocial.share')}
          </button>
          <button onClick={toggleSave} style={actionBtn(summary.savedByMe)}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: summary.savedByMe ? "'FILL' 1" : "'FILL' 0" }}>bookmark</span>
            {summary.savedByMe ? t('spinSocial.saved') : t('spinSocial.save')}
          </button>
          <button onClick={handleReportLog} style={{ ...actionBtn(false), marginLeft: 'auto', color: 'rgba(255,255,255,0.35)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>flag</span>
            {t('spinSocial.report')}
          </button>
        </div>

        {/* 댓글 목록 */}
        <div style={{ padding: '6px 18px' }}>
          {comments === null ? (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '24px 0' }}>{t('feed.loading')}</p>
          ) : comments.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px', padding: '24px 0' }}>{t('spinSocial.empty')}</p>
          ) : (
            comments.map((c) => renderComment(c))
          )}
        </div>

        </div>{/* 본문 스크롤 영역 끝 */}

        {notice && (
          <p style={{ margin: 0, padding: '6px 18px', fontSize: '12px', color: '#d4af37', textAlign: 'center' }}>{notice}</p>
        )}

        {/* 댓글 입력 */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 14px' }}>
          {replyTo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
              {t('spinSocial.replyingTo', { name: replyTo.name })}
              <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
              </button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={commentInput}
              maxLength={500}
              placeholder={user ? t('spinSocial.commentPlaceholder') : t('spinSocial.loginRequired')}
              disabled={!user || submitting}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSubmitComment(); }}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)',
                color: '#fff', fontSize: '13px', outline: 'none'
              }}
            />
            <button
              onClick={handleSubmitComment}
              disabled={!user || submitting || !commentInput.trim()}
              style={{
                padding: '10px 18px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #d4af37, #f3e5ab)', color: '#111',
                fontSize: '13px', fontWeight: 700,
                cursor: !user || submitting || !commentInput.trim() ? 'default' : 'pointer',
                opacity: !user || submitting || !commentInput.trim() ? 0.5 : 1
              }}
            >
              {t('spinSocial.submit')}
            </button>
          </div>
        </div>
      </div>

      <ReportModal 
        isVisible={!!reportTarget} 
        onClose={() => setReportTarget(null)} 
        targetId={reportTarget?.id || 0} 
        targetType={reportTarget?.type || 'log'}
      />
      {fullAlbum && (
        <DetailModal 
          album={fullAlbum} 
          onClose={() => setFullAlbum(null)} 
        />
      )}
    </div>
  );
};
