import React, { useState } from 'react';
import styles from './DeleteAccountModal.module.css';
import { useLocale } from '@vinyla/i18n';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm
}: DeleteAccountModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { t } = useLocale();

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } catch (e) {
      console.error(e);
      alert(t('deleteAccount.failed'));
    } finally {
      setIsDeleting(false);
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.iconWrapper}>
            <span className="material-symbols-outlined">warning</span>
          </div>
          <h3 className={styles.title}>{t('deleteAccount.title')}</h3>
        </div>
        <div className={styles.content}>
          <p>{t('deleteAccount.body')}</p>
          <div className={styles.warning}>
            {t('deleteAccount.warning')}
          </div>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.btnCancel}
            onClick={onClose}
            disabled={isDeleting}
          >
            {t('common.cancel')}
          </button>
          <button
            className={styles.btnDelete}
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? t('deleteAccount.processing') : t('deleteAccount.confirmButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
