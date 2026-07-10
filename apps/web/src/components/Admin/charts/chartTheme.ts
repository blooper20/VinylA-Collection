// Chart color system for the admin dashboard (dark surface #131313).
// Validated with the dataviz palette validator: lightness band, chroma
// floor, adjacent-pair CVD separation, contrast — all PASS.
//
// The brand gold (#e9c349) fails the multi-series lightness band —
// it is reserved for single-series emphasis (signup area chart) only.

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
