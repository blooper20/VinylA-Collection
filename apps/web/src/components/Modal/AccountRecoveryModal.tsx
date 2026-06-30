import React, { useState } from 'react';
import styles from './AccountRecoveryModal.module.css';
import { useAuthStore } from '@vinyla/core-api';

export default function AccountRecoveryModal() {
  const { isRecoveryPending, recoverAccount, resetAccount } = useAuthStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isRecoveryPending) return null;

  const handleRecover = async () => {
    setIsProcessing(true);
    try {
      await recoverAccount();
    } catch (error) {
      console.error(error);
      alert('계정 복구 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHardReset = async () => {
    setIsProcessing(true);
    try {
      await resetAccount();
    } catch (error) {
      console.error(error);
      alert('데이터 초기화 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {step === 1 ? (
          <>
            <div className={styles.header}>
              <div className={styles.iconWrapper}>
                <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>history</span>
              </div>
              <h3 className={styles.title}>환영합니다!</h3>
            </div>
            <div className={styles.content}>
              <p>회원님은 이전에 탈퇴한 기록이 있습니다.<br/>기존의 소중한 컬렉션과 호칭 데이터를 복구하시겠습니까?</p>
            </div>
            <div className={styles.actions}>
              <button 
                className={styles.btnPrimary} 
                onClick={handleRecover}
                disabled={isProcessing}
              >
                {isProcessing ? '처리 중...' : '네, 기존 데이터 복구하기'}
              </button>
              <button 
                className={styles.btnSecondary} 
                onClick={() => setStep(2)}
                disabled={isProcessing}
              >
                아니오, 아예 새로 시작할래요
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.header}>
              <div className={`${styles.iconWrapper} ${styles.danger}`}>
                <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>warning</span>
              </div>
              <h3 className={styles.title}>경고: 기존 데이터 완전 삭제</h3>
            </div>
            <div className={styles.content}>
              <p>새로 시작하기를 선택하시면 기존에 모아둔 <strong>모든 LP 기록과 위시리스트, 호칭이 영구적으로 삭제</strong>됩니다.</p>
              <div className={styles.warningBox}>
                삭제된 데이터는 어떠한 경우에도 다시 복구할 수 없습니다. 정말 모든 기록을 지우고 처음부터 다시 시작하시겠습니까?
              </div>
            </div>
            <div className={styles.actions}>
              <button 
                className={styles.btnDanger} 
                onClick={handleHardReset}
                disabled={isProcessing}
              >
                {isProcessing ? '삭제 및 초기화 중...' : '네, 모두 지우고 새로 시작합니다'}
              </button>
              <button 
                className={styles.btnSecondary} 
                onClick={() => setStep(1)}
                disabled={isProcessing}
              >
                뒤로 가기
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
