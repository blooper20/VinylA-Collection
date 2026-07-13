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
  /** 장르 태그 (UI 표시용) */
  GENRES?: string[];
  /** Discogs 등 실제 시장 최저가 (KRW 기준) */
  MARKET_PRICE?: number;
}

/**
 * 사용자 보유/위시 매핑
 */
export interface USER_VINYL {
  /** 매핑 고유 식별자 */
  USER_VINYL_ID: number;
  /** 사용자 식별자 */
  USER_ID: string | number;
  /** 앨범 고유 식별자 */
  ALBUM_ID: number;
  /** 보유 상태 */
  STATUS: 'OWNED' | 'WISH' | 'NONE';
  /** 구매 일자 */
  PURCHASE_DATE: Date | string;
  /** 구매가 */
  PURCHASE_PRICE: number;
  /** 사용자가 직접 촬영해 올린 재킷 사진 (내 보관함에서만 이 커버가 우선 표시됨) */
  CUSTOM_IMAGE_URL?: string | null;
}

export type InquiryCategory = 'COMPLAINT' | 'SUGGESTION' | 'BUG' | 'GENERAL';
export type InquiryStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';
export type EventType =
  | 'VISIT'      // 비로그인 포함 방문 (유입 추적: referrer/UTM/공유 링크)
  | 'SIGNUP'     // 신규 가입 완료 (first-touch 유입 정보 META 포함)
  | 'LOGIN'
  | 'SEARCH'
  | 'SCAN'
  | 'ALBUM_ADD'
  | 'WISH_ADD'
  | 'SHARE';
export type ClientPlatform = 'WEB' | 'MOBILE';

/**
 * 문의 첨부 파일 (이미지·GIF·영상) — inquiry-attachments 버킷의 공개 URL
 */
export interface InquiryAttachment {
  url: string;
  type: 'image' | 'video';
  name: string;
}

/**
 * 사용자 문의 (불만/건의/버그)
 */
export interface INQUIRY {
  INQUIRY_ID: number;
  USER_ID: string;
  CATEGORY: InquiryCategory;
  TITLE: string;
  CONTENT: string;
  STATUS: InquiryStatus;
  PLATFORM: ClientPlatform;
  ATTACHMENTS?: InquiryAttachment[] | null;
  CREATED_AT: string;
  UPDATED_AT: string;
}

/**
 * 문의 답변 스레드 (IS_ADMIN=true는 운영자 답변)
 */
export interface INQUIRY_REPLY {
  REPLY_ID: number;
  INQUIRY_ID: number;
  USER_ID: string | null;
  IS_ADMIN: boolean;
  CONTENT: string;
  CREATED_AT: string;
}

/**
 * 사용 지표 이벤트 로그 (admin 대시보드 집계용)
 */
export interface EVENT_LOG {
  EVENT_ID: number;
  EVENT_TYPE: EventType;
  USER_ID: string | null;
  PLATFORM: ClientPlatform;
  META: Record<string, unknown> | null;
  CREATED_AT: string;
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
