import type { TranslationKey } from '@vinyla/i18n';

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

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type BadgeCategory = 'collection' | 'wealth' | 'wishlist' | 'genre';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  isHidden: boolean;
  tier: BadgeTier;
  category: BadgeCategory;
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
  { id: 'Blues', name: '블루스' },
  { id: 'Country', name: '컨트리' },
  { id: 'Reggae', name: '레게' },
  { id: 'Folk', name: '포크' },
  { id: 'Metal', name: '메탈' },
  { id: 'World', name: '월드뮤직' },
];

const genreBadges: Badge[] = POPULAR_GENRES.flatMap(g => [
  {
    id: `genre_${g.id}_1`,
    name: `${g.name} 찍먹`,
    description: `${g.id} 장르 앨범 1장 이상 보유`,
    icon: 'hearing',
    isHidden: false,
    tier: 'bronze',
    category: 'genre',
    check: (stats) => (stats.ownedGenres[g.id] || 0) >= 1,
  },
  {
    id: `genre_${g.id}_5`,
    name: `${g.name} 리스너`,
    description: `${g.id} 장르 앨범 5장 이상 보유`,
    icon: 'headphones_battery',
    isHidden: false,
    tier: 'bronze',
    category: 'genre',
    check: (stats) => (stats.ownedGenres[g.id] || 0) >= 5,
  },
  {
    id: `genre_${g.id}_10`,
    name: `${g.name} 꿈나무`,
    description: `${g.id} 장르 앨범 10장 이상 보유`,
    icon: 'music_note',
    isHidden: false,
    tier: 'silver',
    category: 'genre',
    check: (stats) => (stats.ownedGenres[g.id] || 0) >= 10,
  },
  {
    id: `genre_${g.id}_50`,
    name: `${g.name} 마니아`,
    description: `${g.id} 장르 앨범 50장 이상 보유`,
    icon: 'queue_music',
    isHidden: false,
    tier: 'gold',
    category: 'genre',
    check: (stats) => (stats.ownedGenres[g.id] || 0) >= 50,
  },
  {
    id: `genre_${g.id}_100`,
    name: `${g.name} 처돌이`,
    description: `${g.id} 장르 앨범 100장 이상 보유 (히든)`,
    icon: 'headphones',
    isHidden: true,
    tier: 'platinum',
    category: 'genre',
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
    tier: 'bronze',
    category: 'collection',
    check: (stats) => stats.ownedCount >= 1,
  },
  {
    id: 'owned_5',
    name: '음악 수집의 시작',
    description: '앨범 5장 이상 보유',
    icon: 'play_arrow',
    isHidden: false,
    tier: 'bronze',
    category: 'collection',
    check: (stats) => stats.ownedCount >= 5,
  },
  {
    id: 'owned_10',
    name: '턴테이블 돌려깎기',
    description: '앨범 10장 이상 보유',
    icon: 'album',
    isHidden: false,
    tier: 'silver',
    category: 'collection',
    check: (stats) => stats.ownedCount >= 10,
  },
  {
    id: 'owned_30',
    name: '랙이 모자라',
    description: '앨범 30장 이상 보유',
    icon: 'view_carousel',
    isHidden: false,
    tier: 'silver',
    category: 'collection',
    check: (stats) => stats.ownedCount >= 30,
  },
  {
    id: 'owned_50',
    name: '방구석 디제이',
    description: '앨범 50장 이상 보유',
    icon: 'surround_sound',
    isHidden: false,
    tier: 'gold',
    category: 'collection',
    check: (stats) => stats.ownedCount >= 50,
  },
  {
    id: 'owned_100',
    name: '레코드 샵 단골',
    description: '앨범 100장 이상 보유',
    icon: 'storefront',
    isHidden: false,
    tier: 'gold',
    category: 'collection',
    check: (stats) => stats.ownedCount >= 100,
  },
  {
    id: 'owned_200',
    name: '골수 콜렉터',
    description: '앨범 200장 이상 보유 (히든)',
    icon: 'inventory_2',
    isHidden: true,
    tier: 'platinum',
    category: 'collection',
    check: (stats) => stats.ownedCount >= 200,
  },
  {
    id: 'owned_300',
    name: '걸어다니는 아카이브',
    description: '앨범 300장 이상 보유 (히든)',
    icon: 'library_music',
    isHidden: true,
    tier: 'platinum',
    category: 'collection',
    check: (stats) => stats.ownedCount >= 300,
  },
  {
    id: 'owned_500',
    name: '개인 음악 도서관',
    description: '앨범 500장 이상 보유 (히든)',
    icon: 'account_balance',
    isHidden: true,
    tier: 'diamond',
    category: 'collection',
    check: (stats) => stats.ownedCount >= 500,
  },
  {
    id: 'owned_1000',
    name: '바이닐 박물관장',
    description: '앨범 1,000장 이상 보유 (히든)',
    icon: 'museum',
    isHidden: true,
    tier: 'diamond',
    category: 'collection',
    check: (stats) => stats.ownedCount >= 1000,
  },

  // --- 자산 및 지출액 ---
  {
    id: 'asset_1m',
    name: '음악 재벌',
    description: '컬렉션 총 시장가 100만 원 이상',
    icon: 'account_balance_wallet',
    isHidden: false,
    tier: 'silver',
    category: 'wealth',
    check: (stats) => stats.totalMarketPrice >= 1000000,
  },
  {
    id: 'asset_5m',
    name: '움직이는 금고',
    description: '컬렉션 총 시장가 500만 원 이상 (히든)',
    icon: 'savings',
    isHidden: true,
    tier: 'gold',
    category: 'wealth',
    check: (stats) => stats.totalMarketPrice >= 5000000,
  },
  {
    id: 'asset_10m',
    name: '바이닐계의 워렌버핏',
    description: '컬렉션 총 시장가 1,000만 원 이상 (히든)',
    icon: 'diamond',
    isHidden: true,
    tier: 'diamond',
    category: 'wealth',
    check: (stats) => stats.totalMarketPrice >= 10000000,
  },
  {
    id: 'price_high_100k',
    name: '나름 레어템 보유자',
    description: '시장 추정가 10만 원 이상 앨범 보유',
    icon: 'diamond',
    isHidden: false,
    tier: 'bronze',
    category: 'wealth',
    check: (stats) => stats.highestMarketPrice >= 100000,
  },
  {
    id: 'price_high_300k',
    name: '벽에 걸어둬야 할 판',
    description: '시장 추정가 30만 원 이상 앨범 보유 (히든)',
    icon: 'star',
    isHidden: true,
    tier: 'silver',
    category: 'wealth',
    check: (stats) => stats.highestMarketPrice >= 300000,
  },
  {
    id: 'price_high_500k',
    name: '금고에 넣어야 할 판',
    description: '시장 추정가 50만 원 이상 앨범 보유 (히든)',
    icon: 'lock',
    isHidden: true,
    tier: 'gold',
    category: 'wealth',
    check: (stats) => stats.highestMarketPrice >= 500000,
  },
  {
    id: 'price_spend_300k',
    name: '지갑 브레이커',
    description: '단일 앨범 구매에 30만 원 이상 지출 (히든)',
    icon: 'account_balance_wallet',
    isHidden: true,
    tier: 'silver',
    category: 'wealth',
    check: (stats) => stats.highestPurchasePrice >= 300000,
  },
  {
    id: 'price_spend_500k',
    name: '플렉스(Flex) 콜렉터',
    description: '단일 앨범 구매에 50만 원 이상 지출 (히든)',
    icon: 'payments',
    isHidden: true,
    tier: 'gold',
    category: 'wealth',
    check: (stats) => stats.highestPurchasePrice >= 500000,
  },
  {
    id: 'price_spend_1m',
    name: '통장 파괴자',
    description: '단일 앨범 구매에 100만 원 이상 지출 (히든)',
    icon: 'credit_card_off',
    isHidden: true,
    tier: 'diamond',
    category: 'wealth',
    check: (stats) => stats.highestPurchasePrice >= 1000000,
  },
  {
    id: 'price_avg_100k',
    name: '알짜배기 콜렉터',
    description: '평균 시장가 10만 원 이상 (최소 10장 보유)',
    icon: 'verified',
    isHidden: false,
    tier: 'gold',
    category: 'wealth',
    check: (stats) => stats.ownedCount >= 10 && stats.averageMarketPrice >= 100000,
  },

  // --- 위시리스트 ---
  {
    id: 'wish_1',
    name: '첫 번째 소원',
    description: '위시리스트 1개 이상',
    icon: 'favorite_border',
    isHidden: false,
    tier: 'bronze',
    category: 'wishlist',
    check: (stats) => stats.wishCount >= 1,
  },
  {
    id: 'wish_10',
    name: '소박한 장바구니',
    description: '위시리스트 10개 이상',
    icon: 'shopping_cart',
    isHidden: false,
    tier: 'bronze',
    category: 'wishlist',
    check: (stats) => stats.wishCount >= 10,
  },
  {
    id: 'wish_50',
    name: '몽상가',
    description: '위시리스트 50개 이상',
    icon: 'cloud',
    isHidden: false,
    tier: 'silver',
    category: 'wishlist',
    check: (stats) => stats.wishCount >= 50,
  },
  {
    id: 'wish_100',
    name: '이거 언제 다 사?',
    description: '위시리스트 100개 이상 (히든)',
    icon: 'receipt_long',
    isHidden: true,
    tier: 'gold',
    category: 'wishlist',
    check: (stats) => stats.wishCount >= 100,
  },
  {
    id: 'wish_300',
    name: '끝없는 탐욕',
    description: '위시리스트 300개 이상 (히든)',
    icon: 'all_inclusive',
    isHidden: true,
    tier: 'platinum',
    category: 'wishlist',
    check: (stats) => stats.wishCount >= 300,
  },
  {
    id: 'wish_500',
    name: '위시리스트 터짐',
    description: '위시리스트 500개 이상 (히든)',
    icon: 'warning',
    isHidden: true,
    tier: 'diamond',
    category: 'wishlist',
    check: (stats) => stats.wishCount >= 500,
  },
  {
    id: 'wish_price_1m',
    name: '위시리스트 만수르',
    description: '위시리스트 총 시장가 100만 원 이상',
    icon: 'attach_money',
    isHidden: false,
    tier: 'silver',
    category: 'wishlist',
    check: (stats) => stats.totalWishPrice >= 1000000,
  },
  {
    id: 'wish_price_5m',
    name: '이루어질 수 없는 꿈',
    description: '위시리스트 총 시장가 500만 원 이상 (히든)',
    icon: 'money_off',
    isHidden: true,
    tier: 'gold',
    category: 'wishlist',
    check: (stats) => stats.totalWishPrice >= 5000000,
  },
  {
    id: 'wish_price_10m',
    name: '국가 예산급 위시',
    description: '위시리스트 총 시장가 1,000만 원 이상 (히든)',
    icon: 'account_balance',
    isHidden: true,
    tier: 'diamond',
    category: 'wishlist',
    check: (stats) => stats.totalWishPrice >= 10000000,
  },

  // --- 다양성 ---
  {
    id: 'genre_explorer_3',
    name: '편식쟁이 탈출',
    description: '3개 이상의 다양한 장르 보유',
    icon: 'restaurant_menu',
    isHidden: false,
    tier: 'bronze',
    category: 'genre',
    check: (stats) => Object.keys(stats.ownedGenres).length >= 3,
  },
  {
    id: 'genre_explorer_5',
    name: '장르 탐험가',
    description: '5개 이상의 다양한 장르 보유',
    icon: 'explore',
    isHidden: false,
    tier: 'silver',
    category: 'genre',
    check: (stats) => Object.keys(stats.ownedGenres).length >= 5,
  },
  {
    id: 'genre_explorer_10',
    name: '음악의 백과사전',
    description: '10개 이상의 다양한 장르 보유 (히든)',
    icon: 'menu_book',
    isHidden: true,
    tier: 'gold',
    category: 'genre',
    check: (stats) => Object.keys(stats.ownedGenres).length >= 10,
  },
  {
    id: 'genre_explorer_15',
    name: '장르의 연금술사',
    description: '15개 이상의 다양한 장르 보유 (히든)',
    icon: 'science',
    isHidden: true,
    tier: 'platinum',
    category: 'genre',
    check: (stats) => Object.keys(stats.ownedGenres).length >= 15,
  },
  {
    id: 'genre_explorer_20',
    name: '음악의 신',
    description: '20개 이상의 다양한 장르 보유 (히든)',
    icon: 'psychology',
    isHidden: true,
    tier: 'diamond',
    category: 'genre',
    check: (stats) => Object.keys(stats.ownedGenres).length >= 20,
  },

  ...genreBadges
];

export function evaluateBadges(stats: UserStats): string[] {
  return BADGES.filter(badge => badge.check(stats)).map(badge => badge.id);
}

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string;

const GENRE_BADGE_TIERS: Record<string, string> = { '1': 'tier1', '5': 'tier5', '10': 'tier10', '50': 'tier50', '100': 'tier100' };

// `badge.name`/`badge.description` stay Korean-only (see errors.ts for the
// same fallback pattern) so mobile screens — not translated yet — keep
// compiling and behaving identically. Web call sites should use this
// instead of reading the fields directly, passing their own useLocale().
// Genre badges are id-templated (genre_<id>_<tier>), so their text is built
// from a small suffix template rather than 65 flat dictionary entries.
export function getBadgeText(badge: Badge, locale: 'ko' | 'en', t: Translate): { name: string; description: string } {
  const genreMatch = badge.id.match(/^genre_(.+)_(\d+)$/);
  if (genreMatch) {
    const [, genreId, tierNum] = genreMatch;
    const tierKey = GENRE_BADGE_TIERS[tierNum] || 'tier1';
    const genreName = locale === 'ko' ? (POPULAR_GENRES.find(g => g.id === genreId)?.name || genreId) : genreId;
    return {
      name: t(`badge.genreSuffix.${tierKey}.name` as TranslationKey, { genre: genreName, genreId }),
      description: t(`badge.genreSuffix.${tierKey}.description` as TranslationKey, { genre: genreName, genreId }),
    };
  }
  return {
    name: t(`badge.${badge.id}.name` as TranslationKey),
    description: t(`badge.${badge.id}.description` as TranslationKey),
  };
}
