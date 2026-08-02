'use client';

import React from 'react';
import { useLocale } from '@vinyla/i18n';
import styles from './CommunityMediaPicker.module.css';

// 커뮤니티 게시글 사진/영상 첨부 — 최대 5개. MediaAttachPicker와 달리
// 트리밍/단일첨부가 필요 없어 훨씬 단순한 전용 컴포넌트로 새로 만들었다.
export type CommunityMediaSlot =
  | { kind: 'existing'; url: string; type: 'image' | 'video' }
  | { kind: 'new'; file: File; previewUrl: string; type: 'image' | 'video' };

const MAX_ITEMS = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50MB
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
// mp4/mov만 허용 — webm은 iOS 앱(AVPlayer)이 재생하지 못한다.
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

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
    const isImage = IMAGE_TYPES.includes(file.type);
    const isVideo = VIDEO_TYPES.includes(file.type);
    if (!isImage && !isVideo) {
      setError(t('communityBoard.photoLimit'));
      return;
    }
    if (file.size > (isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES)) {
      setError(t('communityBoard.photoLimit'));
      return;
    }
    onChange([...value, { kind: 'new', file, previewUrl: URL.createObjectURL(file), type: isImage ? 'image' : 'video' }]);
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
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
        hidden
        onChange={(e) => handlePick(e.target.files?.[0] || null)}
      />
      <div className={styles.grid}>
        {value.map((v, i) => {
          const url = v.kind === 'existing' ? v.url : v.previewUrl;
          return (
          <div key={i} className={styles.thumb}>
            {v.type === 'video' ? (
              <video className={styles.thumbImg} src={url} muted />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={url} alt="" className={styles.thumbImg} />
            )}
            {v.type === 'video' && <span className={styles.videoBadge}>VIDEO</span>}
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
          );
        })}
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
