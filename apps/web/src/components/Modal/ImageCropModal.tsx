import React, { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import styles from './ImageCropModal.module.css';
import getCroppedImg from '../../utils/cropImage';
import { useLocale } from '@vinyla/i18n';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedFile: File, croppedUrl: string) => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { t } = useLocale();

  const handleCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    try {
      setIsProcessing(true);
      const croppedFile = await getCroppedImg(imageSrc, croppedAreaPixels!, 0);
      if (croppedFile) {
        const croppedUrl = URL.createObjectURL(croppedFile);
        onCropComplete(croppedFile, croppedUrl);
      }
    } catch (e) {
      console.error(e);
      alert(t('imageCrop.failed'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>{t('imageCrop.title')}</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className={styles.cropperContainer}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={handleCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className={styles.controls}>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => {
              setZoom(Number(e.target.value));
            }}
            className={styles.zoomSlider}
          />
        </div>

        <div className={styles.footer}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={isProcessing}>
            {t('common.cancel')}
          </button>
          <button className={styles.btnPrimary} onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? t('imageCrop.processing') : t('imageCrop.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
