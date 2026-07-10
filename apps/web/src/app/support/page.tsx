'use client';

import React, { useState, useEffect, useCallback } from 'react';
import styles from './support.module.css';
import {
  useAuthStore,
  createInquiry,
  fetchMyInquiries,
  addUserReply,
  InquiryWithReplies,
} from '@vinyla/core-api';
import { InquiryCategory, InquiryStatus } from '@vinyla/shared-types';

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
    if (user) loadInquiries();
  }, [user, loadInquiries]);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await createInquiry(category, title.trim(), content.trim());
      setTitle('');
      setContent('');
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
