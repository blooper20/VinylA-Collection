'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import styles from './support.module.css';
import {
  useAuthStore,
  createInquiry,
  fetchMyInquiries,
  addUserReply,
  uploadInquiryAttachment,
  InquiryWithReplies,
} from '@vinyla/core-api';
import { InquiryCategory, InquiryStatus, InquiryAttachment } from '@vinyla/shared-types';

const MAX_ATTACHMENTS = 3;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

// 첨부 썸네일 그리드 (문의 본문 하단) — 이미지·GIF는 새 탭 원본, 영상은 인라인 재생
function AttachmentGrid({ attachments }: { attachments?: InquiryAttachment[] | null }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className={styles.attachmentGrid}>
      {attachments.map((a, i) =>
        a.type === 'video' ? (
          <video key={i} className={styles.attachmentMedia} src={a.url} controls preload="metadata" />
        ) : (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.attachmentMedia} src={a.url} alt={a.name} loading="lazy" />
          </a>
        )
      )}
    </div>
  );
}

const CATEGORIES: { value: InquiryCategory; label: string }[] = [
  { value: 'COMPLAINT', label: '불만' },
  { value: 'SUGGESTION', label: '건의' },
  { value: 'BUG', label: '버그 신고' },
  { value: 'GENERAL', label: '기타' },
];

const STATUS_LABEL: Record<InquiryStatus, string> = {
  OPEN: '답변 대기',
  ANSWERED: '답변 완료',
  CLOSED: '종료',
};

const CATEGORY_LABEL: Record<InquiryCategory, string> = {
  COMPLAINT: '불만',
  SUGGESTION: '건의',
  BUG: '버그',
  GENERAL: '기타',
};

export default function SupportPage() {
  const { user } = useAuthStore();
  const [category, setCategory] = useState<InquiryCategory>('SUGGESTION');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inquiries, setInquiries] = useState<InquiryWithReplies[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replySubmitting, setReplySubmitting] = useState<number | null>(null);

  const loadInquiries = useCallback(async () => {
    try {
      const data = await fetchMyInquiries();
      setInquiries(data);
    } catch (e) {
      console.error('Failed to load inquiries', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 마운트/유저 변경 시 문의 목록을 불러오는 비동기 데이터 로딩 패턴 (의도된 동작)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) loadInquiries();
  }, [user, loadInquiries]);

  const handlePickFiles = (picked: FileList | null) => {
    if (!picked) return;
    const next = [...pendingFiles];
    for (const f of Array.from(picked)) {
      if (next.length >= MAX_ATTACHMENTS) {
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: `첨부는 최대 ${MAX_ATTACHMENTS}개까지 가능합니다.` } }));
        break;
      }
      const isImage = f.type.startsWith('image/');
      const isVideo = f.type.startsWith('video/');
      if (!isImage && !isVideo) {
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: '이미지·GIF·영상 파일만 첨부할 수 있습니다.' } }));
        continue;
      }
      if (f.size > (isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES)) {
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: `파일이 너무 큽니다 (이미지 10MB, 영상 50MB 이하).` } }));
        continue;
      }
      next.push(f);
    }
    setPendingFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const attachments = [];
      for (const f of pendingFiles) {
        attachments.push(await uploadInquiryAttachment(f));
      }
      await createInquiry(category, title.trim(), content.trim(), 'WEB', attachments);
      setTitle('');
      setContent('');
      setPendingFiles([]);
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: '문의가 접수되었습니다.' } }));
      await loadInquiries();
    } catch (e) {
      console.error('Failed to create inquiry', e);
      window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: '문의 접수에 실패했습니다. 잠시 후 다시 시도해주세요.' } }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (inquiryId: number) => {
    const draft = (replyDrafts[inquiryId] || '').trim();
    if (!draft || replySubmitting !== null) return;
    setReplySubmitting(inquiryId);
    try {
      await addUserReply(inquiryId, draft);
      setReplyDrafts((prev) => ({ ...prev, [inquiryId]: '' }));
      await loadInquiries();
    } catch (e) {
      console.error('Failed to add reply', e);
    } finally {
      setReplySubmitting(null);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>SUPPORT</p>
        <h1 className={styles.title}>문의하기</h1>
        <p className={styles.subtitle}>불편한 점이나 바라는 점을 남겨주시면 확인 후 답변드립니다.</p>
      </header>

      {/* 작성 폼 */}
      <section className={styles.formCard}>
        <div className={styles.formGroup}>
          <label className={styles.label}>유형</label>
          <div className={styles.categoryRow}>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`${styles.categoryBtn} ${category === c.value ? styles.categorySelected : ''}`}
                onClick={() => setCategory(c.value)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>제목</label>
          <input
            type="text"
            className={styles.input}
            placeholder="문의 제목을 입력해주세요"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>내용</label>
          <textarea
            className={styles.textarea}
            placeholder="내용을 자세히 적어주실수록 정확한 답변이 가능합니다"
            value={content}
            maxLength={2000}
            rows={6}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>첨부 파일 <span className={styles.labelHint}>이미지 · GIF · 영상, 최대 {MAX_ATTACHMENTS}개</span></label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => handlePickFiles(e.target.files)}
          />
          <div className={styles.attachRow}>
            {pendingFiles.map((f, i) => (
              <div key={i} className={styles.previewItem}>
                {f.type.startsWith('video/') ? (
                  <video className={styles.previewMedia} src={URL.createObjectURL(f)} muted />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img className={styles.previewMedia} src={URL.createObjectURL(f)} alt={f.name} />
                )}
                <button
                  type="button"
                  className={styles.previewRemove}
                  aria-label="첨부 제거"
                  onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            {pendingFiles.length < MAX_ATTACHMENTS && (
              <button type="button" className={styles.attachBtn} onClick={() => fileInputRef.current?.click()}>
                + 파일 추가
              </button>
            )}
          </div>
        </div>

        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={isSubmitting || !title.trim() || !content.trim()}
        >
          {isSubmitting ? '접수 중...' : '문의 보내기'}
        </button>
      </section>

      {/* 내 문의 내역 */}
      <section className={styles.history}>
        <h2 className={styles.historyTitle}>내 문의 내역</h2>

        {isLoading ? (
          <p className={styles.emptyText}>불러오는 중...</p>
        ) : inquiries.length === 0 ? (
          <p className={styles.emptyText}>아직 보낸 문의가 없습니다.</p>
        ) : (
          <ul className={styles.inquiryList}>
            {inquiries.map((inq) => {
              const isExpanded = expandedId === inq.INQUIRY_ID;
              return (
                <li key={inq.INQUIRY_ID} className={styles.inquiryItem}>
                  <button
                    type="button"
                    className={styles.inquiryHead}
                    onClick={() => setExpandedId(isExpanded ? null : inq.INQUIRY_ID)}
                  >
                    <span className={styles.categoryBadge}>{CATEGORY_LABEL[inq.CATEGORY]}</span>
                    <span className={styles.inquiryTitle}>{inq.TITLE}</span>
                    <span className={styles.inquiryDate}>
                      {new Date(inq.CREATED_AT).toLocaleDateString('ko-KR')}
                    </span>
                    <span className={`${styles.statusBadge} ${styles[`status${inq.STATUS}`]}`}>
                      {STATUS_LABEL[inq.STATUS]}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className={styles.thread}>
                      <div className={styles.messageUser}>
                        <p className={styles.messageContent}>{inq.CONTENT}</p>
                        <AttachmentGrid attachments={inq.ATTACHMENTS} />
                        <span className={styles.messageTime}>
                          {new Date(inq.CREATED_AT).toLocaleString('ko-KR')}
                        </span>
                      </div>

                      {inq.INQUIRY_REPLY.map((reply) => (
                        <div
                          key={reply.REPLY_ID}
                          className={reply.IS_ADMIN ? styles.messageAdmin : styles.messageUser}
                        >
                          {reply.IS_ADMIN && <span className={styles.adminBadge}>관리자</span>}
                          <p className={styles.messageContent}>{reply.CONTENT}</p>
                          <span className={styles.messageTime}>
                            {new Date(reply.CREATED_AT).toLocaleString('ko-KR')}
                          </span>
                        </div>
                      ))}

                      {inq.STATUS !== 'CLOSED' && (
                        <div className={styles.replyRow}>
                          <input
                            type="text"
                            className={styles.replyInput}
                            placeholder="추가로 남길 말이 있다면 입력하세요"
                            value={replyDrafts[inq.INQUIRY_ID] || ''}
                            maxLength={1000}
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({ ...prev, [inq.INQUIRY_ID]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleReply(inq.INQUIRY_ID);
                            }}
                          />
                          <button
                            type="button"
                            className={styles.replyBtn}
                            onClick={() => handleReply(inq.INQUIRY_ID)}
                            disabled={replySubmitting === inq.INQUIRY_ID || !(replyDrafts[inq.INQUIRY_ID] || '').trim()}
                          >
                            등록
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
