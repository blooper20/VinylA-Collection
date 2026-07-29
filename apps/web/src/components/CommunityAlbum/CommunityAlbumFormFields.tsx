import React, { useRef, useState } from 'react';
import { useLocale } from '@vinyla/i18n';
import { CoverCropModal } from '../Modal/CoverCropModal';
import styles from '../../app/community-albums/new/page.module.css';

export type FormSide = { heading: string; tracks: string[] };

// 커뮤니티 앨범 등록(/community-albums/new)과 수정(/community-albums/[id]/edit)
// 화면이 공유하는 입력 폼 — 커버·제목·아티스트·연도·트랙리스트 에디터. 두
// 화면의 차이(애플뮤직 검색 단계 유무, 등록 vs 수정 API 호출)는 각 페이지가
// 처리하고, 이 컴포넌트는 순수하게 입력 상태를 그대로 위로 올려보낸다.
export function CommunityAlbumFormFields({
  imageUrl,
  onImageUrlChange,
  title,
  onTitleChange,
  artist,
  onArtistChange,
  releaseYear,
  onReleaseYearChange,
  sides,
  onSidesChange,
  isUploadingCover,
  onUploadCover,
  isSubmitting,
  submitLabel,
  submittingLabel,
  onSubmit,
  confirmBeforeSubmit,
}: {
  imageUrl: string | null;
  onImageUrlChange: (url: string) => void;
  title: string;
  onTitleChange: (v: string) => void;
  artist: string;
  onArtistChange: (v: string) => void;
  releaseYear: string;
  onReleaseYearChange: (v: string) => void;
  sides: FormSide[];
  onSidesChange: (sides: FormSide[]) => void;
  isUploadingCover: boolean;
  onUploadCover: (square: Blob) => Promise<string | null>;
  isSubmitting: boolean;
  submitLabel: string;
  submittingLabel: string;
  onSubmit: () => void;
  // 최초 등록에만 켠다 — 한 번 등록하면 삭제할 방법이 없다는 걸 저장 시점에
  // 미리 알려서 "가볍게 테스트해본" 데이터가 영구히 남는 걸 막는다. 수정
  // 화면에서는 이미 존재를 아는 데이터라 매번 재경고하지 않는다.
  confirmBeforeSubmit?: boolean;
}) {
  const { t } = useLocale();
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [invalidFileToast, setInvalidFileToast] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);

  const handleSubmitClick = () => {
    if (confirmBeforeSubmit && !showDeleteWarning) {
      setShowDeleteWarning(true);
      return;
    }
    onSubmit();
  };

  const addSide = () => {
    onSidesChange([...sides, { heading: `${String.fromCharCode(65 + sides.length)} Side`, tracks: [''] }]);
  };
  const removeSide = (sideIdx: number) => onSidesChange(sides.filter((_, i) => i !== sideIdx));
  const addTrack = (sideIdx: number) => {
    onSidesChange(sides.map((s, i) => (i === sideIdx ? { ...s, tracks: [...s.tracks, ''] } : s)));
  };
  const removeTrack = (sideIdx: number, trackIdx: number) => {
    onSidesChange(sides.map((s, i) => (i === sideIdx ? { ...s, tracks: s.tracks.filter((_, ti) => ti !== trackIdx) } : s)));
  };
  const setTrackTitle = (sideIdx: number, trackIdx: number, value: string) => {
    onSidesChange(
      sides.map((s, i) => (i === sideIdx ? { ...s, tracks: s.tracks.map((tr, ti) => (ti === trackIdx ? value : tr)) } : s))
    );
  };
  const setSideHeading = (sideIdx: number, value: string) => {
    onSidesChange(sides.map((s, i) => (i === sideIdx ? { ...s, heading: value } : s)));
  };

  const handleCoverSelect = (file: File | null) => {
    if (!file || isUploadingCover) return;
    if (!file.type.startsWith('image/')) {
      setInvalidFileToast(true);
      setTimeout(() => setInvalidFileToast(false), 3500);
      return;
    }
    setCropFile(file);
    if (coverFileRef.current) coverFileRef.current.value = '';
  };

  const handleCropConfirm = async (square: Blob) => {
    const url = await onUploadCover(square);
    if (url) {
      onImageUrlChange(url);
      setCropFile(null);
    }
  };

  return (
    <section className={styles.formSection}>
      <label className={styles.fieldLabel}>{t('community.coverLabel')}</label>
      <div className={styles.coverRow}>
        {imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imageUrl} alt="" className={styles.coverPreview} />
        )}
        <input
          ref={coverFileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleCoverSelect(e.target.files?.[0] || null)}
        />
        <button
          type="button"
          className={styles.coverUploadBtn}
          disabled={isUploadingCover}
          onClick={() => coverFileRef.current?.click()}
        >
          {isUploadingCover ? t('detail.coverPhotoUploading') : t('community.coverUploadCta')}
        </button>
      </div>

      <label className={styles.fieldLabel}>{t('community.titleLabel')}</label>
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={t('community.titlePlaceholder')}
        className={styles.textInput}
      />

      <label className={styles.fieldLabel}>{t('community.artistLabel')}</label>
      <input
        type="text"
        value={artist}
        onChange={(e) => onArtistChange(e.target.value)}
        placeholder={t('community.artistPlaceholder')}
        className={styles.textInput}
      />

      <label className={styles.fieldLabel}>{t('community.yearLabel')}</label>
      <input
        type="number"
        value={releaseYear}
        onChange={(e) => onReleaseYearChange(e.target.value)}
        placeholder={t('community.yearPlaceholder')}
        className={styles.textInput}
      />

      <label className={styles.fieldLabel}>{t('community.tracklistLabel')}</label>
      {sides.map((side, sideIdx) => (
        <div key={sideIdx} className={styles.sideBlock}>
          <div className={styles.sideHeaderRow}>
            <input
              type="text"
              value={side.heading}
              onChange={(e) => setSideHeading(sideIdx, e.target.value)}
              className={styles.sideHeadingInput}
            />
            {sides.length > 1 && (
              <button type="button" className={styles.iconBtnDanger} onClick={() => removeSide(sideIdx)}>
                <span className="material-symbols-outlined">delete</span>
              </button>
            )}
          </div>
          {side.tracks.map((tr, trackIdx) => (
            <div key={trackIdx} className={styles.trackRow}>
              <input
                type="text"
                value={tr}
                onChange={(e) => setTrackTitle(sideIdx, trackIdx, e.target.value)}
                placeholder={t('detail.customPressingTrackPlaceholder', { n: trackIdx + 1 })}
                className={styles.trackInput}
              />
              {side.tracks.length > 1 && (
                <button type="button" className={styles.iconBtnDanger} onClick={() => removeTrack(sideIdx, trackIdx)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => addTrack(sideIdx)} className={styles.addLink}>
            + {t('community.addTrack')}
          </button>
        </div>
      ))}
      <button type="button" onClick={addSide} className={styles.addLink} style={{ marginBottom: 24 }}>
        + {t('community.addSide')}
      </button>

      {showDeleteWarning && (
        <div className={styles.deleteWarning}>
          <strong>{t('community.deleteWarningTitle')}</strong>
          <p>{t('community.deleteWarningMessage')}</p>
        </div>
      )}

      <button type="button" className={styles.submitBtn} disabled={isSubmitting} onClick={handleSubmitClick}>
        {isSubmitting
          ? submittingLabel
          : showDeleteWarning
            ? t('community.deleteWarningConfirm')
            : submitLabel}
      </button>

      {cropFile && (
        <CoverCropModal
          file={cropFile}
          isBusy={isUploadingCover}
          onCancel={() => !isUploadingCover && setCropFile(null)}
          onConfirm={handleCropConfirm}
          t={t}
        />
      )}
      {invalidFileToast && <div className={styles.toast}>{t('detail.coverPhotoInvalid')}</div>}
    </section>
  );
}
