import React, { useState } from 'react';
import styles from './DeleteAllNotificationsModal.module.css';
import { useLocale } from '@vinyla/i18n';

interface DeleteAllNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteAllNotificationsModal({
  isOpen,
  onClose,
  onConfirm,
}: DeleteAllNotificationsModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { t } = useLocale();

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <span className="material-symbols-outlined">warning</span>
          </div>
          <h3 className={styles.title}>{t('notif.deleteAllTitle')}</h3>
        </div>
        <div className={styles.content}>
          <p>{t('notif.deleteAllBody')}</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onClose} disabled={isDeleting}>
            {t('common.cancel')}
          </button>
          <button className={styles.btnDelete} onClick={handleConfirm} disabled={isDeleting}>
            {isDeleting ? t('notif.deleteAllProcessing') : t('notif.deleteAll')}
          </button>
        </div>
      </div>
    </div>
  );
}
