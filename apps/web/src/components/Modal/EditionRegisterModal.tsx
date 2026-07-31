import React from 'react';
import styles from './DetailModal.module.css';
import { useLocale } from '@vinyla/i18n';

const EDITION_PRESET_KEYS = [
  'colored', 'clear', 'splatter', 'marbled', 'pictureDisc', 'limited',
  'reissue', 'originalPressing', 'deluxeBoxSet', 'signed', 'import',
  'domestic', 'heavyweight180g',
] as const;

interface EditionRegisterModalProps {
  onCancel: () => void;
  onConfirm: (editionLabel: string, price: number) => void;
  isBusy: boolean;
  t: ReturnType<typeof useLocale>['t'];
}

// "또 등록" 모달 — 이미 소장/위시에 있는 앨범을 초반/재반/컬러반처럼 별도
// 항목으로 새로 등록할 때 에디션 라벨(프리셋 칩 + 자유 입력)과 구매가를
// 입력받는다. CoverCropModal/SpinLogModal과 같은 cropOverlay/cropModal
// 셸을 재사용한다.
export const EditionRegisterModal: React.FC<EditionRegisterModalProps> = ({ onCancel, onConfirm, isBusy, t }) => {
  const [selectedPreset, setSelectedPreset] = React.useState<string | null>(null);
  const [label, setLabel] = React.useState('');
  const [priceInput, setPriceInput] = React.useState('');

  const handlePresetClick = (key: string) => {
    const presetLabel = t(`detail.editionPresets.${key}` as any);
    setSelectedPreset(key);
    setLabel(presetLabel);
  };

  const handleLabelChange = (value: string) => {
    setLabel(value);
    setSelectedPreset(null);
  };

  const handleConfirm = () => {
    const trimmed = label.trim();
    if (!trimmed || isBusy) return;
    onConfirm(trimmed, Number(priceInput.replace(/[^0-9]/g, '')) || 0);
  };

  return (
    <div className={styles.cropOverlay} onClick={onCancel}>
      <div className={styles.cropModal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.cropTitle}>{t('detail.registerAnotherEdition')}</h3>
        <p className={styles.cropHint}>{t('detail.editionRegisterHint')}</p>

        <div className={styles.editionPresetRow}>
          {EDITION_PRESET_KEYS.map((key) => (
            <button
              type="button"
              key={key}
              className={`${styles.editionPresetChip} ${selectedPreset === key ? styles.editionPresetChipActive : ''}`}
              onClick={() => handlePresetClick(key)}
              disabled={isBusy}
            >
              {t(`detail.editionPresets.${key}` as any)}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder={t('detail.editionLabelPlaceholder')}
          className={styles.priceInput}
          disabled={isBusy}
        />

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={priceInput}
          onChange={(e) => setPriceInput(e.target.value.replace(/[^0-9]/g, ''))}
          placeholder={t('detail.pricePlaceholder')}
          className={styles.priceInput}
          disabled={isBusy}
        />

        <div className={styles.confirmActions}>
          <button className={styles.btnCancel} onClick={onCancel} disabled={isBusy}>
            {t('common.cancel')}
          </button>
          <button className={styles.btnDelete} onClick={handleConfirm} disabled={isBusy || !label.trim()}>
            {isBusy ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
