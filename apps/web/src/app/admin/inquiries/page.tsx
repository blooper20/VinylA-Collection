'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@vinyla/core-api';
import { INQUIRY, INQUIRY_REPLY, InquiryStatus, InquiryCategory } from '@vinyla/shared-types';
import styles from './inquiries.module.css';

type AdminInquiry = INQUIRY & { INQUIRY_REPLY: INQUIRY_REPLY[]; DISPLAY_NAME: string };

const STATUS_TABS: { value: InquiryStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'OPEN', label: '답변 대기' },
  { value: 'ANSWERED', label: '답변 완료' },
  { value: 'CLOSED', label: '종료' },
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

const authHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session?.access_token || ''}` };
};

export default function AdminInquiriesPage() {
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | 'ALL'>('ALL');
  const [inquiries, setInquiries] = useState<AdminInquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadInquiries = useCallback(async (filter: InquiryStatus | 'ALL') => {
    setIsLoading(true);
    try {
      const qs = filter === 'ALL' ? '' : `?status=${filter}`;
      const res = await fetch(`/api/admin/inquiries${qs}`, { headers: await authHeaders() });
      if (!res.ok) throw new Error(`목록 조회 실패 (${res.status})`);
      const body = await res.json();
      setInquiries(body.inquiries || []);
    } catch (e) {
      console.error('Failed to load inquiries', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 필터 변경 시 이전 목록이 잠깐 노출되지 않도록 로딩 플래그를 동기로 켜야 함
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInquiries(statusFilter);
  }, [statusFilter, loadInquiries]);

  const selected = inquiries.find((i) => i.INQUIRY_ID === selectedId) || null;

  const handleReply = async () => {
    if (!selected || !replyDraft.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${selected.INQUIRY_ID}/reply`, {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyDraft.trim() }),
      });
      if (!res.ok) throw new Error(`답변 등록 실패 (${res.status})`);
      setReplyDraft('');
      await loadInquiries(statusFilter);
    } catch (e) {
      console.error('Failed to reply', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (status: InquiryStatus) => {
    if (!selected || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/inquiries/${selected.INQUIRY_ID}`, {
        method: 'PATCH',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`상태 변경 실패 (${res.status})`);
      await loadInquiries(statusFilter);
    } catch (e) {
      console.error('Failed to change status', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className={styles.filterRow}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`${styles.filterBtn} ${statusFilter === tab.value ? styles.filterActive : ''}`}
            onClick={() => {
              setStatusFilter(tab.value);
              setSelectedId(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.split}>
        {/* 목록 */}
        <div className={styles.listPane}>
          {isLoading ? (
            <p className={styles.placeholder}>불러오는 중...</p>
          ) : inquiries.length === 0 ? (
            <p className={styles.placeholder}>문의가 없습니다.</p>
          ) : (
            <ul className={styles.list}>
              {inquiries.map((inq) => (
                <li key={inq.INQUIRY_ID}>
                  <button
                    type="button"
                    className={`${styles.listItem} ${selectedId === inq.INQUIRY_ID ? styles.listItemActive : ''}`}
                    onClick={() => {
                      setSelectedId(inq.INQUIRY_ID);
                      setReplyDraft('');
                    }}
                  >
                    <div className={styles.listItemTop}>
                      <span className={`${styles.statusDot} ${styles[`dot${inq.STATUS}`]}`} />
                      <span className={styles.listTitle}>{inq.TITLE}</span>
                    </div>
                    <div className={styles.listItemBottom}>
                      <span>{CATEGORY_LABEL[inq.CATEGORY]}</span>
                      <span>·</span>
                      <span>{inq.DISPLAY_NAME}</span>
                      <span>·</span>
                      <span>{new Date(inq.CREATED_AT).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 상세 */}
        <div className={styles.detailPane}>
          {!selected ? (
            <p className={styles.placeholder}>왼쪽에서 문의를 선택하세요.</p>
          ) : (
            <>
              <header className={styles.detailHeader}>
                <div>
                  <h2 className={styles.detailTitle}>{selected.TITLE}</h2>
                  <p className={styles.detailMeta}>
                    {CATEGORY_LABEL[selected.CATEGORY]} · {selected.DISPLAY_NAME} ·{' '}
                    {new Date(selected.CREATED_AT).toLocaleString('ko-KR')} ·{' '}
                    {STATUS_LABEL[selected.STATUS]}
                  </p>
                </div>
                {selected.STATUS !== 'CLOSED' ? (
                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={() => handleStatusChange('CLOSED')}
                    disabled={isSubmitting}
                  >
                    종료 처리
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.closeBtn}
                    onClick={() => handleStatusChange('ANSWERED')}
                    disabled={isSubmitting}
                  >
                    다시 열기
                  </button>
                )}
              </header>

              <div className={styles.thread}>
                <div className={styles.messageUser}>
                  <p className={styles.messageContent}>{selected.CONTENT}</p>
                  <span className={styles.messageTime}>
                    {new Date(selected.CREATED_AT).toLocaleString('ko-KR')}
                  </span>
                </div>

                {selected.INQUIRY_REPLY.map((reply) => (
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
              </div>

              <div className={styles.replyBox}>
                <textarea
                  className={styles.replyInput}
                  placeholder="답변을 입력하세요 (등록 시 자동으로 '답변 완료' 처리)"
                  value={replyDraft}
                  rows={4}
                  maxLength={2000}
                  onChange={(e) => setReplyDraft(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.replyBtn}
                  onClick={handleReply}
                  disabled={isSubmitting || !replyDraft.trim()}
                >
                  {isSubmitting ? '등록 중...' : '답변 등록'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
