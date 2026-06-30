import React, { useState } from 'react';
import styles from './DeleteAccountModal.module.css';

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

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } catch (e) {
      console.error(e);
      alert('탈퇴 처리 중 문제가 발생했습니다.');
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
          <h3 className={styles.title}>정말 탈퇴하시겠습니까?</h3>
        </div>
        <div className={styles.content}>
          <p>탈퇴 시 회원님의 모든 컬렉션, 호칭, 위시리스트 및 프로필 정보가 영구적으로 삭제됩니다.</p>
          <div className={styles.warning}>
            이 작업은 되돌릴 수 없습니다. 삭제된 데이터는 복구할 수 없습니다.
          </div>
        </div>
        <div className={styles.actions}>
          <button 
            className={styles.btnCancel} 
            onClick={onClose}
            disabled={isDeleting}
          >
            취소
          </button>
          <button 
            className={styles.btnDelete} 
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? '처리 중...' : '탈퇴하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
