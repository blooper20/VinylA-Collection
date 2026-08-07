'use client';

import React, { useState } from 'react';
import styles from './ReportModal.module.css';
import { reportSpinLog, reportSpinComment, reportVinyl, reportVinylComment } from '@vinyla/core-api';
import { useLocale } from '@vinyla/i18n';

interface ReportModalProps {
  isVisible: boolean;
  onClose: () => void;
  targetId: number;
  targetType: 'log' | 'comment' | 'vinyl' | 'vinylComment';
  onReportSuccess?: () => void;
}

const REPORT_REASON_KEYS = ['spam', 'adult', 'illegal', 'hate', 'privacy', 'offensive', 'other'] as const;

export const ReportModal: React.FC<ReportModalProps> = ({ isVisible, onClose, targetId, targetType, onReportSuccess }) => {
  const { t } = useLocale();
  const REPORT_REASONS = REPORT_REASON_KEYS.map((key) => t(`report.reasons.${key}` as any));
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
      alert(t('report.successMessage'));
      if (onReportSuccess) onReportSuccess();
      onClose();
      // Reset form
      setReason(REPORT_REASONS[0]);
      setDetails('');
    } catch (e: any) {
      alert(e.message || t('report.failedMessage'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('report.title')}</h2>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        <div className={styles.content}>
          <label className={styles.label}>{t('report.reasonLabel')}</label>
          <select
            className={styles.reasonSelect}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          >
            {REPORT_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <label className={styles.label}>{t('report.detailsLabel')}</label>
          <textarea
            className={styles.detailsInput}
            placeholder={t('report.detailsPlaceholder')}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</button>
          <button className={styles.submitButton} onClick={handleSubmit} disabled={isSubmitting}>{t('report.submit')}</button>
        </div>
      </div>
    </div>
  );
};
