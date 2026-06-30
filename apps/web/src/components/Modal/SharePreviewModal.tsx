import React, { useEffect, useState } from 'react';
import styles from './SharePreviewModal.module.css';
import { downloadImageBlob, copyImageBlobToClipboard } from '../../utils/shareUtils';

interface SharePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  blob: Blob | null;
  mode: 'save' | 'copy' | null;
}

export const SharePreviewModal: React.FC<SharePreviewModalProps> = ({ isOpen, onClose, blob, mode }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen && blob) {
      const url = URL.createObjectURL(blob);
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
      } else if (mode === 'copy') {
        const success = await copyImageBlobToClipboard(blob);
        if (success) {
          window.dispatchEvent(new CustomEvent('SHOW_TOAST', { detail: { message: '이미지가 클립보드에 복사되었습니다.' } }));
        } else {
          alert('이미지 복사가 지원되지 않는 브라우저입니다.');
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
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>미리보기</h3>
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
            취소
          </button>
          <button className={styles.btnPrimary} onClick={handleConfirm} disabled={isProcessing || !blob}>
            <span className="material-symbols-outlined">
              {mode === 'save' ? 'download' : 'content_copy'}
            </span>
            {mode === 'save' ? '저장하기' : '복사하기'}
          </button>
        </div>
      </div>
    </div>
  );
};
