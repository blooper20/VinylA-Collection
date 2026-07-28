import { MockVinylData } from '@vinyla/shared-types';

export type SortMode = 'latest' | 'oldest' | 'alpha' | 'year' | 'custom';

export const SORT_OPTIONS: { key: SortMode }[] = [
  { key: 'latest' },
  { key: 'oldest' },
  { key: 'alpha' },
  { key: 'year' },
  { key: 'custom' },
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
      case 'custom': {
        // 한 번도 드래그로 정렬한 적 없는(SORT_ORDER == null) 앨범은 뒤로
        // 밀어낸다 — 새로 추가한 앨범이 기존에 손으로 정해둔 순서 한가운데
        // 임의로 끼어들지 않도록.
        const ao = a.SORT_ORDER;
        const bo = b.SORT_ORDER;
        if (ao == null && bo == null) return purchaseDateString(b.PURCHASE_DATE).localeCompare(purchaseDateString(a.PURCHASE_DATE));
        if (ao == null) return 1;
        if (bo == null) return -1;
        return ao - bo;
      }
      default:
        return purchaseDateString(b.PURCHASE_DATE).localeCompare(purchaseDateString(a.PURCHASE_DATE));
    }
  });
};
