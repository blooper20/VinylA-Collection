/**
 * 트랙 1곡 — position은 Discogs 원본 표기("A1", "B2" 등), side는 거기서
 * 파싱한 앞쪽 알파벳(디지털 소스 폴백일 때는 둘 다 없음)
 */
export interface AlbumTrack {
  position?: string;
  side?: string;
  title: string;
  duration?: string;
}

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
  /** 고해상도 재킷 커버 이미지 경로 (모두가 보는 현재 커버) */
  IMAGE_URL: string;
  /** 마지막 카탈로그(검색 소스) 커버 — 유저 촬영본이 IMAGE_URL을 덮어쓸 때
   *  서버가 자동 백업하며, '기존 커버로 되돌리기'의 복원 원본이 된다 */
  ORIGINAL_IMAGE_URL?: string | null;
  /** 실물 LP 알맹이 누끼 이미지 경로 */
  VINYL_IMAGE_URL: string;
  /** 유저가 지정한 알맹이 HEX 색상 코드 */
  CUSTOM_COLOR_HEX: string;
  /** 유저가 지정한 알맹이 질감 */
  CUSTOM_STYLE_TYPE: 'SOLID' | 'TRANSLUCENT' | 'SPLATTER';
  /** (레거시) 마스터 단위로 캐싱되던 수록곡 — 프레싱마다 실제 트랙/사이드가
   *  달라 오염 소지가 있었음. 더 이상 쓰지 않으며, 실물반 트랙은
   *  ALBUM_RELEASE_TRACKS(release 단위)에서 관리한다. 과거 데이터 호환을
   *  위해 타입만 남겨둠 */
  TRACKS?: AlbumTrack[];
  /** 장르 태그 (UI 표시용) */
  GENRES?: string[];
  /** Discogs 등 실제 시장 최저가 (KRW 기준) */
  MARKET_PRICE?: number;
  /** 이 앨범을 등록한 유저 — NULL이면 Discogs 소스(캐노니컬) 행 */
  SUBMITTED_BY?: string | null;
  /** 앨범 출처 — 커뮤니티 등록(위키형) 앨범인지 구분 */
  SOURCE?: 'DISCOGS' | 'APPLE_MUSIC' | 'MANUAL';
  /** 애플뮤직에서 가져온 경우 원본 collectionId — 중복 등록 방지용 */
  APPLE_COLLECTION_ID?: number | null;
  /** 커뮤니티 등록 앨범 전용 트랙리스트(레거시 TRACKS와 별개 — TRACKS는 재사용하지 않음) */
  COMMUNITY_TRACKS?: AlbumTrack[] | null;
  /** 등록 시각(커뮤니티 목록 정렬 기준) */
  CREATED_AT?: string;
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
  /** 보관함에 담은 시각 (디스커버리 피드 정렬 기준) */
  ADDED_AT?: string;
  /** 공개 여부 */
  IS_PUBLIC?: boolean;
  /** 유저가 실제로 소장한 실물반의 Discogs release ID (master_id가 아님).
   *  검색 시 자동으로 잡히거나, 프레싱 선택 UI로 직접 지정한다. 이 값이
   *  있어야 ALBUM_RELEASE_TRACKS에서 정확한 사이드/트랙을 가져올 수 있다 */
  DISCOGS_RELEASE_ID?: number | null;
  /** 유저가 소장한 실물반으로 커뮤니티 프레싱(다른 유저가 직접 등록한 트랙)을
   *  골랐을 때의 참조. DISCOGS_RELEASE_ID와 상호 배타적 — 실제 소장반은
   *  Discogs release 아니면 커뮤니티 등록 둘 중 하나다 */
  CUSTOM_PRESSING_ID?: number | null;
  /** 컬렉션 "수정 모드"에서 드래그로 정한 표시 순서. NULL이면 이 행은 아직
   *  수동 정렬된 적이 없다는 뜻 — "직접 정렬" 모드에서 맨 뒤로 정렬된다 */
  SORT_ORDER?: number | null;
  /** 같은 앨범의 여러 소장/위시 항목을 구분하는 에디션 라벨(프리셋 또는
   *  자유 입력, 예: "그린반", "스플래터반"). NULL이면 "또 등록" 없이
   *  저장된 기본 항목 */
  EDITION_LABEL?: string | null;
  /** 실물 디스크 바탕색(#RRGGBB). 값이 있으면 커버에 "디스크 색"으로 표현하고,
   *  NULL이면 라벨 텍스트를 담은 하이프 스티커로 표현한다 */
  EDITION_COLOR?: string | null;
  /** 두 번째 색(#RRGGBB) — 스플래터반의 튄 색, 마블반의 섞인 색.
   *  NULL이면 바탕색에서 파생한 기본값을 쓴다 */
  EDITION_COLOR_ALT?: string | null;
  /** 디스크 렌더링 변형(clear/splatter/marbled/pictureDisc). NULL/solid는 단색 */
  EDITION_STYLE?: string | null;
  /** 튄 물감의 형태(streak/drip/speck). NULL이면 streak */
  EDITION_SPLATTER_FORM?: string | null;
  /** 에디션 구분(한정반/사인반 등) — 재킷 표시로 표현. LP 종류와 독립 */
  EDITION_TAG?: string | null;
  /** 직접 입력한 표시 문구(EDITION_TAG='custom'일 때). 최대 10자 */
  EDITION_TAG_TEXT?: string | null;
  /** 그 표시의 모양(foil/stamp/bookmark). NULL이면 foil */
  EDITION_STICKER_STYLE?: string | null;
  /** 앨범 커버(그리드/상세)에 이 에디션을 시각적으로 드러낼지 여부.
   *  false면 기존처럼 텍스트 뱃지만 표시한다 */
  EDITION_ON_COVER?: boolean | null;
}

/**
 * 실물반(release) 단위 트랙리스트 캐시 — 같은 프레싱을 가진 유저끼리는
 * 안전하게 공유 가능하다(캐시 키가 정확히 "그 실물반"이므로 서로 다른
 * 프레싱 간 오염이 구조적으로 불가능하다. ALBUM_MASTER.TRACKS와 대비).
 */
export interface ALBUM_RELEASE_TRACKS {
  DISCOGS_RELEASE_ID: number;
  TRACKS: AlbumTrack[];
  FETCHED_AT?: string;
}

/**
 * 유저가 직접 입력한 프레싱(사이드별 트랙리스트) — Discogs/알라딘 어디에도
 * 없는 실물반을 위한 최후 수단. 공개 등록은 "다른 프레싱 선택"에서 같은
 * 앨범의 다른 유저에게도 보인다(게시글처럼) — 비공개면 등록한 본인에게만.
 */
export interface CUSTOM_PRESSING {
  PRESSING_ID: number;
  ALBUM_ID: number;
  SUBMITTED_BY: string;
  TITLE: string;
  TRACKS: AlbumTrack[];
  IS_PUBLIC: boolean;
  CREATED_AT?: string;
}

/**
 * 유저 팔로우 관계 — FOLLOWER_ID가 FOLLOWING_ID를 팔로우한다
 */
export interface USER_FOLLOW {
  FOLLOW_ID: number;
  FOLLOWER_ID: string;
  FOLLOWING_ID: string;
  CREATED_AT: string;
}

/**
 * 팔로우 요청 (비공개 프로필 대상) — TARGET_ID가 수락해야 USER_FOLLOW가 된다
 */
export interface FOLLOW_REQUEST {
  REQUEST_ID: number;
  REQUESTER_ID: string;
  TARGET_ID: string;
  CREATED_AT: string;
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
  | 'SHARE'
  | 'SPIN_LOG'      // 스피닝 다이어리에 재생 기록 추가
  | 'RANDOM_PICK'   // "오늘 뭐 듣지?" 랜덤 픽 사용
  | 'FOLLOW'        // 다른 수집가 팔로우
  | 'ERROR';        // 유저에게 코드가 보여진 에러 발생 — META: {code, message, detail}
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
  /** 관리자가 이 문의를 처음 열람한 시각 — null이면 작성자가 아직 수정 가능 */
  ADMIN_READ_AT?: string | null;
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
  /** (관리자 답변) 문의 작성자가 처음 열람한 시각 — null이면 관리자가 아직 수정 가능 */
  READ_AT?: string | null;
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
 * 스피닝 다이어리 — 오늘 턴테이블에 올린 LP + 소감 기록 (Letterboxd 다이어리 방식)
 */
export interface LISTENING_LOG {
  LOG_ID: number;
  USER_ID: string;
  ALBUM_ID: number;
  /** 소감 프리셋 (자유 텍스트, 프론트에서 이모지 프리셋 제공) */
  MOOD?: string | null;
  /** 짧은 감상 메모 (최대 500자) */
  NOTE?: string | null;
  /** 첨부 사진 또는 15초 내외 짧은 영상 1개 (spin-log-media 버킷 공개 URL) */
  MEDIA_URL?: string | null;
  MEDIA_TYPE?: 'image' | 'video' | null;
  /** 공개 여부 — false면 작성자 본인만 조회 가능 (기본값 true) */
  IS_PUBLIC: boolean;
  /** 실제로 들은 시각 (기본은 기록 시각과 동일, 추후 수정 가능) */
  LISTENED_AT: string;
  CREATED_AT: string;
}

/**
 * 오늘의 바이닐 스토리 — 매일 명반 하나의 숨겨진 이야기를 소개하는 매거진 콘텐츠
 */
export interface VINYL_STORY {
  STORY_ID: number;
  STORY_DATE: string;
  ALBUM_TITLE: string;
  ALBUM_ARTIST: string;
  COVER_IMAGE_URL?: string | null;
  HEADLINE: string;
  BODY: string;
  CREATED_AT: string;
}

/**
 * 공지사항 첨부 미디어 1건 — 게시글 하나에 이미지/영상을 여러 개 섞어 올릴 수 있다
 */
export interface NoticeMediaItem {
  url: string;
  type: 'image' | 'video';
}

/**
 * 공지사항 — 관리자만 작성/수정/삭제 가능, 댓글 없음, 최대 5개까지 상단 고정 가능
 */
export interface NOTICE {
  NOTICE_ID: number;
  TITLE: string;
  CONTENT: string;
  MEDIA_ITEMS: NoticeMediaItem[];
  IS_PINNED: boolean;
  PINNED_AT: string | null;
  /** 관리자가 글별로 댓글 작성을 열고 닫을 수 있다 — 꺼져 있으면 서버(RLS)도 새 댓글 INSERT를 거부한다 */
  IS_COMMENTS_ENABLED: boolean;
  VIEW_COUNT: number;
  AUTHOR_ID: string | null;
  CREATED_AT: string;
  UPDATED_AT: string;
}

/**
 * 커뮤니티 게시글 첨부 미디어 1건 — NoticeMediaItem과 동일 모양
 */
export interface CommunityMediaItem {
  url: string;
  type: 'image' | 'video';
}

export type CommunityPostCategory = 'ARRIVAL' | 'FREE' | 'QNA' | 'INFO' | 'LISTENING_ROOM' | 'TIP' | 'COLLECTION' | 'WISHLIST';

/**
 * 커뮤니티 게시판 — 8개 카테고리를 한 테이블로 묶고 CATEGORY로 구분한다.
 * 카테고리별 전용 필드(오늘 온 전리품의 앨범 첨부는 COMMUNITY_POST_ALBUM,
 * QnA의 채택 답변은 ACCEPTED_COMMENT_ID, 정보 게시판의 위치는 PLACE_NAME 등)만
 * 다르고 나머지는 전 카테고리 공통이다. 항상 전체 공개(비공개 옵션 없음).
 */
export interface COMMUNITY_POST {
  POST_ID: number;
  CATEGORY: CommunityPostCategory;
  TITLE: string;
  CONTENT: string;
  MEDIA_ITEMS: CommunityMediaItem[];
  AUTHOR_ID: string;
  VIEW_COUNT: number;
  /** QnA 전용: 질문자가 채택한 최상위 답변의 COMMENT_ID */
  ACCEPTED_COMMENT_ID: number | null;
  /** 정보 게시판 전용 위치 공유 */
  PLACE_NAME: string | null;
  PLACE_ADDRESS: string | null;
  LATITUDE: number | null;
  LONGITUDE: number | null;
  CREATED_AT: string;
  UPDATED_AT: string;
}

/** 오늘 온 전리품 — 게시글에 첨부된 본인 컬렉션 앨범 (다대다) */
export interface COMMUNITY_POST_ALBUM {
  POST_ALBUM_ID: number;
  POST_ID: number;
  ALBUM_ID: number;
}

/**
 * 댓글(자유/정보/청음실/팁) 겸 답변(QnA) — 1단계 대댓글 스레딩.
 * QnA에서는 PARENT_COMMENT_ID가 null인 행만 "답변"으로 채택 가능하다.
 */
export interface COMMUNITY_COMMENT {
  COMMENT_ID: number;
  POST_ID: number;
  USER_ID: string;
  PARENT_COMMENT_ID: number | null;
  CONTENT: string;
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
