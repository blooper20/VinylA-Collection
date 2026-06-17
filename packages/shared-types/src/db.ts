/**
 * 앨범 마스터 메타데이터
 */
export interface ALBUM_MASTER {
  /** 앨범 고유 식별자 */
  ALBUM_ID: number;
  /** 앨범명 */
  TITLE: string;
  /** 아티스트명 */
  ARTIST: string;
  /** 발매 연도 */
  RELEASE_YEAR: number;
  /** 고해상도 재킷 커버 이미지 경로 */
  IMAGE_URL: string;
  /** 실물 LP 알맹이 누끼 이미지 경로 */
  VINYL_IMAGE_URL: string;
  /** 유저가 지정한 알맹이 HEX 색상 코드 */
  CUSTOM_COLOR_HEX: string;
  /** 유저가 지정한 알맹이 질감 */
  CUSTOM_STYLE_TYPE: 'SOLID' | 'TRANSLUCENT' | 'SPLATTER';
  /** 수록곡 리스트 */
  TRACKS?: string[];
}

/**
 * 사용자 보유/위시 매핑
 */
export interface USER_VINYL {
  /** 매핑 고유 식별자 */
  USER_VINYL_ID: number;
  /** 사용자 식별자 */
  USER_ID: number;
  /** 앨범 고유 식별자 */
  ALBUM_ID: number;
  /** 보유 상태 */
  STATUS: 'OWNED' | 'WISH' | 'NONE';
  /** 구매 일자 */
  PURCHASE_DATE: Date | string;
  /** 구매가 */
  PURCHASE_PRICE: number;
}

/**
 * 태그 정보
 */
export interface VINYL_TAG {
  /** 태그 식별자 */
  TAG_ID: number;
  /** 앨범 고유 식별자 */
  ALBUM_ID: number;
  /** 태그 유형 */
  TAG_TYPE: 'GENRE' | 'COUNTRY' | 'ARTIST';
  /** 태그명 */
  TAG_NAME: string;
}
