import { MockVinylData } from '@vinyla/shared-types';

export type SortMode = 'latest' | 'oldest' | 'alpha' | 'year';

export const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'latest', label: '최신순' },
  { key: 'oldest', label: '오래된순' },
  { key: 'alpha', label: '가나다순' },
  { key: 'year', label: '출시연도순' },
];

const purchaseDateString = (value: string | Date | undefined): string =>
  value instanceof Date ? value.toISOString() : value || '';

export const sortVinyls = <T extends MockVinylData>(albums: T[], sortMode: SortMode): T[] => {
  return [...albums].sort((a, b) => {
    switch (sortMode) {
      case 'oldest':
        return purchaseDateString(a.PURCHASE_DATE).localeCompare(purchaseDateString(b.PURCHASE_DATE));
      case 'alpha':
        return (a.TITLE || '').localeCompare(b.TITLE || '', 'ko');
      case 'year':
        return (Number(b.RELEASE_YEAR) || 0) - (Number(a.RELEASE_YEAR) || 0);
      default:
        return purchaseDateString(b.PURCHASE_DATE).localeCompare(purchaseDateString(a.PURCHASE_DATE));
    }
  });
};
