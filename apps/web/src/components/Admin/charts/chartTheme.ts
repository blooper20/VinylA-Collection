// Chart color system for the admin dashboard (dark surface #131313).
// Validated with the dataviz palette validator: lightness band, chroma
// floor, adjacent-pair CVD separation, contrast — all PASS.
//
// Rules:
//  * Categorical hues are assigned in FIXED order per entity (event type),
//    never cycled or re-assigned when a filter changes the series count.
//  * The brand gold (#e9c349) fails the multi-series lightness band —
//    it is reserved for single-series emphasis (signup area chart) only.

export const CATEGORICAL = ['#3987e5', '#199e70', '#c98500', '#9085e9', '#e66767', '#d55181'];

// Fixed entity→color mapping for event types (stable across filters)
export const EVENT_COLOR: Record<string, string> = {
  LOGIN: '#3987e5',
  SEARCH: '#199e70',
  SCAN: '#c98500',
  ALBUM_ADD: '#9085e9',
  WISH_ADD: '#e66767',
  SHARE: '#d55181',
};

export const EVENT_LABEL: Record<string, string> = {
  LOGIN: '로그인',
  SEARCH: '검색',
  SCAN: '스캔',
  ALBUM_ADD: '앨범 등록',
  WISH_ADD: '위시 추가',
  SHARE: '공유',
};

// Single-series emphasis (brand gold) — signup trend only
export const ACCENT_LINE = '#e9c349';
export const ACCENT_FILL = 'rgba(233, 195, 73, 0.15)';

// Single-hue bars
export const BAR_GOLD = '#c98500';
export const BAR_BLUE = '#3987e5';

// Chart chrome — recessive, from the app's global tokens
export const GRID_COLOR = 'rgba(255, 255, 255, 0.08)';
export const AXIS_COLOR = '#8e9192';
export const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#2a2a2a',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 8,
  fontSize: 12,
  color: '#c4c7c8',
};
