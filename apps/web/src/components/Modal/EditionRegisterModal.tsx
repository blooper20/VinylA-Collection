import React from 'react';
import { useLocale } from '@vinyla/i18n';
import {
  DISC_KINDS,
  EDITION_TAGS,
  EDITION_TAG_TEXT_MAX,
  EDITION_COLOR_SWATCHES,
  EDITION_DEFAULT_ALT_COLOR,
  EditionStyle,
  EditionTagKey,
  StickerStyle,
  STICKER_STYLES,
  SplatterForm,
  SPLATTER_FORMS,
  isValidEditionColor,
  styleUsesAltColor,
} from '@vinyla/core-api';
import { EditionCoverArt } from '../Edition/EditionCoverArt';
import styles from './EditionRegisterModal.module.css';

export interface EditionDraft {
  label: string;
  price: number;
  purchaseDate: string;
  color: string | null;
  /** 스플래터의 튄 색 / 마블의 섞인 색. null이면 스플래터는 "여러 색" */
  altColor: string | null;
  style: EditionStyle | null;
  splatterForm: SplatterForm | null;
  tag: EditionTagKey | null;
  tagText: string | null;
  stickerStyle: StickerStyle | null;
  onCover: boolean;
}

/** 수정 모드에서 기존 값을 채워 넣기 위한 초기값 */
export interface EditionInitial {
  label: string;
  color: string | null;
  altColor: string | null;
  style: EditionStyle | null;
  splatterForm: SplatterForm | null;
  tag: EditionTagKey | null;
  tagText: string | null;
  stickerStyle: StickerStyle | null;
  onCover: boolean;
}

interface EditionRegisterModalProps {
  onCancel: () => void;
  onConfirm: (draft: EditionDraft) => void;
  isBusy: boolean;
  /** 미리보기에 쓰는 현재 앨범 커버 */
  coverUrl?: string | null;
  /** 'create' = 새 항목으로 또 등록, 'edit' = 이미 있는 항목의 에디션 정보 수정 */
  mode?: 'create' | 'edit';
  /** mode='edit'일 때 기존 값 */
  initial?: EditionInitial;
  t: ReturnType<typeof useLocale>['t'];
}

// "또 등록" / "에디션 수정" 모달.
//
// 입력이 두 카테고리로 나뉜다 — 서로 독립이라 둘 다 고를 수 있다:
//   ① LP 종류     : 디스크 자체가 어떻게 생겼는지(컬러/투명/스플래터/마블/픽처)
//                   → 커버에 미니 레코드 칩, 상세·호버에서는 실제 디스크가 그 색
//   ② 에디션 구분 : 한정반/사인반처럼 재킷에 표시가 있는 것 → 하이프 스티커
// "한정반이면서 스플래터반"인 실물이 흔하므로 둘을 배타로 두지 않는다.
// 무엇이 어떻게 보일지는 상단 미리보기에서 저장 전에 그대로 확인된다.
export const EditionRegisterModal: React.FC<EditionRegisterModalProps> = ({
  onCancel,
  onConfirm,
  isBusy,
  coverUrl,
  mode = 'create',
  initial,
  t,
}) => {
  const isEdit = mode === 'edit';
  const [label, setLabel] = React.useState(initial?.label ?? '');
  const [color, setColor] = React.useState<string | null>(initial?.color ?? null);
  const [altColor, setAltColor] = React.useState<string | null>(initial?.altColor ?? null);
  const [style, setStyle] = React.useState<EditionStyle | null>(initial?.style ?? null);
  const [splatterForm, setSplatterForm] = React.useState<SplatterForm>(initial?.splatterForm ?? 'streak');
  const [tag, setTag] = React.useState<EditionTagKey | null>(initial?.tag ?? null);
  const [tagText, setTagText] = React.useState(initial?.tagText ?? '');
  const [stickerStyle, setStickerStyle] = React.useState<StickerStyle>(initial?.stickerStyle ?? 'foil');
  const [priceInput, setPriceInput] = React.useState('');
  const [purchaseDateInput, setPurchaseDateInput] = React.useState(() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });
  const [onCover, setOnCover] = React.useState(initial?.onCover ?? true);
  // 라벨은 두 카테고리 선택에서 자동으로 만들어주되, 유저가 한 번 직접 고치면
  // 그 뒤로는 건드리지 않는다.
  const [labelDirty, setLabelDirty] = React.useState(!!initial?.label);

  const discKindKey = DISC_KINDS.find((k) => k.style === style)?.key ?? null;

  // 라벨은 "에디션 구분"만 담는다 — 컬러반/스플래터반 같은 LP 종류는 돌아가는
  // 디스크를 보면 바로 알 수 있어서 굳이 글자로 적지 않는다.
  const composeLabel = (nextTag: EditionTagKey | null, nextTagText = tagText) =>
    !nextTag ? '' : nextTag === 'custom' ? nextTagText.trim() : t(`detail.editionPresets.${nextTag}` as any);

  const handleDiscKindClick = (key: string) => {
    const kind = DISC_KINDS.find((k) => k.key === key);
    // 같은 걸 다시 누르면 해제 — LP 종류 없이 에디션 구분만 지정할 수도 있어야 한다
    const nextStyle = discKindKey === key ? null : kind?.style ?? null;
    setStyle(nextStyle);
    if (nextStyle) {
      setColor(kind?.defaultColor ?? null);
      setAltColor(kind?.defaultAltColor ?? null);
    } else {
      setColor(null);
      setAltColor(null);
    }
    if (!labelDirty) setLabel(composeLabel(tag));
  };

  const handleTagClick = (key: EditionTagKey) => {
    const nextTag = tag === key ? null : key;
    setTag(nextTag);
    if (!labelDirty) setLabel(composeLabel(nextTag));
  };

  const handleTagTextChange = (value: string) => {
    const next = value.slice(0, EDITION_TAG_TEXT_MAX);
    setTagText(next);
    if (!labelDirty) setLabel(composeLabel('custom', next));
  };

  const handleLabelChange = (value: string) => {
    setLabel(value);
    setLabelDirty(true);
  };

  const handleColorChange = (next: string | null) => {
    setColor(next);
    // 바탕색을 지우면 무늬(투명/스플래터/마블)도 의미가 없어진다. 픽처 디스크는
    // 색이 아니라 재킷 이미지를 쓰는 표현이라 예외로 유지.
    if (!next && style !== 'pictureDisc') {
      setStyle(null);
      setAltColor(null);
    }
  };

  const showAltColor = styleUsesAltColor(style) && !!color;

  const effectiveTag = tag === 'custom' && !tagText.trim() ? null : tag;
  const hasAnything = !!label.trim() || !!effectiveTag || !!style;

  const handleConfirm = () => {
    const trimmed = label.trim();
    if (isBusy) return;
    // 등록은 최소한 하나는 골라야 한다. 수정은 전부 해제해서 표시를 없앨 수 있다.
    if (!hasAnything && !isEdit) return;
    onConfirm({
      label: trimmed,
      price: Number(priceInput.replace(/[^0-9]/g, '')) || 0,
      purchaseDate: purchaseDateInput,
      color: isValidEditionColor(color) ? color : null,
      altColor: showAltColor && isValidEditionColor(altColor) ? altColor : null,
      style,
      splatterForm: style === 'splatter' ? splatterForm : null,
      tag: effectiveTag,
      tagText: tag === 'custom' ? tagText.trim() : null,
      stickerStyle: effectiveTag ? stickerStyle : null,
      onCover,
    });
  };

  const previewAlbum = {
    EDITION_LABEL: label.trim() || null,
    EDITION_COLOR: color,
    EDITION_COLOR_ALT: showAltColor ? altColor : null,
    EDITION_STYLE: style,
    EDITION_SPLATTER_FORM: splatterForm,
    EDITION_TAG: effectiveTag,
    EDITION_TAG_TEXT: tagText.trim() || null,
    EDITION_STICKER_STYLE: stickerStyle,
    EDITION_ON_COVER: onCover,
  };
  const hasDisc = !!color || style === 'pictureDisc';

  // 미리보기 옆 설명 — 디스크와 스티커가 동시에 나올 수 있으므로 둘 다 안내한다
  const previewNote = [
    hasDisc ? t('detail.editionOnCoverHintDisc') : null,
    effectiveTag ? t('detail.editionOnCoverHintSticker') : null,
  ].filter(Boolean) as string[];

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <span className="material-symbols-outlined">library_add</span>
          </div>
          <div>
            <h3 className={styles.title}>
              {isEdit ? t('detail.editEditionTitle') : t('detail.registerAnotherEdition')}
            </h3>
            <p className={styles.hint}>
              {isEdit ? t('detail.editEditionHint') : t('detail.editionRegisterHint')}
            </p>
          </div>
        </div>

        <div className={styles.previewRow}>
          <div className={styles.previewStage}>
            {coverUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={coverUrl} alt="" className={styles.previewCover} />
            )}
            <EditionCoverArt album={previewAlbum} size="md" />
          </div>
          <div className={styles.previewMeta}>
            <div className={styles.previewCaption}>{t('detail.editionPreviewLabel')}</div>
            {onCover && previewNote.length > 0 ? (
              previewNote.map((note) => (
                <div key={note} className={styles.previewNote}>
                  {note}
                </div>
              ))
            ) : (
              <div className={styles.previewOff}>
                {onCover ? t('detail.editionPickSomething') : `${t('detail.editionOnCoverToggle')} — OFF`}
              </div>
            )}
          </div>
        </div>

        {/* ① LP 종류 — 디스크 자체가 어떻게 생겼는지 */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t('detail.editionDiscKindFieldLabel')}</label>
          <div className={styles.presetRow}>
            {DISC_KINDS.map((kind) => (
              <button
                type="button"
                key={kind.key}
                className={`${styles.presetChip} ${discKindKey === kind.key ? styles.presetChipActive : ''}`}
                onClick={() => handleDiscKindClick(kind.key)}
                disabled={isBusy}
              >
                {kind.defaultColor && (
                  <span className={styles.presetDot} style={{ background: kind.defaultColor }} />
                )}
                {t(`detail.editionPresets.${kind.key}` as any)}
              </button>
            ))}
          </div>
        </div>

        {/* ② 에디션 구분 — 재킷에 표시가 있는 것 (LP 종류와 동시에 지정 가능) */}
        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t('detail.editionTagFieldLabel')}</label>
          <div className={styles.presetRow}>
            {EDITION_TAGS.map((key) => (
              <button
                type="button"
                key={key}
                className={`${styles.presetChip} ${tag === key ? styles.presetChipActive : ''}`}
                onClick={() => handleTagClick(key)}
                disabled={isBusy}
              >
                {t(`detail.editionPresets.${key}` as any)}
              </button>
            ))}
            <button
              type="button"
              className={`${styles.presetChip} ${tag === 'custom' ? styles.presetChipActive : ''}`}
              onClick={() => handleTagClick('custom')}
              disabled={isBusy}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
              {t('detail.editionTagCustom')}
            </button>
          </div>
          {/* 직접 입력을 골랐을 때만 입력칸 — 스티커에 그대로 들어가므로 짧게 제한 */}
          {tag === 'custom' && (
            <>
              <input
                type="text"
                value={tagText}
                onChange={(e) => handleTagTextChange(e.target.value)}
                placeholder={t('detail.editionTagTextPlaceholder')}
                className={styles.textInput}
                maxLength={EDITION_TAG_TEXT_MAX}
                disabled={isBusy}
                autoFocus
              />
              <p className={styles.swatchHint}>
                {t('detail.editionTagTextCounter', { current: tagText.length, max: EDITION_TAG_TEXT_MAX })}
              </p>
            </>
          )}
        </div>

        {/* 에디션 구분을 골랐을 때만 표시 모양 선택 */}
        {effectiveTag && (
          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('detail.editionStickerStyleFieldLabel')}</label>
            <div className={styles.presetRow}>
              {STICKER_STYLES.map((sk) => (
                <button
                  type="button"
                  key={sk}
                  className={`${styles.presetChip} ${stickerStyle === sk ? styles.presetChipActive : ''}`}
                  onClick={() => setStickerStyle(sk)}
                  disabled={isBusy}
                >
                  {t(`detail.editionStickerStyles.${sk}` as any)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* LP 종류를 골랐을 때만 색·무늬 세부 설정 */}
        {style && (
          <div className={styles.field}>
            <label className={styles.fieldLabel}>
              {showAltColor ? t('detail.editionColorBaseFieldLabel') : t('detail.editionColorFieldLabel')}
            </label>
            <div className={styles.swatchRow}>
              <button
                type="button"
                className={`${styles.swatchNone} ${color === null ? styles.swatchNoneActive : ''}`}
                onClick={() => handleColorChange(null)}
                disabled={isBusy}
              >
                {t('detail.editionColorNone')}
              </button>
              {EDITION_COLOR_SWATCHES.map((swatch) => (
                <button
                  type="button"
                  key={swatch}
                  aria-label={swatch}
                  className={`${styles.swatch} ${color === swatch ? styles.swatchActive : ''}`}
                  style={{ background: swatch }}
                  onClick={() => handleColorChange(swatch)}
                  disabled={isBusy}
                />
              ))}
            </div>
          </div>
        )}

        {/* 튄 물감의 형태 — 실물마다 확연히 다르다 */}
        {style === 'splatter' && (
          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('detail.editionSplatterFormFieldLabel')}</label>
            <div className={styles.presetRow}>
              {SPLATTER_FORMS.map((form) => (
                <button
                  type="button"
                  key={form}
                  className={`${styles.presetChip} ${splatterForm === form ? styles.presetChipActive : ''}`}
                  onClick={() => setSplatterForm(form)}
                  disabled={isBusy}
                >
                  {t(`detail.editionSplatterForms.${form}` as any)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 스플래터의 튄 색 / 마블의 섞인 색. 스플래터는 "여러 색"이 기본 */}
        {showAltColor && (
          <div className={styles.field}>
            <label className={styles.fieldLabel}>
              {style === 'marbled'
                ? t('detail.editionColorAltFieldLabelMarbled')
                : t('detail.editionColorAltFieldLabel')}
            </label>
            <div className={styles.swatchRow}>
              {style === 'splatter' && (
                <button
                  type="button"
                  className={`${styles.swatchNone} ${altColor === null ? styles.swatchNoneActive : ''}`}
                  onClick={() => setAltColor(null)}
                  disabled={isBusy}
                >
                  {t('detail.editionColorMulti')}
                </button>
              )}
              {EDITION_COLOR_SWATCHES.map((swatch) => {
                const active =
                  style === 'splatter'
                    ? altColor === swatch
                    : (altColor ?? EDITION_DEFAULT_ALT_COLOR) === swatch;
                return (
                  <button
                    type="button"
                    key={swatch}
                    aria-label={swatch}
                    className={`${styles.swatch} ${active ? styles.swatchActive : ''}`}
                    style={{ background: swatch }}
                    onClick={() => setAltColor(swatch)}
                    disabled={isBusy}
                  />
                );
              })}
            </div>
            {style === 'splatter' && altColor === null && (
              <p className={styles.swatchHint}>{t('detail.editionColorMultiHint')}</p>
            )}
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t('detail.editionLabelFieldLabel')}</label>
          <input
            type="text"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder={t('detail.editionLabelPlaceholder')}
            className={styles.textInput}
            disabled={isBusy}
          />
        </div>

        {!isEdit && (
          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('detail.editionPriceFieldLabel')}</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={t('detail.pricePlaceholder')}
              className={styles.textInput}
              disabled={isBusy}
            />
          </div>
        )}

        {!isEdit && (
          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t('detail.purchaseDateFieldLabel')}</label>
            <input
              type="date"
              value={purchaseDateInput}
              onChange={(e) => setPurchaseDateInput(e.target.value)}
              className={styles.textInput}
              disabled={isBusy}
            />
          </div>
        )}
        {isEdit && <p className={styles.swatchHint} style={{ marginBottom: 14 }}>{t('detail.editionRemoveHint')}</p>}

        <div
          className={`${styles.toggleRow} ${onCover ? styles.toggleRowOn : ''}`}
          onClick={() => !isBusy && setOnCover((v) => !v)}
        >
          <div className={styles.toggleTextWrap}>
            <div className={styles.toggleTitle}>{t('detail.editionOnCoverToggle')}</div>
            <div className={styles.toggleHint}>
              {previewNote.length > 0 ? previewNote.join(' · ') : t('detail.editionPickSomething')}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={onCover}
            aria-label={t('detail.editionOnCoverToggle')}
            className={`${styles.switch} ${onCover ? styles.switchOn : ''}`}
            disabled={isBusy}
          >
            <span className={styles.switchKnob} />
          </button>
        </div>

        <div className={styles.actions}>
          <button className={styles.btnCancel} onClick={onCancel} disabled={isBusy}>
            {t('common.cancel')}
          </button>
          <button
            className={styles.btnSave}
            onClick={handleConfirm}
            disabled={isBusy || (!isEdit && !hasAnything)}
          >
            {isBusy ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
