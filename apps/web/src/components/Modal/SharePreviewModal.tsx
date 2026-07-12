import React, { useEffect, useState } from 'react';
import styles from './SharePreviewModal.module.css';
import { downloadImageBlob, copyImageBlobToClipboard } from '../../utils/shareUtils';
import { useLocale } from '@vinyla/i18n';

interface SharePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  blob: Blob | null;
  mode: 'save' | 'copy' | null;
}

export const SharePreviewModal: React.FC<SharePreviewModalProps> = ({ isOpen, onClose, blob, mode }) => {
  const { t } = useLocale();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen && blob) {
      const url = URL.createObjectURL(blob);
      // blob→objectURL 생성/해제를 effect 생명주기에 묶어야 해서 동기 setState가 불가피함
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImageUrl(null);
    }
  }, [isOpen, blob]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!blob || !mode) return;
    setIsProcessing(true);
    
    try {
      if (mode === 'save') {
        await downloadImageBlob(blob, 'vinyla-share.jpg');
        window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: t('previewModal.imageSaved') } }));
      } else if (mode === 'copy') {
        const success = await copyImageBlobToClipboard(blob);
        if (success) {
          window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: t('previewModal.imageCopied') } }));
        } else {
          window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: t('previewModal.copyNotSupported') } }));
        }
      }
      onClose();
    } catch (err) {
      console.error('Share error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>{t('previewModal.title')}</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className={styles.previewContainer}>
          {imageUrl ? (
            <img src={imageUrl} alt="Share Preview" className={styles.previewImage} />
          ) : (
            <div className={styles.loadingSpinner} />
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.btnCancel} onClick={onClose} disabled={isProcessing}>
            {t('common.cancel')}
          </button>
          <button className={styles.btnPrimary} onClick={handleConfirm} disabled={isProcessing || !blob}>
            <span className="material-symbols-outlined">
              {mode === 'save' ? 'download' : 'content_copy'}
            </span>
            {mode === 'save' ? t('previewModal.save') : t('previewModal.copy')}
          </button>
        </div>
      </div>
    </div>
  );
};
