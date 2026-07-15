'use client';

import React, { useState } from 'react';
import styles from './ReportModal.module.css';
import { reportSpinLog, reportSpinComment, reportVinyl, reportVinylComment } from '@vinyla/core-api';

interface ReportModalProps {
  isVisible: boolean;
  onClose: () => void;
  targetId: number;
  targetType: 'log' | 'comment' | 'vinyl' | 'vinylComment';
  onReportSuccess?: () => void;
}

const REPORT_REASONS = [
  '스팸홍보/도배글입니다.',
  '음란물입니다.',
  '불법정보를 포함하고 있습니다.',
  '욕설/생명경시/혐오/차별적 표현입니다.',
  '개인정보 노출 게시물입니다.',
  '불쾌한 표현이 있습니다.',
  '기타'
];

export const ReportModal: React.FC<ReportModalProps> = ({ isVisible, onClose, targetId, targetType, onReportSuccess }) => {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isVisible) return null;

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      if (targetType === 'log') {
        await reportSpinLog(targetId, reason, details);
      } else if (targetType === 'comment') {
        await reportSpinComment(targetId, reason, details);
      } else if (targetType === 'vinyl') {
        await reportVinyl(targetId, reason, details);
      } else if (targetType === 'vinylComment') {
        await reportVinylComment(targetId, reason, details);
      }
      alert('신고가 정상적으로 접수되었습니다. 검토 후 조치하겠습니다.');
      if (onReportSuccess) onReportSuccess();
      onClose();
      // Reset form
      setReason(REPORT_REASONS[0]);
      setDetails('');
    } catch (e: any) {
      alert(e.message || '신고 처리 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>신고하기</h2>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>
        
        <div className={styles.content}>
          <label className={styles.label}>신고 사유를 선택해주세요.</label>
          <select 
            className={styles.reasonSelect}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <label className={styles.label}>상세 내용 (선택)</label>
          <textarea 
            className={styles.detailsInput}
            placeholder="신고 내용을 구체적으로 적어주시면 빠른 처리에 도움이 됩니다."
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose} disabled={isSubmitting}>취소</button>
          <button className={styles.submitButton} onClick={handleSubmit} disabled={isSubmitting}>신고하기</button>
        </div>
      </div>
    </div>
  );
};
