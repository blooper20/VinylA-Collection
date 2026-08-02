'use client';

import React from 'react';
import { useLocale } from '@vinyla/i18n';
import styles from './CommunityMediaPicker.module.css';

// 커뮤니티 게시글 사진 첨부 — 최대 5장, 이미지만(영상 없음). MediaAttachPicker와
// 달리 트리밍/단일첨부가 필요 없어 훨씬 단순한 전용 컴포넌트로 새로 만들었다.
export type CommunityMediaSlot =
  | { kind: 'existing'; url: string }
  | { kind: 'new'; file: File; previewUrl: string };

const MAX_ITEMS = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const CommunityMediaPicker: React.FC<{
  value: CommunityMediaSlot[];
  onChange: (next: CommunityMediaSlot[]) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const { t } = useLocale();
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const valueRef = React.useRef(value);
  valueRef.current = value;
  React.useEffect(() => {
    return () => {
      for (const v of valueRef.current) {
        if (v.kind === 'new') URL.revokeObjectURL(v.previewUrl);
      }
    };
  }, []);

  const handlePick = (file: File | null) => {
    if (!file) return;
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    if (value.length >= MAX_ITEMS) {
      setError(t('communityBoard.photoLimit'));
      return;
    }
    if (!IMAGE_TYPES.includes(file.type)) {
      setError(t('communityBoard.photoLimit'));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t('communityBoard.photoLimit'));
      return;
    }
    onChange([...value, { kind: 'new', file, previewUrl: URL.createObjectURL(file) }]);
  };

  const handleRemove = (index: number) => {
    const target = value[index];
    if (target.kind === 'new') URL.revokeObjectURL(target.previewUrl);
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handlePick(e.target.files?.[0] || null)}
      />
      <div className={styles.grid}>
        {value.map((v, i) => (
          <div key={i} className={styles.thumb}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.kind === 'existing' ? v.url : v.previewUrl} alt="" className={styles.thumbImg} />
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => handleRemove(i)}
              disabled={disabled}
              aria-label="remove"
            >
              ×
            </button>
          </div>
        ))}
        {value.length < MAX_ITEMS && (
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_a_photo</span>
          </button>
        )}
      </div>
      <p className={styles.hint}>{t('communityBoard.photoLimit')}</p>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
};
