export interface UserStats {
  ownedCount: number;
  wishCount: number;
  totalMarketPrice: number;
  totalWishPrice: number;
  highestMarketPrice: number;
  highestPurchasePrice: number;
  averageMarketPrice: number;
  favoriteGenre: string;
  ownedGenres: Record<string, number>;
  wishGenres: Record<string, number>;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  isHidden: boolean;
  check: (stats: UserStats) => boolean;
}

const POPULAR_GENRES = [
  { id: 'Jazz', name: '재즈' },
  { id: 'Rock', name: '락' },
  { id: 'Pop', name: '팝' },
  { id: 'R&B/Soul', name: 'R&B/소울' },
  { id: 'Hip Hop', name: '힙합' },
  { id: 'Electronic', name: '일렉트로닉' },
  { id: 'Classical', name: '클래식' },
];

const genreBadges: Badge[] = POPULAR_GENRES.flatMap(g => [
  {
    id: `genre_${g.id}_10`,
    name: `${g.name} 꿈나무`,
    description: `${g.id} 장르 앨범 10장 이상 보유`,
    icon: 'music_note',
    isHidden: false,
    check: (stats) => (stats.ownedGenres[g.id] || 0) >= 10,
  },
  {
    id: `genre_${g.id}_50`,
    name: `${g.name} 마니아`,
    description: `${g.id} 장르 앨범 50장 이상 보유`,
    icon: 'queue_music',
    isHidden: false,
    check: (stats) => (stats.ownedGenres[g.id] || 0) >= 50,
  },
  {
    id: `genre_${g.id}_100`,
    name: `${g.name} 처돌이`,
    description: `${g.id} 장르 앨범 100장 이상 보유 (히든)`,
    icon: 'headphones',
    isHidden: true,
    check: (stats) => (stats.ownedGenres[g.id] || 0) >= 100,
  }
]);

export const BADGES: Badge[] = [
  // --- 보유 개수 ---
  {
    id: 'owned_1',
    name: '바이닐 입문자',
    description: '첫 앨범을 등록했습니다.',
    icon: 'album',
    isHidden: false,
    check: (stats) => stats.ownedCount >= 1,
  },
  {
    id: 'owned_10',
    name: '턴테이블 돌려깎기',
    description: '앨범 10장 이상 보유',
    icon: 'album',
    isHidden: false,
    check: (stats) => stats.ownedCount >= 10,
  },
  {
    id: 'owned_30',
    name: '랙이 모자라',
    description: '앨범 30장 이상 보유',
    icon: 'view_carousel',
    isHidden: false,
    check: (stats) => stats.ownedCount >= 30,
  },
  {
    id: 'owned_50',
    name: '방구석 디제이',
    description: '앨범 50장 이상 보유',
    icon: 'surround_sound',
    isHidden: false,
    check: (stats) => stats.ownedCount >= 50,
  },
  {
    id: 'owned_100',
    name: '레코드 샵 단골',
    description: '앨범 100장 이상 보유',
    icon: 'storefront',
    isHidden: false,
    check: (stats) => stats.ownedCount >= 100,
  },
  {
    id: 'owned_300',
    name: '걸어다니는 아카이브',
    description: '앨범 300장 이상 보유 (히든)',
    icon: 'library_music',
    isHidden: true,
    check: (stats) => stats.ownedCount >= 300,
  },
  {
    id: 'owned_500',
    name: '개인 음악 도서관',
    description: '앨범 500장 이상 보유 (히든)',
    icon: 'account_balance',
    isHidden: true,
    check: (stats) => stats.ownedCount >= 500,
  },
  {
    id: 'owned_1000',
    name: '바이닐 박물관장',
    description: '앨범 1,000장 이상 보유 (히든)',
    icon: 'museum',
    isHidden: true,
    check: (stats) => stats.ownedCount >= 1000,
  },

  // --- 시장가 / 지출액 ---
  {
    id: 'price_high_100k',
    name: '나름 레어템 보유자',
    description: '시장 추정가 10만 원 이상 앨범 보유',
    icon: 'diamond',
    isHidden: false,
    check: (stats) => stats.highestMarketPrice >= 100000,
  },
  {
    id: 'price_high_300k',
    name: '벽에 걸어둬야 할 판',
    description: '시장 추정가 30만 원 이상 앨범 보유 (히든)',
    icon: 'star',
    isHidden: true,
    check: (stats) => stats.highestMarketPrice >= 300000,
  },
  {
    id: 'price_high_500k',
    name: '금고에 넣어야 할 판',
    description: '시장 추정가 50만 원 이상 앨범 보유 (히든)',
    icon: 'lock',
    isHidden: true,
    check: (stats) => stats.highestMarketPrice >= 500000,
  },
  {
    id: 'price_spend_300k',
    name: '지갑 브레이커',
    description: '단일 앨범 구매에 30만 원 이상 지출 (히든)',
    icon: 'account_balance_wallet',
    isHidden: true,
    check: (stats) => stats.highestPurchasePrice >= 300000,
  },
  {
    id: 'price_spend_500k',
    name: '플렉스(Flex) 콜렉터',
    description: '단일 앨범 구매에 50만 원 이상 지출 (히든)',
    icon: 'payments',
    isHidden: true,
    check: (stats) => stats.highestPurchasePrice >= 500000,
  },
  {
    id: 'price_avg_100k',
    name: '알짜배기 콜렉터',
    description: '평균 시장가 10만 원 이상 (최소 10장 보유)',
    icon: 'verified',
    isHidden: false,
    check: (stats) => stats.ownedCount >= 10 && stats.averageMarketPrice >= 100000,
  },

  // --- 위시리스트 ---
  {
    id: 'wish_10',
    name: '소박한 장바구니',
    description: '위시리스트 10개 이상',
    icon: 'shopping_cart',
    isHidden: false,
    check: (stats) => stats.wishCount >= 10,
  },
  {
    id: 'wish_50',
    name: '몽상가',
    description: '위시리스트 50개 이상',
    icon: 'cloud',
    isHidden: false,
    check: (stats) => stats.wishCount >= 50,
  },
  {
    id: 'wish_100',
    name: '이거 언제 다 사?',
    description: '위시리스트 100개 이상 (히든)',
    icon: 'receipt_long',
    isHidden: true,
    check: (stats) => stats.wishCount >= 100,
  },
  {
    id: 'wish_price_1m',
    name: '위시리스트 만수르',
    description: '위시리스트 총 시장가 100만 원 이상',
    icon: 'attach_money',
    isHidden: false,
    check: (stats) => stats.totalWishPrice >= 1000000,
  },

  // --- 다양성 ---
  {
    id: 'genre_explorer_5',
    name: '장르 탐험가',
    description: '5개 이상의 다양한 장르 보유',
    icon: 'explore',
    isHidden: false,
    check: (stats) => Object.keys(stats.ownedGenres).length >= 5,
  },
  {
    id: 'genre_explorer_10',
    name: '음악의 백과사전',
    description: '10개 이상의 다양한 장르 보유 (히든)',
    icon: 'menu_book',
    isHidden: true,
    check: (stats) => Object.keys(stats.ownedGenres).length >= 10,
  },

  ...genreBadges
];

export function evaluateBadges(stats: UserStats): string[] {
  return BADGES.filter(badge => badge.check(stats)).map(badge => badge.id);
}
