'use client';

import React, { Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  useAuthStore,
  getCommunityPost,
  incrementCommunityPostViewCount,
  deleteCommunityPost,
  reportCommunityPost,
  likeCommunityPost,
  unlikeCommunityPost,
  getErrorMessage,
  getAlbumMaster,
  getUserVinyls,
  CommunityPostWithMeta,
} from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { MockVinylData } from '@vinyla/shared-types';
import { CommunityCommentThread } from '../../../components/Community/CommunityCommentThread';
import { ShowcaseCarousel } from '../../../components/Community/ShowcaseCarousel';
import { buildShowcaseItems } from '../../../components/Community/showcaseCarouselItems';
import { DetailModal } from '../../../components/Modal/DetailModal';
import styles from './page.module.css';

// ?from=feed(자랑게시판 글이 소셜 피드에 섞여 노출될 때의 진입 경로 구분)를
// 읽는 useSearchParams()만 Suspense로 감싼다 — community/page.tsx와 동일 이유.
function CommunityPostDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { t } = useLocale();
  const postId = Number(params.postId);
  // 소셜 피드(/feed)에 섞여 노출된 자랑게시판 글은 뒤로가기도 피드로
  // 돌아가야 자연스럽다 — ?from=feed로 진입 경로를 구분한다.
  const cameFromFeed = searchParams.get('from') === 'feed';
  const backHref = cameFromFeed ? '/feed' : '/community';
  const backLabel = cameFromFeed ? t('feed.title') : t('communityBoard.pageTitle');

  const [post, setPost] = React.useState<CommunityPostWithMeta | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [toast, setToast] = React.useState<string | null>(null);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [reportReason, setReportReason] = React.useState('');
  const [selectedAlbum, setSelectedAlbum] = React.useState<MockVinylData | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = React.useState(false);
  // 게시글에 첨부된 앨범을 열었을 때 "이미 내 컬렉션/위시리스트에 있는지"를
  // 반영하기 위한 조회수 — /user/{id} 공개 프로필 그리드(PublicGrid)의
  // viewerStatusMap과 동일한 목적.
  const [viewerStatusMap, setViewerStatusMap] = React.useState<Record<string, 'OWNED' | 'WISH'>>({});

  React.useEffect(() => {
    if (!Number.isFinite(postId)) return;
    getCommunityPost(postId).then(setPost).finally(() => setIsLoading(false));
    incrementCommunityPostViewCount(postId);
  }, [postId]);

  React.useEffect(() => {
    if (!user?.id) return;
    getUserVinyls(user.id)
      .then((vinyls) => {
        const map: Record<string, 'OWNED' | 'WISH'> = {};
        (vinyls || []).forEach((v) => {
          if (v.STATUS === 'OWNED' || v.STATUS === 'WISH') map[String(v.ALBUM_ID)] = v.STATUS;
        });
        setViewerStatusMap(map);
      })
      .catch(() => {});
  }, [user?.id]);

  const handleAlbumClick = async (albumId: number) => {
    if (!user) { setShowLoginPrompt(true); return; }
    const master = await getAlbumMaster(albumId).catch(() => null);
    if (!master) return;
    setSelectedAlbum({ ...master, STATUS: viewerStatusMap[String(albumId)] } as MockVinylData);
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async () => {
    if (!window.confirm(t('communityBoard.deleteConfirm'))) return;
    try {
      await deleteCommunityPost(postId);
      router.push(backHref);
    } catch (err) {
      showToast(getErrorMessage(err, t));
    }
  };

  const handleToggleResonance = async () => {
    if (!post) return;
    if (!user) { setShowLoginPrompt(true); return; }
    const wasLiked = post.LIKED_BY_ME;
    setPost((p) => (p ? { ...p, LIKED_BY_ME: !wasLiked, LIKE_COUNT: p.LIKE_COUNT + (wasLiked ? -1 : 1) } : p));
    try {
      if (wasLiked) await unlikeCommunityPost(postId);
      else await likeCommunityPost(postId);
    } catch (err) {
      setPost((p) => (p ? { ...p, LIKED_BY_ME: wasLiked, LIKE_COUNT: p.LIKE_COUNT + (wasLiked ? 1 : -1) } : p));
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
      <Link href={backHref} className={styles.backLink}>← {backLabel}</Link>

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

      {(post.albums.length > 0 || post.MEDIA_ITEMS.length > 0) && (
        <ShowcaseCarousel items={buildShowcaseItems(post.albums, post.MEDIA_ITEMS)} onAlbumClick={handleAlbumClick} />
      )}

      <p className={styles.content}>{post.CONTENT}</p>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={handleToggleResonance}
          title={t('communityBoard.resonanceCta')}
          style={post.LIKED_BY_ME ? { color: '#e6b93c' } : undefined}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, verticalAlign: '-3px', fontVariationSettings: post.LIKED_BY_ME ? "'FILL' 1" : "'FILL' 0" }}>music_note</span>
          {' '}{post.LIKE_COUNT > 0 ? post.LIKE_COUNT : t('communityBoard.resonanceCta')}
        </button>
        {isAuthor && <Link href={`/community/${postId}/edit`} className={styles.actionBtn} style={{ textDecoration: 'none' }}>{t('communityBoard.editButton')}</Link>}
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

      {selectedAlbum && <DetailModal album={selectedAlbum} onClose={() => setSelectedAlbum(null)} />}

      {/* 로그인 없이 첨부 앨범을 눌렀을 때 — PublicGrid(/user/{id})와 동일한 안내 */}
      {showLoginPrompt && (
        <div onClick={() => setShowLoginPrompt(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(8px)'
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#1a1814',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '24px',
            padding: '48px 40px',
            width: '360px',
            textAlign: 'center',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6)'
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#d4af37', marginBottom: '16px', display: 'block', fontVariationSettings: "'FILL' 1" }}>lock</span>
            <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 12px' }}>{t('publicGrid.loginRequiredTitle')}</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '0 0 32px' }}>
              {t('publicGrid.loginRequiredLine1')}<br />{t('publicGrid.loginRequiredLine2')}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowLoginPrompt(false)} style={{
                flex: 1, padding: '14px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.6)', fontSize: '15px', cursor: 'pointer'
              }}>{t('common.cancel')}</button>
              <Link href="/" style={{
                flex: 1, padding: '14px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #d4af37, #f3e5ab)',
                color: '#111', fontSize: '15px', fontWeight: 700,
                textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>{t('common.login')}</Link>
            </div>
          </div>
        </div>
      )}

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

export default function CommunityPostDetailPage() {
  return (
    <Suspense fallback={null}>
      <CommunityPostDetailContent />
    </Suspense>
  );
}
