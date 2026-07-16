'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  getAllNoticesForAdmin,
  createNotice,
  updateNotice,
  deleteNotice,
  uploadNoticeMedia,
} from '@vinyla/core-api';
import { NOTICE, NoticeMediaItem } from '@vinyla/shared-types';
import styles from './notices.module.css';

const MAX_MEDIA_ITEMS = 10;
const MAX_PINNED = 5;

interface FormState {
  noticeId: number | null; // null = 새 글
  title: string;
  content: string;
  mediaItems: NoticeMediaItem[];
  isPinned: boolean;
  isCommentsEnabled: boolean;
}

const emptyForm: FormState = { noticeId: null, title: '', content: '', mediaItems: [], isPinned: false, isCommentsEnabled: true };

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<NOTICE[] | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 브라우저 기본 confirm() 대신 /log·공지 댓글과 동일한 인라인 확인 행 패턴
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    getAllNoticesForAdmin().then(setNotices).catch(() => setNotices([]));
  };

  useEffect(load, []);

  const pinnedCount = (notices || []).filter((n) => n.IS_PINNED).length;
  // 수정 대상이 이미 고정돼 있었다면 자기 자신을 이중 계산하지 않도록 뺀다
  const otherPinnedCount = form?.noticeId
    ? pinnedCount - (notices?.find((n) => n.NOTICE_ID === form.noticeId)?.IS_PINNED ? 1 : 0)
    : pinnedCount;
  const pinDisabled = !form?.isPinned && otherPinnedCount >= MAX_PINNED;

  const openCreate = () => { setForm(emptyForm); setError(null); };
  const openEdit = (n: NOTICE) => {
    setForm({
      noticeId: n.NOTICE_ID, title: n.TITLE, content: n.CONTENT, mediaItems: n.MEDIA_ITEMS || [],
      isPinned: n.IS_PINNED, isCommentsEnabled: n.IS_COMMENTS_ENABLED,
    });
    setError(null);
  };
  const closeForm = () => { setForm(null); setError(null); };

  const handleFilePick = async (file: File | null) => {
    if (!file || !form) return;
    if (form.mediaItems.length >= MAX_MEDIA_ITEMS) {
      setError(`이미지/영상은 최대 ${MAX_MEDIA_ITEMS}개까지 첨부할 수 있습니다.`);
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      const item = await uploadNoticeMedia(file);
      setForm((prev) => (prev ? { ...prev, mediaItems: [...prev.mediaItems, item] } : prev));
    } catch (e: any) {
      setError(e?.message || '미디어 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeMedia = (idx: number) => {
    setForm((prev) => (prev ? { ...prev, mediaItems: prev.mediaItems.filter((_, i) => i !== idx) } : prev));
  };

  const handleSubmit = async () => {
    if (!form || isSubmitting) return;
    if (!form.title.trim() || !form.content.trim()) {
      setError('제목과 내용을 모두 입력해주세요.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const input = {
        title: form.title.trim(), content: form.content.trim(), mediaItems: form.mediaItems,
        isPinned: form.isPinned, isCommentsEnabled: form.isCommentsEnabled,
      };
      if (form.noticeId) await updateNotice(form.noticeId, input);
      else await createNotice(input);
      closeForm();
      load();
    } catch (e: any) {
      setError(e?.message?.includes('pin-limit') ? `상단 고정은 최대 ${MAX_PINNED}개까지 가능합니다.` : (e?.message || '저장에 실패했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async (noticeId: number) => {
    if (deleteSubmitting) return;
    setDeleteSubmitting(true);
    try {
      await deleteNotice(noticeId);
      setDeletingId(null);
      load();
    } catch (e: any) {
      alert(e?.message || '삭제에 실패했습니다.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>공지사항</h1>
        <button type="button" className={styles.newBtn} onClick={openCreate}>새 공지 작성</button>
      </div>

      {notices === null ? (
        <p className={styles.emptyText}>불러오는 중...</p>
      ) : notices.length === 0 ? (
        <p className={styles.emptyText}>등록된 공지사항이 없습니다.</p>
      ) : (
        <div className={styles.list}>
          {notices.map((n) => {
            const firstImage = n.MEDIA_ITEMS?.find((m) => m.type === 'image');
            return (
              <div key={n.NOTICE_ID} className={styles.item}>
                {firstImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={firstImage.url} alt="" className={styles.itemThumb} />
                ) : (
                  <div className={styles.itemThumbEmpty} />
                )}
                <div className={styles.itemBody}>
                  <p className={styles.itemTitle}>
                    {n.IS_PINNED && <span className={styles.pinBadge}>고정</span>}
                    {!n.IS_COMMENTS_ENABLED && <span className={styles.commentsOffBadge}>댓글 닫힘</span>}
                    {n.TITLE}
                  </p>
                  <span className={styles.itemMeta}>{new Date(n.CREATED_AT).toLocaleString()} · 조회 {n.VIEW_COUNT}</span>
                </div>
                {deletingId === n.NOTICE_ID ? (
                  <div className={styles.itemDeleteConfirmRow}>
                    <span>정말 삭제할까요?</span>
                    <button
                      type="button"
                      className={styles.itemDeleteConfirmYes}
                      onClick={() => handleConfirmDelete(n.NOTICE_ID)}
                      disabled={deleteSubmitting}
                    >
                      {deleteSubmitting ? '삭제 중...' : '삭제'}
                    </button>
                    <button
                      type="button"
                      className={styles.itemDeleteConfirmNo}
                      onClick={() => setDeletingId(null)}
                      disabled={deleteSubmitting}
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <div className={styles.itemActions}>
                    <button type="button" className={styles.iconBtn} onClick={() => openEdit(n)}>수정</button>
                    <button type="button" className={styles.deleteBtn} onClick={() => setDeletingId(n.NOTICE_ID)}>삭제</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <div className={styles.overlay} onClick={closeForm}>
          <div className={styles.formCard} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.formTitle}>{form.noticeId ? '공지 수정' : '새 공지 작성'}</h2>

            <label className={styles.label}>제목</label>
            <input
              className={styles.input}
              value={form.title}
              maxLength={200}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              disabled={isSubmitting}
            />

            <label className={styles.label}>내용</label>
            <textarea
              className={styles.textarea}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              disabled={isSubmitting}
            />

            <label className={styles.label}>첨부 이미지/영상</label>
            <div className={styles.mediaGrid}>
              {form.mediaItems.map((m, idx) => (
                <div key={idx} className={styles.mediaThumbWrap}>
                  {m.type === 'video' ? (
                    <video className={styles.mediaThumb} src={m.url} muted />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img className={styles.mediaThumb} src={m.url} alt="" />
                  )}
                  {m.type === 'video' && <span className={styles.mediaVideoBadge}>VIDEO</span>}
                  <button type="button" className={styles.mediaRemoveBtn} onClick={() => removeMedia(idx)} disabled={isSubmitting}>×</button>
                </div>
              ))}
              {form.mediaItems.length < MAX_MEDIA_ITEMS && (
                <button
                  type="button"
                  className={styles.addMediaBtn}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isSubmitting}
                >
                  {isUploading ? '…' : '+'}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
              hidden
              onChange={(e) => handleFilePick(e.target.files?.[0] || null)}
            />

            <div className={styles.pinRow}>
              <input
                id="notice-pin"
                type="checkbox"
                checked={form.isPinned}
                disabled={pinDisabled || isSubmitting}
                onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
              />
              <label htmlFor="notice-pin" className={styles.pinLabel}>상단 고정</label>
              <span className={styles.pinHint}>({otherPinnedCount + (form.isPinned ? 1 : 0)}/{MAX_PINNED})</span>
            </div>

            <div className={styles.pinRow}>
              <input
                id="notice-comments"
                type="checkbox"
                checked={form.isCommentsEnabled}
                disabled={isSubmitting}
                onChange={(e) => setForm({ ...form, isCommentsEnabled: e.target.checked })}
              />
              <label htmlFor="notice-comments" className={styles.pinLabel}>댓글 허용</label>
              <span className={styles.pinHint}>끄면 이 글에는 새 댓글을 달 수 없어요.</span>
            </div>

            {error && <p className={styles.errorText}>{error}</p>}

            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={closeForm} disabled={isSubmitting}>취소</button>
              <button type="button" className={styles.submitBtn} onClick={handleSubmit} disabled={isSubmitting || isUploading}>
                {isSubmitting ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
