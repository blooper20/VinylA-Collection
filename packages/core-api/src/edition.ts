// 에디션 시각 표현 메타데이터 — 웹/모바일이 공유한다.
//
// 실물 컬렉션에서 "같은 앨범의 다른 버전"은 두 가지 방식으로 눈에 보인다:
//   1) 디스크 자체가 다르다 (컬러반/투명반/스플래터반/픽처 디스크)
//      → 재킷은 그대로고 슬리브에서 빼면 색이 다르다.
//   2) 재킷에 스티커가 붙어 있다 (한정반/사인반/수입반의 하이프 스티커, 오비)
//      → 디스크는 평범한 검정이고 재킷에 표시가 있다.
//
// 이 둘은 서로 독립이다 — "한정반이면서 스플래터반"인 실물이 흔하다. 그래서
// 입력도 두 카테고리로 나누고(LP 종류 / 에디션 구분), 렌더링도 둘 다 동시에
// 나올 수 있게 한다(디스크는 색을 갖고, 재킷에는 스티커가 붙는다).

/** 디스크 렌더링 변형. null/'solid'는 단색 디스크. */
export type EditionStyle = 'solid' | 'clear' | 'splatter' | 'marbled' | 'pictureDisc';

/** 튄 물감의 형태 — 실물마다 확연히 다르다.
 *   streak: 길고 가는 줄기가 촘촘하게 뻗은 형태
 *   drip  : 꼬리 달린 큰 물방울이 드문드문
 *   speck : 짧은 꼬리 달린 작은 점이 촘촘하게 */
export type SplatterForm = 'streak' | 'drip' | 'speck';

export const SPLATTER_FORMS: SplatterForm[] = ['streak', 'drip', 'speck'];

export const isValidSplatterForm = (value: unknown): value is SplatterForm =>
  value === 'streak' || value === 'drip' || value === 'speck';

/** 스플래터의 기본 색 — 한 가지 색이 아니라 이 다섯 색이 무작위로 섞여 튄다.
 *  EDITION_COLOR_ALT가 NULL이면 이 팔레트를 쓰고, hex가 있으면 그 단색만 쓴다. */
export const SPLATTER_MULTI_PALETTE = ['#d1352b', '#e8762c', '#e8c53a', '#3f9e5a', '#2f6fb5'] as const;

/** 에디션 구분(카테고리 2) — 재킷에 붙은 하이프 스티커로 표현된다 */
export type EditionTagKey =
  | 'limited'
  | 'reissue'
  | 'originalPressing'
  | 'deluxeBoxSet'
  | 'signed'
  | 'import'
  | 'domestic'
  | 'heavyweight180g'
  /** 프리셋이 아니라 유저가 직접 적은 문구(EDITION_TAG_TEXT)를 쓴다 */
  | 'custom';

/** 스티커에 들어갈 직접 입력 문구의 길이 제한 — DB CHECK와 동일하게 유지 */
export const EDITION_TAG_TEXT_MAX = 10;

/** 칩으로 보여줄 프리셋 목록 ('custom'은 별도 UI라 제외) */
export const EDITION_TAGS: EditionTagKey[] = [
  'limited',
  'reissue',
  'originalPressing',
  'deluxeBoxSet',
  'signed',
  'import',
  'domestic',
  'heavyweight180g',
];

/** 에디션 구분을 재킷에 어떤 모양으로 붙일지 */
export type StickerStyle = 'foil' | 'stamp';

export const STICKER_STYLES: StickerStyle[] = ['foil', 'stamp'];

export const isValidStickerStyle = (value: unknown): value is StickerStyle =>
  value === 'foil' || value === 'stamp';

export const isValidEditionTag = (value: unknown): value is EditionTagKey =>
  typeof value === 'string' && ((EDITION_TAGS as string[]).includes(value) || value === 'custom');

/** LP 종류(카테고리 1) — 디스크 자체가 어떻게 생겼는지 */
export interface DiscKind {
  /** i18n 키(`detail.editionPresets.<key>`)와 동일 */
  key: string;
  style: EditionStyle;
  /** 고르면 함께 세팅되는 기본 바탕색 */
  defaultColor?: string;
  /** 두 색으로 이루어진 변형(스플래터/마블)의 기본 두 번째 색 */
  defaultAltColor?: string;
}

/** 두 색 변형에서 두 번째 색을 안 고른 경우의 기본값 — 실물에서 가장 흔한 크림색 */
export const EDITION_DEFAULT_ALT_COLOR = '#f4f1e8';

/** 두 번째 색을 고를 수 있는 변형 — 실물이 두 색으로 이루어진 것들 */
export const styleUsesAltColor = (style: EditionStyle | null | undefined): boolean =>
  style === 'splatter' || style === 'marbled';

// 순서 = 모달에 칩이 놓이는 순서
export const DISC_KINDS: DiscKind[] = [
  { key: 'colored', style: 'solid', defaultColor: '#3f9e5a' },
  { key: 'clear', style: 'clear', defaultColor: '#9aa3a8' },
  // 스플래터반은 크림/화이트 바탕에 색이 튄 형태가 가장 흔하다(실물 사진 기준).
  // 튄 색은 기본이 "여러 색"이라 defaultAltColor를 두지 않는다(null = 다색).
  { key: 'splatter', style: 'splatter', defaultColor: EDITION_DEFAULT_ALT_COLOR },
  { key: 'marbled', style: 'marbled', defaultColor: '#7a4fa8', defaultAltColor: EDITION_DEFAULT_ALT_COLOR },
  { key: 'pictureDisc', style: 'pictureDisc' },
];

export const findDiscKind = (style: EditionStyle | null | undefined): DiscKind | undefined =>
  DISC_KINDS.find((k) => k.style === style);

/** 실제 컬러반에서 흔한 색들 — 모달의 색 선택 스와치 */
export const EDITION_COLOR_SWATCHES = [
  '#f4f1e8', // cream (스플래터의 기본 튄 색)
  '#d1352b', // red
  '#e8762c', // orange
  '#e8c53a', // yellow
  '#3f9e5a', // green
  '#2f6fb5', // blue
  '#7a4fa8', // purple
  '#de6f9c', // pink
  '#c9a227', // gold
  '#b8bec2', // silver
  '#ececec', // white
  '#9aa3a8', // smoke / clear
  '#1a1a1a', // black
] as const;

// DB의 user_vinyl_edition_color_check와 동일한 형식 검증. 이 값은 인라인
// 스타일/CSS 그라디언트에 그대로 들어가므로 저장 전에 반드시 통과시킨다.
export const isValidEditionColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);

export const isValidEditionStyle = (value: unknown): value is EditionStyle =>
  value === 'solid' ||
  value === 'clear' ||
  value === 'splatter' ||
  value === 'marbled' ||
  value === 'pictureDisc';

/** 저장된 에디션 정보를 렌더링용으로 정규화. 형식이 깨진 값은 조용히 버린다. */
export const resolveEditionVisual = (row: {
  EDITION_LABEL?: string | null;
  EDITION_COLOR?: string | null;
  EDITION_COLOR_ALT?: string | null;
  EDITION_STYLE?: string | null;
  EDITION_SPLATTER_FORM?: string | null;
  EDITION_TAG?: string | null;
  EDITION_TAG_TEXT?: string | null;
  EDITION_STICKER_STYLE?: string | null;
  EDITION_ON_COVER?: boolean | null;
}): {
  label: string | null;
  color: string | null;
  /** 스플래터의 튄 색 / 마블의 섞인 색. 스플래터에서 null이면 "여러 색" */
  altColor: string | null;
  style: EditionStyle;
  splatterForm: SplatterForm;
  /** 에디션 구분 — 있으면 재킷에 표시를 붙인다 */
  tag: EditionTagKey | null;
  /** tag가 'custom'일 때 스티커에 들어갈 직접 입력 문구 */
  tagText: string | null;
  /** 그 표시의 모양 */
  stickerStyle: StickerStyle;
  /** 디스크 자체가 특별한지 — 있으면 디스크에 색/무늬를 입힌다 */
  hasDisc: boolean;
  onCover: boolean;
} | null => {
  const label = row.EDITION_LABEL?.trim() || null;
  const color = isValidEditionColor(row.EDITION_COLOR) ? row.EDITION_COLOR : null;
  const style = isValidEditionStyle(row.EDITION_STYLE) ? row.EDITION_STYLE : 'solid';
  // 스플래터에서 altColor가 없으면 "다색"(SPLATTER_MULTI_PALETTE)이라는 뜻이므로
  // 단색 기본값을 씌우지 않는다. 마블은 색이 하나뿐이면 표현이 안 되므로 기본값을 준다.
  const altColor = isValidEditionColor(row.EDITION_COLOR_ALT)
    ? row.EDITION_COLOR_ALT
    : style === 'marbled'
      ? EDITION_DEFAULT_ALT_COLOR
      : null;
  const splatterForm: SplatterForm = isValidSplatterForm(row.EDITION_SPLATTER_FORM)
    ? row.EDITION_SPLATTER_FORM
    : 'streak';
  // pictureDisc는 색이 아니라 재킷 이미지를 디스크에 인쇄하는 표현이라
  // 색이 없어도 "특별한 디스크"로 취급한다.
  const rawTag = isValidEditionTag(row.EDITION_TAG) ? row.EDITION_TAG : null;
  const tagText = row.EDITION_TAG_TEXT?.trim().slice(0, EDITION_TAG_TEXT_MAX) || null;
  // 직접 입력을 골랐는데 문구가 비어 있으면 표시할 게 없으므로 구분 자체를 무효로 본다.
  const tag = rawTag === 'custom' && !tagText ? null : rawTag;
  const stickerStyle: StickerStyle = isValidStickerStyle(row.EDITION_STICKER_STYLE)
    ? row.EDITION_STICKER_STYLE
    : 'foil';
  const hasDisc = !!color || style === 'pictureDisc';
  // 라벨은 더 이상 필수가 아니다 — "스플래터반"처럼 디스크를 보면 아는 정보는
  // 굳이 글자로 적지 않기 때문에, 디스크나 에디션 구분만 있어도 성립한다.
  if (!label && !tag && !hasDisc) return null;
  return {
    label,
    color,
    altColor,
    style,
    splatterForm,
    tag,
    tagText,
    stickerStyle,
    hasDisc,
    onCover: row.EDITION_ON_COVER === true,
  };
};
