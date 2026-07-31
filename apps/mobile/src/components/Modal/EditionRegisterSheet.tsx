import React from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Image, Switch } from 'react-native';
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

export interface EditionDraft {
  label: string;
  price: number;
  /** 스플래터의 튄 색 / 마블의 섞인 색. null이면 스플래터는 "여러 색" */
  color: string | null;
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

interface EditionRegisterSheetProps {
  visible: boolean;
  isBusy: boolean;
  onCancel: () => void;
  onConfirm: (draft: EditionDraft) => void;
  /** 미리보기에 쓰는 현재 앨범 커버 */
  coverUrl?: string | null;
  /** 'create' = 새 항목으로 또 등록, 'edit' = 이미 있는 항목의 에디션 정보 수정 */
  mode?: 'create' | 'edit';
  /** mode='edit'일 때 기존 값 */
  initial?: EditionInitial;
}

const PREVIEW_SIZE = 104;

const chipStyle = (active: boolean) => ({
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 5,
  borderWidth: 1,
  borderRadius: 999,
  paddingHorizontal: 11,
  paddingVertical: 6,
  borderColor: active ? '#e6b93c' : 'rgba(255,255,255,0.13)',
  backgroundColor: active ? 'rgba(230,185,60,0.14)' : 'transparent',
});

const fieldLabelStyle = {
  color: 'rgba(255,255,255,0.6)',
  fontSize: 12,
  fontWeight: '600' as const,
  marginTop: 18,
  marginBottom: 8,
};

const inputStyle = {
  paddingHorizontal: 13,
  paddingVertical: 11,
  borderRadius: 9,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.13)',
  backgroundColor: 'rgba(255,255,255,0.04)',
  color: '#fff',
  fontSize: 14,
};

// "또 등록" / "에디션 수정" 시트 — 웹 EditionRegisterModal과 동일한 규칙.
// 입력이 두 카테고리(LP 종류 / 에디션 구분)로 나뉘고 서로 독립이라 둘 다 고를
// 수 있다("한정반이면서 스플래터반"). 저장 전에 상단 미리보기로 확인된다.
export const EditionRegisterSheet = ({
  visible,
  isBusy,
  onCancel,
  onConfirm,
  coverUrl,
  mode = 'create',
  initial,
}: EditionRegisterSheetProps) => {
  const { t } = useLocale();
  const isEdit = mode === 'edit';
  const [label, setLabel] = React.useState('');
  const [color, setColor] = React.useState<string | null>(null);
  const [altColor, setAltColor] = React.useState<string | null>(null);
  const [style, setStyle] = React.useState<EditionStyle | null>(null);
  const [splatterForm, setSplatterForm] = React.useState<SplatterForm>('streak');
  const [tag, setTag] = React.useState<EditionTagKey | null>(null);
  const [tagText, setTagText] = React.useState('');
  const [stickerStyle, setStickerStyle] = React.useState<StickerStyle>('foil');
  const [priceInput, setPriceInput] = React.useState('');
  const [onCover, setOnCover] = React.useState(true);
  const [labelDirty, setLabelDirty] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      setLabel(initial?.label ?? '');
      setColor(initial?.color ?? null);
      setAltColor(initial?.altColor ?? null);
      setStyle(initial?.style ?? null);
      setSplatterForm(initial?.splatterForm ?? 'streak');
      setTag(initial?.tag ?? null);
      setTagText(initial?.tagText ?? '');
      setStickerStyle(initial?.stickerStyle ?? 'foil');
      setPriceInput('');
      setOnCover(initial?.onCover ?? true);
      setLabelDirty(!!initial?.label);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const discKindKey = DISC_KINDS.find((k) => k.style === style)?.key ?? null;

  // 라벨은 "에디션 구분"만 담는다 — LP 종류는 돌아가는 디스크로 알 수 있다(웹과 동일).
  const composeLabel = (nextTag: EditionTagKey | null, nextTagText = tagText) =>
    !nextTag ? '' : nextTag === 'custom' ? nextTagText.trim() : t(`detail.editionPresets.${nextTag}` as any);

  const handleDiscKindPress = (key: string) => {
    const kind = DISC_KINDS.find((k) => k.key === key);
    // 같은 걸 다시 누르면 해제
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

  const handleTagPress = (key: EditionTagKey) => {
    const nextTag = tag === key ? null : key;
    setTag(nextTag);
    if (!labelDirty) setLabel(composeLabel(nextTag));
  };

  const handleTagTextChange = (value: string) => {
    const next = value.slice(0, EDITION_TAG_TEXT_MAX);
    setTagText(next);
    if (!labelDirty) setLabel(composeLabel('custom', next));
  };

  const handleColorChange = (next: string | null) => {
    setColor(next);
    if (!next && style !== 'pictureDisc') {
      setStyle(null);
      setAltColor(null);
    }
  };

  const showAltColor = styleUsesAltColor(style) && !!color;
  const hasDisc = !!color || style === 'pictureDisc';

  const effectiveTag = tag === 'custom' && !tagText.trim() ? null : tag;
  const hasAnything = !!label.trim() || !!effectiveTag || !!style;

  const handleConfirm = () => {
    const trimmed = label.trim();
    if (isBusy) return;
    if (!hasAnything && !isEdit) return;
    onConfirm({
      label: trimmed,
      price: Number(priceInput.replace(/[^0-9]/g, '')) || 0,
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

  const previewNote = [
    hasDisc ? t('detail.editionOnCoverHintDisc') : null,
    effectiveTag ? t('detail.editionOnCoverHintSticker') : null,
  ].filter(Boolean) as string[];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: '#17191a', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', maxHeight: '90%' }}>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>
            {isEdit ? t('detail.editEditionTitle') : t('detail.registerAnotherEdition')}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
            {isEdit ? t('detail.editEditionHint') : t('detail.editionRegisterHint')}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* 미리보기 — 저장하면 커버가 어떻게 보이는지 그대로 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' }}>
              <View style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE, borderRadius: 4, overflow: 'hidden', backgroundColor: '#0e0e0e' }}>
                {coverUrl ? (
                  <Image source={{ uri: coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : null}
                <EditionCoverArt album={previewAlbum} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 }}>
                  {t('detail.editionPreviewLabel')}
                </Text>
                {onCover && previewNote.length > 0 ? (
                  previewNote.map((note) => (
                    <Text key={note} style={{ color: 'rgba(255,255,255,0.62)', fontSize: 12, lineHeight: 18 }}>
                      {note}
                    </Text>
                  ))
                ) : (
                  <Text style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, lineHeight: 18 }}>
                    {onCover ? t('detail.editionPickSomething') : `${t('detail.editionOnCoverToggle')} — OFF`}
                  </Text>
                )}
              </View>
            </View>

            {/* ① LP 종류 */}
            <Text style={fieldLabelStyle}>{t('detail.editionDiscKindFieldLabel')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {DISC_KINDS.map((kind) => {
                const active = discKindKey === kind.key;
                return (
                  <TouchableOpacity
                    key={kind.key}
                    onPress={() => handleDiscKindPress(kind.key)}
                    disabled={isBusy}
                    style={chipStyle(active)}
                  >
                    {kind.defaultColor ? (
                      <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: kind.defaultColor }} />
                    ) : null}
                    <Text style={{ color: active ? '#e6b93c' : 'rgba(255,255,255,0.82)', fontSize: 12.5 }}>
                      {t(`detail.editionPresets.${kind.key}` as any)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ② 에디션 구분 — LP 종류와 동시에 지정 가능 */}
            <Text style={fieldLabelStyle}>{t('detail.editionTagFieldLabel')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {EDITION_TAGS.map((key) => {
                const active = tag === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => handleTagPress(key)}
                    disabled={isBusy}
                    style={chipStyle(active)}
                  >
                    <Text style={{ color: active ? '#e6b93c' : 'rgba(255,255,255,0.82)', fontSize: 12.5 }}>
                      {t(`detail.editionPresets.${key}` as any)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={() => handleTagPress('custom')}
                disabled={isBusy}
                style={chipStyle(tag === 'custom')}
              >
                <Text style={{ color: tag === 'custom' ? '#e6b93c' : 'rgba(255,255,255,0.82)', fontSize: 12.5 }}>
                  {t('detail.editionTagCustom')}
                </Text>
              </TouchableOpacity>
            </View>
            {/* 직접 입력을 골랐을 때만 입력칸 — 스티커에 그대로 들어가므로 짧게 제한 */}
            {tag === 'custom' ? (
              <>
                <TextInput
                  value={tagText}
                  onChangeText={handleTagTextChange}
                  placeholder={t('detail.editionTagTextPlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  maxLength={EDITION_TAG_TEXT_MAX}
                  editable={!isBusy}
                  style={{ ...inputStyle, marginTop: 8 }}
                />
                <Text style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11.5, marginTop: 6 }}>
                  {t('detail.editionTagTextCounter', { current: tagText.length, max: EDITION_TAG_TEXT_MAX })}
                </Text>
              </>
            ) : null}

            {/* 에디션 구분을 골랐을 때만 표시 모양 선택 */}
            {effectiveTag ? (
              <>
                <Text style={fieldLabelStyle}>{t('detail.editionStickerStyleFieldLabel')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {STICKER_STYLES.map((sk) => {
                    const active = stickerStyle === sk;
                    return (
                      <TouchableOpacity key={sk} onPress={() => setStickerStyle(sk)} disabled={isBusy} style={chipStyle(active)}>
                        <Text style={{ color: active ? '#e6b93c' : 'rgba(255,255,255,0.82)', fontSize: 12.5 }}>
                          {t(`detail.editionStickerStyles.${sk}` as any)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            {/* LP 종류를 골랐을 때만 색·무늬 세부 설정 */}
            {style ? (
              <>
                <Text style={fieldLabelStyle}>
                  {showAltColor ? t('detail.editionColorBaseFieldLabel') : t('detail.editionColorFieldLabel')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={() => handleColorChange(null)}
                    disabled={isBusy}
                    style={{
                      height: 26,
                      paddingHorizontal: 11,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderStyle: color === null ? 'solid' : 'dashed',
                      borderColor: color === null ? '#e6b93c' : 'rgba(255,255,255,0.25)',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: color === null ? '#e6b93c' : 'rgba(255,255,255,0.55)', fontSize: 11.5 }}>
                      {t('detail.editionColorNone')}
                    </Text>
                  </TouchableOpacity>
                  {EDITION_COLOR_SWATCHES.map((swatch) => (
                    <TouchableOpacity
                      key={swatch}
                      onPress={() => handleColorChange(swatch)}
                      disabled={isBusy}
                      accessibilityLabel={swatch}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: swatch,
                        borderWidth: color === swatch ? 2 : 1,
                        borderColor: color === swatch ? '#e6b93c' : 'rgba(255,255,255,0.18)',
                      }}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {/* 튄 물감의 형태 */}
            {style === 'splatter' ? (
              <>
                <Text style={fieldLabelStyle}>{t('detail.editionSplatterFormFieldLabel')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {SPLATTER_FORMS.map((form) => {
                    const active = splatterForm === form;
                    return (
                      <TouchableOpacity
                        key={form}
                        onPress={() => setSplatterForm(form)}
                        disabled={isBusy}
                        style={chipStyle(active)}
                      >
                        <Text style={{ color: active ? '#e6b93c' : 'rgba(255,255,255,0.82)', fontSize: 12.5 }}>
                          {t(`detail.editionSplatterForms.${form}` as any)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            {/* 스플래터의 튄 색 / 마블의 섞인 색 */}
            {showAltColor ? (
              <>
                <Text style={fieldLabelStyle}>
                  {style === 'marbled'
                    ? t('detail.editionColorAltFieldLabelMarbled')
                    : t('detail.editionColorAltFieldLabel')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
                  {style === 'splatter' ? (
                    <TouchableOpacity
                      onPress={() => setAltColor(null)}
                      disabled={isBusy}
                      style={{
                        height: 26,
                        paddingHorizontal: 11,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderStyle: altColor === null ? 'solid' : 'dashed',
                        borderColor: altColor === null ? '#e6b93c' : 'rgba(255,255,255,0.25)',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: altColor === null ? '#e6b93c' : 'rgba(255,255,255,0.55)', fontSize: 11.5 }}>
                        {t('detail.editionColorMulti')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                  {EDITION_COLOR_SWATCHES.map((swatch) => {
                    const active =
                      style === 'splatter'
                        ? altColor === swatch
                        : (altColor ?? EDITION_DEFAULT_ALT_COLOR) === swatch;
                    return (
                      <TouchableOpacity
                        key={swatch}
                        onPress={() => setAltColor(swatch)}
                        disabled={isBusy}
                        accessibilityLabel={swatch}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 13,
                          backgroundColor: swatch,
                          borderWidth: active ? 2 : 1,
                          borderColor: active ? '#e6b93c' : 'rgba(255,255,255,0.18)',
                        }}
                      />
                    );
                  })}
                </View>
                {style === 'splatter' && altColor === null ? (
                  <Text style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11.5, marginTop: 9 }}>
                    {t('detail.editionColorMultiHint')}
                  </Text>
                ) : null}
              </>
            ) : null}

            <Text style={fieldLabelStyle}>{t('detail.editionLabelFieldLabel')}</Text>
            <TextInput
              value={label}
              onChangeText={(value) => {
                setLabel(value);
                setLabelDirty(true);
              }}
              placeholder={t('detail.editionLabelPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.3)"
              editable={!isBusy}
              style={inputStyle}
            />

            {!isEdit ? (
              <>
                <Text style={fieldLabelStyle}>{t('detail.editionPriceFieldLabel')}</Text>
                <TextInput
                  value={priceInput}
                  onChangeText={(value) => setPriceInput(value.replace(/[^0-9]/g, ''))}
                  placeholder={t('detail.pricePlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  keyboardType="numeric"
                  editable={!isBusy}
                  style={inputStyle}
                />
              </>
            ) : (
              <Text style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11.5, marginTop: 18 }}>
                {t('detail.editionRemoveHint')}
              </Text>
            )}

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                marginTop: 18,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: onCover ? 'rgba(233,195,73,0.06)' : 'rgba(255,255,255,0.03)',
                borderWidth: 1,
                borderColor: onCover ? 'rgba(233,195,73,0.35)' : 'rgba(255,255,255,0.07)',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '600' }}>{t('detail.editionOnCoverToggle')}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11.5, marginTop: 2 }}>
                  {previewNote.length > 0 ? previewNote.join(' · ') : t('detail.editionPickSomething')}
                </Text>
              </View>
              <Switch
                value={onCover}
                onValueChange={setOnCover}
                disabled={isBusy}
                trackColor={{ false: 'rgba(255,255,255,0.16)', true: '#e6b93c' }}
                thumbColor="#fff"
              />
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <TouchableOpacity
              onPress={onCancel}
              disabled={isBusy}
              style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center' }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500' }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={isBusy || (!isEdit && !hasAnything)}
              style={{
                flex: 1.4,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: '#e9c349',
                alignItems: 'center',
                opacity: isBusy || (!isEdit && !hasAnything) ? 0.45 : 1,
              }}
            >
              {isBusy ? (
                <ActivityIndicator color="#241a02" />
              ) : (
                <Text style={{ color: '#241a02', fontSize: 14, fontWeight: '700' }}>{t('common.save')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
