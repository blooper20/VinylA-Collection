import React, { useEffect, useState } from 'react';
import styles from './ShareBottomSheet.module.css';

export interface ShareOption {
  id: string;
  label: string;
  icon: string;
  action: () => void;
}

interface ShareBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  options: ShareOption[];
  title?: string;
  children?: React.ReactNode;
}

export const ShareBottomSheet: React.FC<ShareBottomSheetProps> = ({ isOpen, onClose, options, title = '공유하기', children }) => {
  const [render, setRender] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // 마운트 후 CSS 트랜지션을 위한 2단계 렌더링 패턴이라 effect 내 동기 setState가 불가피함
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRender(true);
      // Small delay to allow CSS transition to apply
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setShow(true));
      });
      
      // ✨ Motion Master: 햅틱 진동 (가볍게 튕기는 느낌)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(5);
      }
    } else {
      setShow(false);
      const timer = setTimeout(() => setRender(false), 400); // Matches CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!render) return null;

  return (
    <div
      className={`${styles.overlay} ${show ? styles.overlayShow : ''}`}
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div 
        className={`${styles.sheet} ${show ? styles.sheetShow : ''}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.handleBar} />
        <h3 className={styles.title}>{title}</h3>
        
        {children}
        
        <div className={styles.optionsList}>
          {options.map((option) => (
            <button 
              key={option.id}
              className={styles.optionButton}
              onClick={() => {
                option.action();
                onClose();
              }}
            >
              <div className={styles.iconWrapper}>
                <span className="material-symbols-outlined">{option.icon}</span>
              </div>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
