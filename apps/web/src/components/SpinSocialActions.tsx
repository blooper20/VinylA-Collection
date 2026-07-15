'use client';

import React, { useState, useRef } from 'react';
import {
  useAuthStore,
  ListeningLogWithAlbum,
  SpinSocialSummary,
  likeSpinLog,
  unlikeSpinLog,
  saveSpinLog,
  unsaveSpinLog,
} from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';
import { copyToClipboard } from '../utils/shareUtils';

interface SpinSocialActionsProps {
  entry: ListeningLogWithAlbum;
  /** 공유 링크용 — 기록 주인의 닉네임 */
  ownerName?: string | null;
  summary?: SpinSocialSummary;
  /** 댓글 카운트 클릭 → 상세(댓글) 모달 열기 */
  onOpenComments: () => void;
  onSummaryChange: (logId: number, summary: SpinSocialSummary) => void;
}

const EMPTY: SpinSocialSummary = { likeCount: 0, commentCount: 0, likedByMe: false, savedByMe: false };

// 다이어리 기록 아래에 붙는 인라인 액션 바 — 좋아요/댓글/공유/저장을
// 모달 없이 바로 실행한다. 신고는 상세 모달에만 둔다.
// 부모가 "섹션 전체 클릭 → 모달"이라 모든 버튼이 클릭 전파를 막는다.
export const SpinSocialActions: React.FC<SpinSocialActionsProps> = ({
  entry,
  ownerName,
  summary,
  onOpenComments,
  onSummaryChange,
}) => {
  const { user } = useAuthStore();
  const { t } = useLocale();
  const s = summary ?? EMPTY;
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const btn = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 6px',
    fontSize: '12px',
    fontWeight: 600,
    color: active ? 'var(--accent, #d4af37)' : 'var(--text-muted, rgba(255,255,255,0.55))',
  });

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return onOpenComments(); // 모달이 로그인 안내를 보여준다
    const prev = s;
    const next = {
      ...s,
      likedByMe: !s.likedByMe,
      likeCount: Math.max(0, s.likeCount + (s.likedByMe ? -1 : 1)),
    };
    onSummaryChange(entry.LOG_ID, next); // 낙관적 — 실패 시 원복
    try {
      if (prev.likedByMe) await unlikeSpinLog(entry.LOG_ID);
      else await likeSpinLog(entry.LOG_ID);
    } catch {
      onSummaryChange(entry.LOG_ID, prev);
    }
  };

  const toggleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return onOpenComments();
    const prev = s;
    onSummaryChange(entry.LOG_ID, { ...s, savedByMe: !s.savedByMe });
    try {
      if (prev.savedByMe) await unsaveSpinLog(entry.LOG_ID);
      else await saveSpinLog(entry.LOG_ID);
    } catch {
      onSummaryChange(entry.LOG_ID, prev);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const name = ownerName ? `n=${encodeURIComponent(ownerName)}&` : '';
    await copyToClipboard(`${window.location.origin}/user/${entry.USER_ID}/dashboard?${name}tab=diary`);
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginTop: '6px' }}>
      <button type="button" onClick={toggleLike} style={btn(s.likedByMe)}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: s.likedByMe ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
        {s.likeCount}
      </button>
      <button type="button" onClick={(e) => { e.stopPropagation(); onOpenComments(); }} style={btn(false)}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chat_bubble</span>
        {s.commentCount}
      </button>
      <button type="button" onClick={handleShare} style={btn(copied)}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>ios_share</span>
        {copied ? t('spinSocial.linkCopied') : t('spinSocial.share')}
      </button>
      <button type="button" onClick={toggleSave} style={btn(s.savedByMe)}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: s.savedByMe ? "'FILL' 1" : "'FILL' 0" }}>bookmark</span>
        {s.savedByMe ? t('spinSocial.saved') : t('spinSocial.save')}
      </button>
    </div>
  );
};
